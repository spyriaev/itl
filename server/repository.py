from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
from models import (
    Document, CreateDocumentRequest, DocumentResponse,
    ChatThread, ChatMessage, CreateThreadRequest, ThreadResponse,
    CreateMessageRequest, MessageResponse, ThreadWithMessagesResponse,
    PageQuestionResponse, PageQuestionsResponse, DocumentStructure,
    DocumentStructureItem, DocumentStructureResponse
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
                contextType=msg.context_type or "page",
                chapterId=str(msg.chapter_id) if msg.chapter_id else None,
                createdAt=msg.created_at.isoformat()
            )
            for msg in messages
        ]
    )

def create_chat_message(
    db: Session, 
    thread_id: str, 
    role: str, 
    content: str, 
    page_context: Optional[int] = None,
    context_type: str = "page",
    chapter_id: Optional[str] = None
) -> MessageResponse:
    """Create a new chat message"""
    message = ChatMessage(
        id=uuid.uuid4(),
        thread_id=uuid.UUID(thread_id),
        role=role,
        content=content,
        page_context=page_context,
        context_type=context_type,
        chapter_id=uuid.UUID(chapter_id) if chapter_id else None
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
        contextType=message.context_type,
        chapterId=str(message.chapter_id) if message.chapter_id else None,
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

def get_page_questions(db: Session, document_id: str, page_number: int, user_id: str, limit: Optional[int] = None) -> PageQuestionsResponse:
    """Get user questions asked on a specific page"""
    try:
        doc_uuid = uuid.UUID(document_id)
        user_uuid = uuid.UUID(user_id)
        
        # Get total count of user messages for this page
        total_count = db.query(ChatMessage)\
            .join(ChatThread)\
            .filter(ChatThread.document_id == doc_uuid)\
            .filter(ChatThread.user_id == user_uuid)\
            .filter(ChatMessage.page_context == page_number)\
            .filter(ChatMessage.role == 'user')\
            .count()
        
        # Get questions with thread info
        query = db.query(ChatMessage, ChatThread)\
            .join(ChatThread, ChatMessage.thread_id == ChatThread.id)\
            .filter(ChatThread.document_id == doc_uuid)\
            .filter(ChatThread.user_id == user_uuid)\
            .filter(ChatMessage.page_context == page_number)\
            .filter(ChatMessage.role == 'user')\
            .order_by(desc(ChatMessage.created_at))
        
        # Apply limit only if specified
        if limit is not None:
            query = query.limit(limit)
        
        messages_with_threads = query.all()
        
        # For each question, find the first assistant response
        questions = []
        for msg, thread in messages_with_threads:
            # Find the first assistant message after this user message in the same thread
            answer_msg = db.query(ChatMessage)\
                .filter(ChatMessage.thread_id == msg.thread_id)\
                .filter(ChatMessage.role == 'assistant')\
                .filter(ChatMessage.created_at > msg.created_at)\
                .order_by(ChatMessage.created_at)\
                .first()
            
            answer_content = answer_msg.content if answer_msg else None
            
            questions.append(
                PageQuestionResponse(
                    id=str(msg.id),
                    threadId=str(thread.id),
                    threadTitle=thread.title,
                    content=msg.content,
                    answer=answer_content,
                    createdAt=msg.created_at.isoformat()
                )
            )
        
        return PageQuestionsResponse(
            pageNumber=page_number,
            totalQuestions=total_count,
            questions=questions
        )
    except ValueError:
        # If UUIDs are invalid, return empty response
        return PageQuestionsResponse(
            pageNumber=page_number,
            totalQuestions=0,
            questions=[]
        )

# Document structure related functions
def save_document_structure(db: Session, document_id: str, structure_items: List[Dict[str, Any]]) -> None:
    """Save document structure to database"""
    doc_uuid = uuid.UUID(document_id)
    
    # Delete existing structure
    db.query(DocumentStructure)\
        .filter(DocumentStructure.document_id == doc_uuid)\
        .delete()
    
    # Build item ID map for parent relationships
    item_ids = {}
    
    # Create structure items
    for item_data in structure_items:
        parent_id = None
        if item_data.get('parentId'):
            parent_id = uuid.UUID(item_data['parentId'])
        
        structure_item = DocumentStructure(
            id=uuid.UUID(item_data['id']) if 'id' in item_data else uuid.uuid4(),
            document_id=doc_uuid,
            title=item_data['title'],
            level=item_data.get('level', 1),
            page_from=item_data['pageFrom'],
            page_to=item_data.get('pageTo'),
            parent_id=parent_id,
            order_index=item_data.get('orderIndex', 0)
        )
        
        db.add(structure_item)
        item_ids[item_data['id']] = str(structure_item.id)
    
    db.commit()

def get_document_structure(db: Session, document_id: str) -> Optional[DocumentStructureResponse]:
    """Get document structure from database"""
    try:
        doc_uuid = uuid.UUID(document_id)
        
        structure_items = db.query(DocumentStructure)\
            .filter(DocumentStructure.document_id == doc_uuid)\
            .order_by(DocumentStructure.order_index)\
            .all()
        
        if not structure_items:
            return None
        
        # Convert to hierarchical structure
        items_map: Dict[str, DocumentStructureItem] = {}
        root_items = []
        
        # First pass: create all items
        for item in structure_items:
            pydantic_item = DocumentStructureItem(
                id=str(item.id),
                title=item.title,
                level=item.level,
                pageFrom=item.page_from,
                pageTo=item.page_to,
                parentId=str(item.parent_id) if item.parent_id else None,
                orderIndex=item.order_index,
                children=[]
            )
            items_map[str(item.id)] = pydantic_item
        
        # Second pass: build hierarchy
        for item in structure_items:
            pydantic_item = items_map[str(item.id)]
            if item.parent_id:
                parent_item = items_map.get(str(item.parent_id))
                if parent_item:
                    parent_item.children.append(pydantic_item)
            else:
                root_items.append(pydantic_item)
        
        return DocumentStructureResponse(
            documentId=document_id,
            items=root_items
        )
    except ValueError:
        return None

def get_chapter_by_page(
    db: Session, 
    document_id: str, 
    page_number: int, 
    min_level: int = 1,
    max_level: int = 999
) -> Optional[DocumentStructure]:
    """Find which chapter/section contains a given page with optional level filtering"""
    try:
        doc_uuid = uuid.UUID(document_id)
        
        # Find structure items within level range
        structure_items = db.query(DocumentStructure)\
            .filter(DocumentStructure.document_id == doc_uuid)\
            .filter(DocumentStructure.page_from <= page_number)\
            .filter(DocumentStructure.level >= min_level)\
            .filter(DocumentStructure.level <= max_level)\
            .order_by(DocumentStructure.level.desc(), DocumentStructure.order_index)\
            .all()
        
        for item in structure_items:
            # Check if page is within range
            if item.page_to is None or page_number <= item.page_to:
                return item
        
        return None
    except ValueError:
        return None

def get_nearest_chapter(
    db: Session, 
    document_id: str, 
    page_number: int, 
    target_level: int
) -> Optional[DocumentStructure]:
    """Find nearest chapter/section at a specific level containing the page"""
    try:
        doc_uuid = uuid.UUID(document_id)
        
        # First try to find exact level
        structure_items = db.query(DocumentStructure)\
            .filter(DocumentStructure.document_id == doc_uuid)\
            .filter(DocumentStructure.page_from <= page_number)\
            .filter(DocumentStructure.level == target_level)\
            .order_by(DocumentStructure.order_index)\
            .all()
        
        for item in structure_items:
            if item.page_to is None or page_number <= item.page_to:
                return item
        
        # If not found at exact level, return the first available structure
        fallback = get_chapter_by_page(db, document_id, page_number)
        return fallback
        
    except ValueError:
        return None

def update_chat_message_context(
    db: Session,
    message_id: str,
    context_type: str,
    chapter_id: Optional[str] = None
) -> bool:
    """Update chat message context information"""
    try:
        message = db.query(ChatMessage)\
            .filter(ChatMessage.id == uuid.UUID(message_id))\
            .first()
        
        if not message:
            return False
        
        message.context_type = context_type
        if chapter_id:
            message.chapter_id = uuid.UUID(chapter_id)
        
        db.commit()
        return True
    except ValueError:
        return False
