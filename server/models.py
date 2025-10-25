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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    thread = relationship("ChatThread", back_populates="messages")

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
    
    class Config:
        allow_population_by_field_name = True

class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    pageContext: Optional[int] = None
    createdAt: str
    
    class Config:
        from_attributes = True
        populate_by_name = True

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
