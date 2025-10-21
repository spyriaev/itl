from sqlalchemy import Column, String, BigInteger, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from pydantic import BaseModel, Field
from typing import Optional
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
