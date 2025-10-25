from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
import uuid
from datetime import datetime
from models import (
    Document, CreateDocumentRequest, DocumentResponse,
    ChatThread, ChatMessage, CreateThreadRequest, ThreadResponse,
    CreateMessageRequest, MessageResponse, ThreadWithMessagesResponse
)

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

def get_document_by_id(db: Session, document_id: str, owner_id: str) -> Optional[Document]:
    """Get a document by ID, ensuring it belongs to the owner"""
    try:
        doc_uuid = uuid.UUID(document_id)
        owner_uuid = uuid.UUID(owner_id)
        
        return db.query(Document)\
            .filter(Document.id == doc_uuid)\
            .filter(Document.owner_id == owner_uuid)\
            .first()
    except ValueError:
        return None

def update_document_progress(db: Session, document_id: str, page: int, owner_id: str) -> bool:
    """Update the last viewed page and timestamp for a document"""
    try:
        doc_uuid = uuid.UUID(document_id)
        owner_uuid = uuid.UUID(owner_id)
        
        document = db.query(Document)\
            .filter(Document.id == doc_uuid)\
            .filter(Document.owner_id == owner_uuid)\
            .first()
        
        if not document:
            return False
        
        document.last_viewed_page = page
        document.last_viewed_at = datetime.utcnow()
        
        db.commit()
        return True
    except ValueError:
        return False

# Chat-related repository functions
def create_chat_thread(db: Session, document_id: str, user_id: str, title: str) -> ThreadResponse:
    """Create a new chat thread for a document"""
    thread = ChatThread(
        id=uuid.uuid4(),
        document_id=uuid.UUID(document_id),
        user_id=uuid.UUID(user_id),
        title=title
    )
    
    db.add(thread)
    db.commit()
    db.refresh(thread)
    
    return ThreadResponse(
        id=str(thread.id),
        title=thread.title,
        createdAt=thread.created_at.isoformat(),
        updatedAt=thread.updated_at.isoformat()
    )

def list_chat_threads(db: Session, document_id: str, user_id: str) -> List[ThreadResponse]:
    """List chat threads for a document"""
    threads = db.query(ChatThread)\
        .filter(ChatThread.document_id == uuid.UUID(document_id))\
        .filter(ChatThread.user_id == uuid.UUID(user_id))\
        .order_by(desc(ChatThread.updated_at))\
        .all()
    
    return [
        ThreadResponse(
            id=str(thread.id),
            title=thread.title,
            createdAt=thread.created_at.isoformat(),
            updatedAt=thread.updated_at.isoformat()
        )
        for thread in threads
    ]

def get_chat_thread_with_messages(db: Session, thread_id: str, user_id: str) -> Optional[ThreadWithMessagesResponse]:
    """Get a chat thread with its messages"""
    thread = db.query(ChatThread)\
        .filter(ChatThread.id == uuid.UUID(thread_id))\
        .filter(ChatThread.user_id == uuid.UUID(user_id))\
        .first()
    
    if not thread:
        return None
    
    messages = db.query(ChatMessage)\
        .filter(ChatMessage.thread_id == thread.id)\
        .order_by(ChatMessage.created_at)\
        .all()
    
    return ThreadWithMessagesResponse(
        id=str(thread.id),
        title=thread.title,
        createdAt=thread.created_at.isoformat(),
        updatedAt=thread.updated_at.isoformat(),
        messages=[
            MessageResponse(
                id=str(msg.id),
                role=msg.role,
                content=msg.content,
                pageContext=msg.page_context,
                createdAt=msg.created_at.isoformat()
            )
            for msg in messages
        ]
    )

def create_chat_message(db: Session, thread_id: str, role: str, content: str, page_context: Optional[int] = None) -> MessageResponse:
    """Create a new chat message"""
    message = ChatMessage(
        id=uuid.uuid4(),
        thread_id=uuid.UUID(thread_id),
        role=role,
        content=content,
        page_context=page_context
    )
    
    db.add(message)
    
    # Update thread's updated_at timestamp
    thread = db.query(ChatThread).filter(ChatThread.id == uuid.UUID(thread_id)).first()
    if thread:
        thread.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(message)
    
    return MessageResponse(
        id=str(message.id),
        role=message.role,
        content=message.content,
        pageContext=message.page_context,
        createdAt=message.created_at.isoformat()
    )

def update_thread_title(db: Session, thread_id: str, user_id: str, title: str) -> bool:
    """Update a thread's title"""
    try:
        thread = db.query(ChatThread)\
            .filter(ChatThread.id == uuid.UUID(thread_id))\
            .filter(ChatThread.user_id == uuid.UUID(user_id))\
            .first()
        
        if not thread:
            return False
        
        thread.title = title
        thread.updated_at = datetime.utcnow()
        
        db.commit()
        return True
    except ValueError:
        return False
