from sqlalchemy import Column, String, BigInteger, DateTime, Text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field
from typing import Optional, List
import uuid

Base = declarative_base()

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), nullable=True)
    title = Column(Text, nullable=True)
    storage_key = Column(Text, nullable=False)
    size_bytes = Column(BigInteger, nullable=True)
    mime = Column(Text, nullable=True)
    checksum_sha256 = Column(Text, nullable=True)
    status = Column(Text, default="created")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    uploaded_by_session = Column(Text, nullable=True)
    last_viewed_page = Column(Integer, default=1)
    last_viewed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationship to chat threads
    chat_threads = relationship("ChatThread", back_populates="document", cascade="all, delete-orphan")
    # Relationship to document structure
    structure = relationship("DocumentStructure", back_populates="document", cascade="all, delete-orphan")

class ChatThread(Base):
    __tablename__ = "chat_threads"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    title = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    document = relationship("Document", back_populates="chat_threads")
    messages = relationship("ChatMessage", back_populates="thread", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id = Column(UUID(as_uuid=True), ForeignKey("chat_threads.id", ondelete="CASCADE"), nullable=False)
    role = Column(Text, nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    page_context = Column(Integer, nullable=True)  # Page number when message was sent
    chapter_id = Column(UUID(as_uuid=True), ForeignKey("document_structure.id", ondelete="SET NULL"), nullable=True)
    context_type = Column(Text, default="page")  # 'page', 'chapter', 'section', 'document'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    thread = relationship("ChatThread", back_populates="messages")
    chapter = relationship("DocumentStructure", foreign_keys=[chapter_id])

# Pydantic models for API requests/responses
class CreateDocumentRequest(BaseModel):
    title: Optional[str] = None
    storage_key: str = Field(alias="storageKey")
    size_bytes: int = Field(alias="sizeBytes")
    mime: str
    checksum_sha256: Optional[str] = Field(None, alias="checksumSha256")
    
    class Config:
        allow_population_by_field_name = True  # Allow both snake_case and camelCase

class DocumentResponse(BaseModel):
    id: str
    title: Optional[str] = None
    storageKey: str
    sizeBytes: Optional[int]
    mime: Optional[str] = None
    status: str
    createdAt: str
    
    class Config:
        from_attributes = True
        populate_by_name = True

class UpdateProgressRequest(BaseModel):
    page: int

# Chat-related Pydantic models
class CreateThreadRequest(BaseModel):
    title: Optional[str] = None

class ThreadResponse(BaseModel):
    id: str
    title: str
    createdAt: str
    updatedAt: str
    
    class Config:
        from_attributes = True
        populate_by_name = True

class CreateMessageRequest(BaseModel):
    content: str
    pageContext: Optional[int] = Field(None, alias="pageContext")
    contextType: Optional[str] = Field("page", alias="contextType")
    chapterId: Optional[str] = Field(None, alias="chapterId")
    
    class Config:
        allow_population_by_field_name = True

class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    pageContext: Optional[int] = None
    contextType: Optional[str] = None
    chapterId: Optional[str] = None
    createdAt: str
    
    class Config:
        from_attributes = True
        populate_by_name = True

class DocumentStructure(Base):
    __tablename__ = "document_structure"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    title = Column(Text, nullable=False)
    level = Column(Integer, nullable=False, default=1)
    page_from = Column(Integer, nullable=False)
    page_to = Column(Integer, nullable=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("document_structure.id", ondelete="CASCADE"), nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    document = relationship("Document", back_populates="structure")
    parent = relationship("DocumentStructure", remote_side=[id], backref="children")

class ThreadWithMessagesResponse(BaseModel):
    id: str
    title: str
    createdAt: str
    updatedAt: str
    messages: List[MessageResponse]
    
    class Config:
        from_attributes = True
        populate_by_name = True

# Page questions related models
class PageQuestionResponse(BaseModel):
    id: str
    threadId: str
    threadTitle: str
    content: str
    answer: str | None = None  # First assistant response to this question
    createdAt: str
    
    class Config:
        from_attributes = True
        populate_by_name = True

class PageQuestionsResponse(BaseModel):
    pageNumber: int
    totalQuestions: int
    questions: List[PageQuestionResponse]
    
    class Config:
        from_attributes = True
        populate_by_name = True

# Document structure related models
class DocumentStructureItem(BaseModel):
    id: str
    title: str
    level: int
    pageFrom: int
    pageTo: Optional[int]
    parentId: Optional[str]
    orderIndex: int
    children: Optional[List['DocumentStructureItem']] = []
    
    class Config:
        from_attributes = True
        populate_by_name = True

class DocumentStructureResponse(BaseModel):
    documentId: str
    items: List[DocumentStructureItem]
    
    class Config:
        from_attributes = True
        populate_by_name = True

class ExtractStructureRequest(BaseModel):
    force: bool = False
