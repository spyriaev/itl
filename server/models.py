from sqlalchemy import Column, String, BigInteger, DateTime, Text, Integer, ForeignKey, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import date
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
    context_type = Column(Text, default="page")  # 'page', 'chapter', 'none'
    context_text = Column(Text, nullable=True)  # Raw context text provided to the assistant
    tokens_used = Column(Integer, nullable=True)  # Tokens used for this message (AI responses)
    usage_tracked_at = Column(DateTime(timezone=True), nullable=True)  # When usage was tracked
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    thread = relationship("ChatThread", back_populates="messages")
    chapter = relationship("DocumentStructure", foreign_keys=[chapter_id])

class UserPlan(Base):
    __tablename__ = "user_plans"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    plan_type = Column(Text, nullable=False)  # 'beta', 'base', 'plus'
    status = Column(Text, nullable=False, default='active')  # 'active', 'trial', 'expired'
    started_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    usage_records = relationship("UserUsage", back_populates="plan", cascade="all, delete-orphan")

class PlanLimits(Base):
    __tablename__ = "plan_limits"
    
    plan_type = Column(Text, primary_key=True)
    max_storage_bytes = Column(BigInteger, nullable=False)
    max_files = Column(Integer, nullable=True)  # NULL means unlimited
    max_single_file_bytes = Column(BigInteger, nullable=False)
    max_tokens_per_month = Column(BigInteger, nullable=False)
    max_questions_per_month = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UserUsage(Base):
    __tablename__ = "user_usage"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("user_plans.id", ondelete="CASCADE"), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    storage_bytes_used = Column(BigInteger, default=0)
    files_count = Column(Integer, default=0)
    tokens_used = Column(BigInteger, default=0)
    questions_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    plan = relationship("UserPlan", back_populates="usage_records")

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
    lastViewedPage: Optional[int] = None
    isShared: Optional[bool] = False  # True if document is shared (not owned by current user)
    hasActiveShare: Optional[bool] = False  # True if document has an active share link (created by current user)
    questionsCount: Optional[int] = 0  # Number of questions asked for this document
    
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
    contextType: Optional[Literal['page', 'chapter', 'none']] = Field(None, alias="contextType")
    chapterId: Optional[str] = Field(None, alias="chapterId")
    
    class Config:
        allow_population_by_field_name = True

class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    pageContext: Optional[int] = None
    contextType: Optional[Literal['page', 'chapter', 'none']] = None
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

class DocumentShare(Base):
    __tablename__ = "document_shares"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    share_token = Column(Text, nullable=False, unique=True)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    document = relationship("Document")
    access_records = relationship("DocumentShareAccess", back_populates="share", cascade="all, delete-orphan")

class DocumentShareAccess(Base):
    __tablename__ = "document_share_access"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    share_id = Column(UUID(as_uuid=True), ForeignKey("document_shares.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    accessed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    share = relationship("DocumentShare", back_populates="access_records")

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
    userId: str  # ID of the user who asked the question
    isOwn: bool  # Whether this question belongs to the current user
    canOpenThread: bool  # Whether the thread can be opened (only for own questions)
    
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

class AllDocumentQuestionsResponse(BaseModel):
    documentId: str
    lastModified: str  # ISO timestamp of the most recent question/answer
    pages: List[PageQuestionsResponse]  # Questions grouped by page
    
    class Config:
        from_attributes = True
        populate_by_name = True

class DocumentQuestionsMetadataResponse(BaseModel):
    documentId: str
    lastModified: str  # ISO timestamp of the most recent question/answer
    totalQuestions: int
    pagesWithQuestions: List[int]  # List of page numbers that have questions
    
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

# User plan and usage related models
class UserPlanResponse(BaseModel):
    id: str
    userId: str
    planType: str
    status: str
    startedAt: str
    expiresAt: Optional[str] = None
    
    class Config:
        from_attributes = True
        populate_by_name = True

class PlanLimitsResponse(BaseModel):
    planType: str
    maxStorageBytes: int
    maxFiles: Optional[int] = None
    maxSingleFileBytes: int
    maxTokensPerMonth: int
    maxQuestionsPerMonth: int
    
    class Config:
        from_attributes = True
        populate_by_name = True

class UserUsageResponse(BaseModel):
    userId: str
    planId: str
    planType: str
    periodStart: str
    periodEnd: str
    storageBytesUsed: int
    filesCount: int
    tokensUsed: int
    questionsCount: int
    limits: PlanLimitsResponse
    
    class Config:
        from_attributes = True
        populate_by_name = True

class SetUserPlanRequest(BaseModel):
    planType: str = Field(..., pattern="^(beta|base|plus)$")
    
    class Config:
        allow_population_by_field_name = True

# Document sharing related models
class ShareDocumentRequest(BaseModel):
    expiresAt: Optional[str] = None  # ISO datetime string
    
    class Config:
        allow_population_by_field_name = True

class ShareDocumentResponse(BaseModel):
    shareToken: str
    shareUrl: str  # Full URL to access the shared document
    createdAt: str
    expiresAt: Optional[str] = None
    
    class Config:
        from_attributes = True
        populate_by_name = True

class ShareStatusResponse(BaseModel):
    hasActiveShare: bool
    shareToken: Optional[str] = None
    shareUrl: Optional[str] = None
    createdAt: Optional[str] = None
    revokedAt: Optional[str] = None
    expiresAt: Optional[str] = None
    
    class Config:
        from_attributes = True
        populate_by_name = True
