from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
import uuid
from datetime import datetime
from models import Document, CreateDocumentRequest, DocumentResponse

def create_document(db: Session, request: CreateDocumentRequest, user_id: str) -> DocumentResponse:
    """Create a new document record"""
    db_document = Document(
        id=uuid.uuid4(),
        owner_id=uuid.UUID(user_id),
        title=request.title,
        storage_key=request.storage_key,
        size_bytes=request.size_bytes,
        mime=request.mime,
        checksum_sha256=request.checksum_sha256,
        status="uploaded"
    )
    
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    
    return DocumentResponse(
        id=str(db_document.id),
        title=db_document.title,
        storageKey=db_document.storage_key,
        sizeBytes=db_document.size_bytes,
        mime=db_document.mime,
        status=db_document.status,
        createdAt=db_document.created_at.isoformat()
    )

def list_documents(db: Session, user_id: str, limit: int = 50, offset: int = 0) -> List[DocumentResponse]:
    """List documents for a user with pagination"""
    documents = db.query(Document)\
        .filter(Document.owner_id == uuid.UUID(user_id))\
        .order_by(desc(Document.created_at))\
        .offset(offset)\
        .limit(limit)\
        .all()
    
    return [
        DocumentResponse(
            id=str(doc.id),
            title=doc.title,
            storageKey=doc.storage_key,
            sizeBytes=doc.size_bytes,
            mime=doc.mime,
            status=doc.status,
            createdAt=doc.created_at.isoformat()
        )
        for doc in documents
    ]
