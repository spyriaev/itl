from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_, func
from typing import List, Optional, Dict, Any
import uuid
import secrets
from datetime import datetime, date, timedelta
from models import (
    Document, CreateDocumentRequest, DocumentResponse,
    ChatThread, ChatMessage, CreateThreadRequest, ThreadResponse,
    CreateMessageRequest, MessageResponse, ThreadWithMessagesResponse,
    PageQuestionResponse, PageQuestionsResponse, DocumentStructure,
    DocumentStructureItem, DocumentStructureResponse,
    UserPlan, PlanLimits, UserUsage, UserPlanResponse, PlanLimitsResponse, UserUsageResponse,
    DocumentShare, DocumentShareAccess, ShareDocumentResponse, ShareStatusResponse
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
        createdAt=db_document.created_at.isoformat(),
        questionsCount=0
    )

def list_documents(db: Session, user_id: str, limit: int = 50, offset: int = 0) -> List[DocumentResponse]:
    """List documents for a user with pagination. Includes owned documents and shared documents."""
    user_uuid = uuid.UUID(user_id)
    
    # Get owned documents
    owned_docs = db.query(Document)\
        .filter(Document.owner_id == user_uuid)\
        .all()
    
    owned_ids = {doc.id for doc in owned_docs}
    
    # Get shared documents (documents the user has access to)
    shared_docs = db.query(Document)\
        .join(DocumentShare, DocumentShare.document_id == Document.id)\
        .join(DocumentShareAccess, DocumentShareAccess.share_id == DocumentShare.id)\
        .filter(DocumentShareAccess.user_id == user_uuid)\
        .filter(DocumentShare.revoked_at.is_(None))\
        .filter(
            or_(
                DocumentShare.expires_at.is_(None),
                DocumentShare.expires_at > datetime.utcnow()
            )
        )\
        .all()
    
    shared_ids = {doc.id for doc in shared_docs}
    
    # Combine and deduplicate (in case user owns a document they also have shared access to)
    all_docs = {doc.id: doc for doc in owned_docs}
    all_docs.update({doc.id: doc for doc in shared_docs})
    
    # Get all document IDs to check for active shares
    all_doc_ids = list(all_docs.keys())
    
    # Check which owned documents have active shares
    active_shares = db.query(DocumentShare)\
        .filter(DocumentShare.document_id.in_(all_doc_ids))\
        .filter(DocumentShare.created_by == user_uuid)\
        .filter(DocumentShare.revoked_at.is_(None))\
        .filter(
            or_(
                DocumentShare.expires_at.is_(None),
                DocumentShare.expires_at > datetime.utcnow()
            )
        )\
        .all()
    
    documents_with_active_shares = {share.document_id for share in active_shares}
    
    # Sort by created_at descending
    sorted_docs = sorted(all_docs.values(), key=lambda d: d.created_at, reverse=True)
    
    # Apply pagination
    paginated_docs = sorted_docs[offset:offset + limit]
    
    # Get questions count for each document
    # Count all user messages (questions) for each document
    questions_counts = {}
    if paginated_docs:
        doc_ids = [doc.id for doc in paginated_docs]
        questions_counts_result = db.query(
            ChatThread.document_id,
            func.count(ChatMessage.id).label('count')
        ).join(ChatMessage, ChatMessage.thread_id == ChatThread.id)\
         .filter(ChatThread.document_id.in_(doc_ids))\
         .filter(ChatMessage.role == 'user')\
         .group_by(ChatThread.document_id)\
         .all()
        
        questions_counts = {doc_id: count for doc_id, count in questions_counts_result}
    
    return [
        DocumentResponse(
            id=str(doc.id),
            title=doc.title,
            storageKey=doc.storage_key,
            sizeBytes=doc.size_bytes,
            mime=doc.mime,
            status=doc.status,
            createdAt=doc.created_at.isoformat(),
            lastViewedPage=doc.last_viewed_page,
            isShared=doc.id in shared_ids and doc.id not in owned_ids,
            hasActiveShare=doc.id in documents_with_active_shares,
            questionsCount=questions_counts.get(doc.id, 0)
        )
        for doc in paginated_docs
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

def update_document_progress(db: Session, document_id: str, page: int, user_id: str) -> bool:
    """Update the last viewed page and timestamp for a document. Works for owned and shared documents."""
    try:
        doc_uuid = uuid.UUID(document_id)
        user_uuid = uuid.UUID(user_id)
        
        # Check if user owns the document or has shared access
        document = get_document_by_id_or_share(db, document_id, user_id)
        
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

def check_user_has_document_access(db: Session, document_id: str, user_id: str) -> bool:
    """Check if user has access to document (either owns it or has shared access)"""
    try:
        doc_uuid = uuid.UUID(document_id)
        user_uuid = uuid.UUID(user_id)
        
        # Check if user owns the document
        owned = db.query(Document)\
            .filter(Document.id == doc_uuid)\
            .filter(Document.owner_id == user_uuid)\
            .first()
        
        if owned:
            return True
        
        # Check if user has shared access
        shared_access = db.query(DocumentShareAccess)\
            .join(DocumentShare, DocumentShare.id == DocumentShareAccess.share_id)\
            .filter(DocumentShare.document_id == doc_uuid)\
            .filter(DocumentShareAccess.user_id == user_uuid)\
            .filter(DocumentShare.revoked_at.is_(None))\
            .filter(
                or_(
                    DocumentShare.expires_at.is_(None),
                    DocumentShare.expires_at > datetime.utcnow()
                )
            )\
            .first()
        
        return shared_access is not None
    except ValueError:
        return False

def get_page_questions(db: Session, document_id: str, page_number: int, user_id: str, limit: Optional[int] = None) -> PageQuestionsResponse:
    """Get questions asked on a specific page. For shared documents, returns all questions with ownership info."""
    try:
        doc_uuid = uuid.UUID(document_id)
        user_uuid = uuid.UUID(user_id)
        
        # Check if user has access through sharing
        has_shared_access = check_user_has_document_access(db, document_id, user_id)
        
        # Check if user owns the document
        document = db.query(Document)\
            .filter(Document.id == doc_uuid)\
            .first()
        
        is_owner = document and document.owner_id == user_uuid
        
        # If user has shared access or owns document, show all questions
        # Otherwise, show only own questions
        if has_shared_access or is_owner:
            # Get all questions from all users for this page
            total_count = db.query(ChatMessage)\
                .join(ChatThread)\
                .filter(ChatThread.document_id == doc_uuid)\
                .filter(ChatMessage.page_context == page_number)\
                .filter(ChatMessage.role == 'user')\
                .count()
            
            query = db.query(ChatMessage, ChatThread)\
                .join(ChatThread, ChatMessage.thread_id == ChatThread.id)\
                .filter(ChatThread.document_id == doc_uuid)\
                .filter(ChatMessage.page_context == page_number)\
                .filter(ChatMessage.role == 'user')\
                .order_by(desc(ChatMessage.created_at))
        else:
            # Get only user's own questions
            total_count = db.query(ChatMessage)\
                .join(ChatThread)\
                .filter(ChatThread.document_id == doc_uuid)\
                .filter(ChatThread.user_id == user_uuid)\
                .filter(ChatMessage.page_context == page_number)\
                .filter(ChatMessage.role == 'user')\
                .count()
            
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
            question_user_id = str(thread.user_id)
            is_own = question_user_id == user_id
            can_open = is_own  # Can only open own threads
            
            questions.append(
                PageQuestionResponse(
                    id=str(msg.id),
                    threadId=str(thread.id),
                    threadTitle=thread.title,
                    content=msg.content,
                    answer=answer_content,
                    createdAt=msg.created_at.isoformat(),
                    userId=question_user_id,
                    isOwn=is_own,
                    canOpenThread=can_open
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

# User plan and usage related repository functions
def get_user_plan(db: Session, user_id: str) -> Optional[UserPlan]:
    """Get the current active plan for a user"""
    try:
        user_uuid = uuid.UUID(user_id)
        # Get the most recent active plan
        plan = db.query(UserPlan)\
            .filter(UserPlan.user_id == user_uuid)\
            .filter(UserPlan.status == 'active')\
            .order_by(desc(UserPlan.started_at))\
            .first()
        
        return plan
    except ValueError:
        return None

def set_user_plan(db: Session, user_id: str, plan_type: str) -> UserPlan:
    """Set or change a user's plan. Deactivates old plan and creates a new one."""
    try:
        user_uuid = uuid.UUID(user_id)
        
        # Deactivate existing active plan
        existing_plans = db.query(UserPlan)\
            .filter(UserPlan.user_id == user_uuid)\
            .filter(UserPlan.status == 'active')\
            .all()
        
        for plan in existing_plans:
            plan.status = 'expired'
            plan.updated_at = datetime.utcnow()
        
        # Create new plan
        new_plan = UserPlan(
            id=uuid.uuid4(),
            user_id=user_uuid,
            plan_type=plan_type,
            status='active',
            started_at=datetime.utcnow()
        )
        
        db.add(new_plan)
        db.commit()
        db.refresh(new_plan)
        
        return new_plan
    except ValueError:
        raise ValueError("Invalid user_id or plan_type")

def get_plan_limits(db: Session, plan_type: str) -> Optional[PlanLimits]:
    """Get limits for a specific plan type"""
    return db.query(PlanLimits)\
        .filter(PlanLimits.plan_type == plan_type)\
        .first()

def calculate_period_dates(start_date: date) -> tuple[date, date]:
    """Calculate period start and end dates based on subscription start date.
    Period resets monthly on the same day of month as the subscription started.
    Returns (period_start, period_end) where period_end is the last day of the period.
    """
    period_start = start_date
    
    # Calculate period_end: same day next month minus 1 day (inclusive end)
    if period_start.month == 12:
        try:
            period_end = date(period_start.year + 1, 1, period_start.day) - timedelta(days=1)
        except ValueError:
            period_end = date(period_start.year, 12, 31)
    else:
        try:
            period_end = date(period_start.year, period_start.month + 1, period_start.day) - timedelta(days=1)
        except ValueError:
            # Handle cases where the day doesn't exist in next month (e.g., Jan 31 -> Feb)
            # Use last day of the next month
            if period_start.month + 1 == 2:
                # February: use 28 (or 29 in leap year)
                if period_start.year % 4 == 0 and (period_start.year % 100 != 0 or period_start.year % 400 == 0):
                    period_end = date(period_start.year, 2, 29) - timedelta(days=1)
                else:
                    period_end = date(period_start.year, 2, 28) - timedelta(days=1)
            else:
                # Get last day of current month
                if period_start.month + 1 in [4, 6, 9, 11]:
                    period_end = date(period_start.year, period_start.month + 1, 30) - timedelta(days=1)
                else:
                    period_end = date(period_start.year, period_start.month + 1, 31) - timedelta(days=1)
    
    return period_start, period_end

def get_or_create_user_usage(db: Session, user_id: str, plan_id: str) -> UserUsage:
    """Get or create user usage record for current period based on plan start date"""
    try:
        user_uuid = uuid.UUID(user_id)
        plan_uuid = uuid.UUID(plan_id)
        
        # Get the plan to determine period dates
        plan = db.query(UserPlan).filter(UserPlan.id == plan_uuid).first()
        if not plan:
            raise ValueError("Plan not found")
        
        # Calculate current period based on plan start date
        plan_start_date = plan.started_at.date()
        current_date = date.today()
        
        # Find the period that contains today's date
        # Periods reset monthly on the same day as the plan started
        period_start = plan_start_date
        
        # If today is past the first period end, calculate the correct period
        while True:
            _, period_end = calculate_period_dates(period_start)
            if current_date <= period_end:
                break
            # Move to next period
            period_start = period_end + timedelta(days=1)
        
        # Try to get existing usage record (unique constraint is on user_id + period_start)
        usage = db.query(UserUsage)\
            .filter(UserUsage.user_id == user_uuid)\
            .filter(UserUsage.period_start == period_start)\
            .first()
        
        if usage:
            # If plan_id changed, update it
            if usage.plan_id != plan_uuid:
                usage.plan_id = plan_uuid
                db.commit()
                db.refresh(usage)
            return usage
        
        # Create new usage record
        _, period_end = calculate_period_dates(period_start)
        usage = UserUsage(
            id=uuid.uuid4(),
            user_id=user_uuid,
            plan_id=plan_uuid,
            period_start=period_start,
            period_end=period_end,
            storage_bytes_used=0,
            files_count=0,
            tokens_used=0,
            questions_count=0
        )
        
        db.add(usage)
        try:
            db.commit()
            db.refresh(usage)
        except Exception as e:
            db.rollback()
            # If there was a race condition and record was created by another thread,
            # try to fetch it again
            usage = db.query(UserUsage)\
                .filter(UserUsage.user_id == user_uuid)\
                .filter(UserUsage.period_start == period_start)\
                .first()
            if usage:
                # If plan_id changed, update it
                if usage.plan_id != plan_uuid:
                    usage.plan_id = plan_uuid
                    db.commit()
                    db.refresh(usage)
                return usage
            raise
        
        return usage
    except ValueError as e:
        raise ValueError(f"Invalid user_id or plan_id: {e}")

def get_user_usage(db: Session, user_id: str) -> Optional[UserUsageResponse]:
    """Get current user usage with limits"""
    try:
        # Get user's active plan
        plan = get_user_plan(db, user_id)
        if not plan:
            # Create default beta plan if none exists
            plan = set_user_plan(db, user_id, 'beta')
        
        # Get or create usage record
        usage = get_or_create_user_usage(db, user_id, str(plan.id))
        
        # Get plan limits
        limits = get_plan_limits(db, plan.plan_type)
        if not limits:
            return None
        
        # Convert to response model
        limits_response = PlanLimitsResponse(
            planType=limits.plan_type,
            maxStorageBytes=limits.max_storage_bytes,
            maxFiles=limits.max_files,
            maxSingleFileBytes=limits.max_single_file_bytes,
            maxTokensPerMonth=limits.max_tokens_per_month,
            maxQuestionsPerMonth=limits.max_questions_per_month
        )
        
        return UserUsageResponse(
            userId=str(usage.user_id),
            planId=str(usage.plan_id),
            planType=plan.plan_type,
            periodStart=usage.period_start.isoformat(),
            periodEnd=usage.period_end.isoformat(),
            storageBytesUsed=usage.storage_bytes_used,
            filesCount=usage.files_count,
            tokensUsed=usage.tokens_used,
            questionsCount=usage.questions_count,
            limits=limits_response
        )
    except ValueError:
        return None

def increment_user_usage(
    db: Session,
    user_id: str,
    storage_bytes: int = 0,
    files: int = 0,
    tokens: int = 0,
    questions: int = 0
) -> bool:
    """Increment user usage counters"""
    try:
        # Get user's active plan
        plan = get_user_plan(db, user_id)
        if not plan:
            plan = set_user_plan(db, user_id, 'beta')
        
        # Get or create usage record
        usage = get_or_create_user_usage(db, user_id, str(plan.id))
        
        # Increment counters
        if storage_bytes > 0:
            usage.storage_bytes_used += storage_bytes
        if files > 0:
            usage.files_count += files
        if tokens > 0:
            usage.tokens_used += tokens
        if questions > 0:
            usage.questions_count += questions
        
        usage.updated_at = datetime.utcnow()
        
        db.commit()
        return True
    except ValueError:
        return False

def check_storage_limit(db: Session, user_id: str, file_size: int) -> tuple[bool, Optional[str]]:
    """Check if user can upload a file of given size. Returns (allowed, error_message)"""
    usage_data = get_user_usage(db, user_id)
    if not usage_data:
        return False, "Unable to determine usage limits"
    
    if usage_data.storageBytesUsed + file_size > usage_data.limits.maxStorageBytes:
        max_mb = usage_data.limits.maxStorageBytes / (1024 * 1024)
        used_mb = usage_data.storageBytesUsed / (1024 * 1024)
        return False, f"Storage limit exceeded. Maximum: {max_mb:.1f} MB, Used: {used_mb:.1f} MB"
    
    return True, None

def check_file_count_limit(db: Session, user_id: str) -> tuple[bool, Optional[str]]:
    """Check if user can upload another file. Returns (allowed, error_message)"""
    usage_data = get_user_usage(db, user_id)
    if not usage_data:
        return False, "Unable to determine usage limits"
    
    # NULL means unlimited
    if usage_data.limits.maxFiles is None:
        return True, None
    
    if usage_data.filesCount >= usage_data.limits.maxFiles:
        return False, f"File limit exceeded. Maximum: {usage_data.limits.maxFiles} files"
    
    return True, None

def check_single_file_limit(db: Session, user_id: str, file_size: int) -> tuple[bool, Optional[str]]:
    """Check if single file size is within limit. Returns (allowed, error_message)"""
    usage_data = get_user_usage(db, user_id)
    if not usage_data:
        return False, "Unable to determine usage limits"
    
    if file_size > usage_data.limits.maxSingleFileBytes:
        max_mb = usage_data.limits.maxSingleFileBytes / (1024 * 1024)
        return False, f"File size exceeds limit. Maximum: {max_mb:.1f} MB"
    
    return True, None

def check_tokens_limit(db: Session, user_id: str, tokens_needed: int) -> tuple[bool, Optional[str]]:
    """Check if user can use more tokens. Returns (allowed, error_message)"""
    usage_data = get_user_usage(db, user_id)
    if not usage_data:
        return False, "Unable to determine usage limits"
    
    if usage_data.tokensUsed + tokens_needed > usage_data.limits.maxTokensPerMonth:
        return False, f"Token limit exceeded. Maximum: {usage_data.limits.maxTokensPerMonth} tokens"
    
    return True, None

def check_questions_limit(db: Session, user_id: str) -> tuple[bool, Optional[str]]:
    """Check if user can ask another question. Returns (allowed, error_message)"""
    usage_data = get_user_usage(db, user_id)
    if not usage_data:
        return False, "Unable to determine usage limits"
    
    if usage_data.questionsCount >= usage_data.limits.maxQuestionsPerMonth:
        return False, f"Question limit exceeded. Maximum: {usage_data.limits.maxQuestionsPerMonth} questions per month"
    
    return True, None

# Document sharing related repository functions
def create_document_share(db: Session, document_id: str, user_id: str, expires_at: Optional[datetime] = None) -> DocumentShare:
    """Create a new share for a document"""
    # Generate unique token (32 bytes = 64 hex characters)
    share_token = secrets.token_urlsafe(32)
    
    # Ensure uniqueness
    while db.query(DocumentShare).filter(DocumentShare.share_token == share_token).first():
        share_token = secrets.token_urlsafe(32)
    
    share = DocumentShare(
        id=uuid.uuid4(),
        document_id=uuid.UUID(document_id),
        share_token=share_token,
        created_by=uuid.UUID(user_id),
        expires_at=expires_at
    )
    
    db.add(share)
    db.commit()
    db.refresh(share)
    
    return share

def get_document_share_by_token(db: Session, share_token: str) -> Optional[DocumentShare]:
    """Get a document share by token, checking validity"""
    share = db.query(DocumentShare)\
        .filter(DocumentShare.share_token == share_token)\
        .first()
    
    if not share:
        return None
    
    # Check if revoked
    if share.revoked_at:
        return None
    
    # Check if expired
    if share.expires_at and share.expires_at < datetime.utcnow():
        return None
    
    return share

def get_active_document_share(db: Session, document_id: str) -> Optional[DocumentShare]:
    """Get active share for a document (not revoked, not expired)"""
    doc_uuid = uuid.UUID(document_id)
    
    share = db.query(DocumentShare)\
        .filter(DocumentShare.document_id == doc_uuid)\
        .filter(DocumentShare.revoked_at.is_(None))\
        .filter(
            or_(
                DocumentShare.expires_at.is_(None),
                DocumentShare.expires_at > datetime.utcnow()
            )
        )\
        .order_by(desc(DocumentShare.created_at))\
        .first()
    
    return share

def revoke_document_share(db: Session, document_id: str, user_id: str) -> bool:
    """Revoke a document share (set revoked_at to current time)"""
    try:
        doc_uuid = uuid.UUID(document_id)
        user_uuid = uuid.UUID(user_id)
        
        share = db.query(DocumentShare)\
            .filter(DocumentShare.document_id == doc_uuid)\
            .filter(DocumentShare.created_by == user_uuid)\
            .filter(DocumentShare.revoked_at.is_(None))\
            .first()
        
        if not share:
            return False
        
        share.revoked_at = datetime.utcnow()
        db.commit()
        return True
    except ValueError:
        return False

def record_share_access(db: Session, share_id: str, user_id: str) -> bool:
    """Record that a user accessed a shared document. Returns True if new record created, False if already exists."""
    try:
        share_uuid = uuid.UUID(share_id)
        user_uuid = uuid.UUID(user_id)
        
        # Check if access record already exists
        existing = db.query(DocumentShareAccess)\
            .filter(DocumentShareAccess.share_id == share_uuid)\
            .filter(DocumentShareAccess.user_id == user_uuid)\
            .first()
        
        if existing:
            return False  # Already recorded
        
        # Create new access record
        access = DocumentShareAccess(
            id=uuid.uuid4(),
            share_id=share_uuid,
            user_id=user_uuid
        )
        
        db.add(access)
        db.commit()
        return True
    except ValueError:
        return False

def get_document_by_id_or_share(db: Session, document_id: str, user_id: str) -> Optional[Document]:
    """Get a document by ID, checking ownership or shared access"""
    try:
        doc_uuid = uuid.UUID(document_id)
        user_uuid = uuid.UUID(user_id)
        
        # Try to get document
        document = db.query(Document)\
            .filter(Document.id == doc_uuid)\
            .first()
        
        if not document:
            return None
        
        # Check ownership
        if document.owner_id == user_uuid:
            return document
        
        # Check shared access
        if check_user_has_document_access(db, document_id, user_id):
            return document
        
        return None
    except ValueError:
        return None
