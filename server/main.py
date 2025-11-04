from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from dataclasses import dataclass
import os
import logging
import json
import asyncio
import uuid
from datetime import datetime

from database import get_db, test_database_connection, engine, supabase
from auth import get_current_user_id
from models import (
    CreateDocumentRequest, DocumentResponse, Base, UpdateProgressRequest,
    CreateThreadRequest, ThreadResponse, CreateMessageRequest, MessageResponse,
    ThreadWithMessagesResponse, Document, ChatThread, PageQuestionsResponse,
    AllDocumentQuestionsResponse, DocumentQuestionsMetadataResponse,
    DocumentStructureResponse, ExtractStructureRequest,
    UserPlanResponse, UserUsageResponse, SetUserPlanRequest,
    ShareDocumentRequest, ShareDocumentResponse, ShareStatusResponse
)
from repository import (
    create_document, list_documents, get_document_by_id, update_document_progress,
    create_chat_thread, list_chat_threads, get_chat_thread_with_messages,
    create_chat_message, update_thread_title, get_page_questions,
    get_all_document_questions, get_document_questions_metadata,
    list_chat_threads_since, get_thread_messages_since,
    save_document_structure, get_document_structure, get_chapter_by_page,
    get_user_plan, set_user_plan, get_user_usage, increment_user_usage,
    check_storage_limit, check_file_count_limit, check_single_file_limit,
    check_tokens_limit, check_questions_limit,
    create_document_share, get_document_share_by_token, revoke_document_share,
    get_active_document_share, record_share_access, get_document_by_id_or_share,
    check_user_has_document_access
)
from pdf_utils import extract_pdf_outline

# Custom exception for limit exceeded errors
@dataclass
class LimitExceededError(Exception):
    """Custom exception for limit exceeded errors"""
    limit_type: str  # 'question', 'token', 'file', 'storage', 'single_file'
    limit_value: int  # The limit value
    current_usage: Optional[int] = None  # Current usage if available
    limit_period: str = "month"  # 'month' or 'day'
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON response"""
        return {
            "error_type": "limit_exceeded",
            "limit_type": self.limit_type,
            "limit_value": self.limit_value,
            "current_usage": self.current_usage,
            "limit_period": self.limit_period,
            "message": self.get_message()
        }
    
    def get_message(self) -> str:
        """Get human-readable error message"""
        type_names = {
            "question": "questions",
            "token": "tokens",
            "file": "files",
            "storage": "storage",
            "single_file": "file size"
        }
        type_name = type_names.get(self.limit_type, self.limit_type)
        period = f"per {self.limit_period}"
        return f"{self.limit_type.title()} limit exceeded. Maximum: {self.limit_value} {type_name} {period}"

# Import AI service (real or mock based on environment variable)
if os.getenv("USE_MOCK_AI", "").lower() in ["true", "1", "yes"]:
    print("🔧 Using MOCK AI Service for testing")
    from ai_service_mock import ai_service
else:
    print("🧠 Using REAL AI Service")
    from ai_service import ai_service


# Create FastAPI app
app = FastAPI(title="Innesi API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests with headers"""
    print(f"\n🔍 REQUEST LOG:")
    print(f"   Method: {request.method}")
    print(f"   URL: {request.url}")
    print(f"   Headers:")
    
    # Log all headers
    for header_name, header_value in request.headers.items():
        # Mask sensitive headers
        if header_name.lower() in ['authorization', 'cookie']:
            if header_name.lower() == 'authorization':
                # Show first 20 chars of token for debugging
                masked_value = header_value[:20] + "..." if len(header_value) > 20 else header_value
                print(f"     {header_name}: {masked_value}")
            else:
                print(f"     {header_name}: [MASKED]")
        else:
            print(f"     {header_name}: {header_value}")
    
    print(f"   Query params: {dict(request.query_params)}")
    
    # Log request body for debugging
    if request.method in ["POST", "PUT", "PATCH"]:
        try:
            body = await request.body()
            print(f"   Request body: {body.decode('utf-8')}")
        except Exception as e:
            print(f"   Request body: [Error reading body: {e}]")
    
    print("=" * 50)
    
    response = await call_next(request)
    
    print(f"📤 RESPONSE LOG:")
    print(f"   Status: {response.status_code}")
    print("=" * 50)
    
    return response

# Global exception handlers
@app.exception_handler(LimitExceededError)
async def limit_exceeded_handler(request, exc: LimitExceededError):
    """Handle limit exceeded errors with structured response"""
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content=exc.to_dict()
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "error_type": "general"}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": f"Internal Server Error: {str(exc)}"}
    )

# Routes
@app.get("/health")
async def health_check():
    """Health check endpoint with database status"""
    try:
        db_status = True
        status_text = "ok" if db_status else "degraded"
        return {
            "status": status_text,
            "database": "connected" if db_status else "disconnected",
            "message": "Server is running (database connection may be unavailable)"
        }
    except Exception as e:
        return {
            "status": "degraded",
            "database": "disconnected",
            "message": f"Database connection error: {str(e)}"
        }

@app.post("/api/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document_endpoint(
    request: CreateDocumentRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create a new document"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Validate MIME type
    if request.mime != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed"
        )
    
    # Check resource limits
    # Check single file size limit
    allowed, error_msg = check_single_file_limit(db, user_id, request.size_bytes)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_msg
        )
    
    # Check storage limit
    allowed, error_msg = check_storage_limit(db, user_id, request.size_bytes)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_msg
        )
    
    # Check file count limit
    allowed, error_msg = check_file_count_limit(db, user_id)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_msg
        )
    
    # Create document
    document_response = create_document(db, request, user_id)
    
    # Update usage counters
    increment_user_usage(db, user_id, storage_bytes=request.size_bytes, files=1)
    
    return document_response

@app.get("/api/documents", response_model=List[DocumentResponse])
async def list_documents_endpoint(
    limit: int = 50,
    offset: int = 0,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List user documents with pagination"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    return list_documents(db, user_id, limit, offset)

@app.get("/api/documents/{document_id}/view")
async def get_document_view_url(
    document_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get signed URL for viewing a document. Works for owned and shared documents."""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Get document and verify ownership or shared access
    document = get_document_by_id_or_share(db, document_id, user_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    try:
        # Create signed URL (expires in 1 hour)
        if not supabase:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Supabase storage not available"
            )
            
        signed_url_response = supabase.storage.from_('pdfs').create_signed_url(
            document.storage_key,
            expires_in=3600
        )
        
        if not signed_url_response.get('signedURL'):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create signed URL"
            )
        
        return {
            "url": signed_url_response['signedURL'],
            "lastViewedPage": document.last_viewed_page or 1,
            "title": document.title
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create signed URL: {str(e)}"
        )

@app.patch("/api/documents/{document_id}/progress")
async def update_view_progress(
    document_id: str,
    request: UpdateProgressRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update the last viewed page for a document"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Validate page number
    if request.page < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Page number must be greater than 0"
        )
    
    # Update progress (works for owned and shared documents)
    success = update_document_progress(db, document_id, request.page, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return {"message": "Progress updated successfully"}

# Document sharing API endpoints
@app.post("/api/documents/{document_id}/share", response_model=ShareDocumentResponse)
async def create_share_endpoint(
    document_id: str,
    request: ShareDocumentRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create a share link for a document"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Verify document exists and belongs to user
    document = get_document_by_id(db, document_id, user_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if there's already an active share
    existing_share = get_active_document_share(db, document_id)
    if existing_share:
        # Return existing share
        base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        share_url = f"{base_url}/share/{existing_share.share_token}"
        return ShareDocumentResponse(
            shareToken=existing_share.share_token,
            shareUrl=share_url,
            createdAt=existing_share.created_at.isoformat(),
            expiresAt=existing_share.expires_at.isoformat() if existing_share.expires_at else None
        )
    
    # Parse expires_at if provided
    expires_at = None
    if request.expiresAt:
        try:
            expires_at = datetime.fromisoformat(request.expiresAt.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid expiresAt format. Use ISO 8601 format."
            )
    
    # Create new share
    share = create_document_share(db, document_id, user_id, expires_at)
    
    # Generate share URL
    base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    share_url = f"{base_url}/share/{share.share_token}"
    
    return ShareDocumentResponse(
        shareToken=share.share_token,
        shareUrl=share_url,
        createdAt=share.created_at.isoformat(),
        expiresAt=share.expires_at.isoformat() if share.expires_at else None
    )

@app.get("/api/documents/{document_id}/share", response_model=ShareStatusResponse)
async def get_share_status_endpoint(
    document_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get share status for a document"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Verify document exists and belongs to user
    document = get_document_by_id(db, document_id, user_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Get active share if exists
    share = get_active_document_share(db, document_id)
    
    if not share:
        return ShareStatusResponse(
            hasActiveShare=False
        )
    
    # Generate share URL
    base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    share_url = f"{base_url}/share/{share.share_token}"
    
    return ShareStatusResponse(
        hasActiveShare=True,
        shareToken=share.share_token,
        shareUrl=share_url,
        createdAt=share.created_at.isoformat(),
        revokedAt=share.revoked_at.isoformat() if share.revoked_at else None,
        expiresAt=share.expires_at.isoformat() if share.expires_at else None
    )

@app.delete("/api/documents/{document_id}/share")
async def revoke_share_endpoint(
    document_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Revoke a share link for a document"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Revoke share
    success = revoke_document_share(db, document_id, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active share not found"
        )
    
    return {"message": "Share revoked successfully"}

@app.get("/api/documents/shared/{share_token}")
async def get_shared_document_info(
    share_token: str,
    db: Session = Depends(get_db)
):
    """Get document information by share token (no auth required)"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Get share
    share = get_document_share_by_token(db, share_token)
    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found or expired"
        )
    
    # Get document
    document = db.query(Document).filter(Document.id == share.document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Return document metadata (without storage_key for security)
    return {
        "id": str(document.id),
        "title": document.title,
        "sizeBytes": document.size_bytes,
        "mime": document.mime,
        "createdAt": document.created_at.isoformat()
    }

@app.get("/api/documents/shared/{share_token}/access")
async def get_shared_document_access(
    share_token: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get access to a shared document (requires auth, records access)"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Get share
    share = get_document_share_by_token(db, share_token)
    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found or expired"
        )
    
    # Record access (document will appear in user's list)
    record_share_access(db, str(share.id), user_id)
    
    # Get document
    document = db.query(Document).filter(Document.id == share.document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    try:
        # Create signed URL (expires in 1 hour)
        if not supabase:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Supabase storage not available"
            )
            
        signed_url_response = supabase.storage.from_('pdfs').create_signed_url(
            document.storage_key,
            expires_in=3600
        )
        
        if not signed_url_response.get('signedURL'):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create signed URL"
            )
        
        return {
            "url": signed_url_response['signedURL'],
            "lastViewedPage": document.last_viewed_page or 1,
            "title": document.title,
            "documentId": str(document.id)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create signed URL: {str(e)}"
        )

# Chat API endpoints
@app.post("/api/documents/{document_id}/chat/threads", response_model=ThreadResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_thread_endpoint(
    document_id: str,
    request: CreateThreadRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create a new chat thread for a document"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Verify document exists and user has access (ownership or shared)
    if not check_user_has_document_access(db, document_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Get document for title
    document = db.query(Document).filter(Document.id == uuid.UUID(document_id)).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Generate title from request or use default
    title = request.title or f"Chat about {document.title or 'document'}"
    
    return create_chat_thread(db, document_id, user_id, title)

@app.get("/api/documents/{document_id}/chat/threads", response_model=List[ThreadResponse])
async def list_chat_threads_endpoint(
    document_id: str,
    since: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List chat threads for a document. Works for owned and shared documents. Optionally filter by updated_at timestamp."""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Verify document exists and user has access (ownership or shared)
    if not check_user_has_document_access(db, document_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Parse since timestamp if provided
    since_datetime = None
    if since:
        try:
            since_datetime = datetime.fromisoformat(since.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid timestamp format. Use ISO 8601 format."
            )
    
    return list_chat_threads_since(db, document_id, user_id, since_datetime)

@app.get("/api/documents/{document_id}/pages/{page_number}/questions", response_model=PageQuestionsResponse)
async def get_page_questions_endpoint(
    document_id: str,
    page_number: int,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get questions asked on a specific page of a document"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Verify document exists and user has access (ownership or shared)
    if not check_user_has_document_access(db, document_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return get_page_questions(db, document_id, page_number, user_id, limit=None)

@app.get("/api/documents/{document_id}/questions/all", response_model=AllDocumentQuestionsResponse)
async def get_all_document_questions_endpoint(
    document_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get all questions for a document, grouped by page"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Verify document exists and user has access (ownership or shared)
    if not check_user_has_document_access(db, document_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return get_all_document_questions(db, document_id, user_id)

@app.get("/api/documents/{document_id}/questions/metadata", response_model=DocumentQuestionsMetadataResponse)
async def get_document_questions_metadata_endpoint(
    document_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get metadata about questions for a document (lastModified, total count, pages with questions)"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Verify document exists and user has access (ownership or shared)
    if not check_user_has_document_access(db, document_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return get_document_questions_metadata(db, document_id, user_id)

@app.get("/api/chat/threads/{thread_id}/messages", response_model=ThreadWithMessagesResponse)
async def get_chat_thread_messages_endpoint(
    thread_id: str,
    since: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get chat thread with its messages. Optionally filter by created_at timestamp."""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Parse since timestamp if provided
    since_datetime = None
    if since:
        try:
            since_datetime = datetime.fromisoformat(since.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid timestamp format. Use ISO 8601 format."
            )
    
    thread_with_messages = get_thread_messages_since(db, thread_id, user_id, since_datetime)
    if not thread_with_messages:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found"
        )
    
    return thread_with_messages

@app.post("/api/chat/threads/{thread_id}/messages")
async def send_chat_message(
    thread_id: str,
    request: CreateMessageRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Send a message to a chat thread and stream the AI response"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Get thread with messages to verify ownership and get document info
    thread_with_messages = get_chat_thread_with_messages(db, thread_id, user_id)
    if not thread_with_messages:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found"
        )
    
    # Get document info from thread
    thread = db.query(ChatThread).filter(ChatThread.id == uuid.UUID(thread_id)).first()
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found"
        )
    
    document = db.query(Document).filter(Document.id == thread.document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Get context type and chapter info
    # If contextType is None/undefined, use "none" to skip context entirely
    context_type = request.contextType if request.contextType is not None else None
    chapter_id = request.chapterId
    
    # Check questions limit before proceeding
    usage_data = get_user_usage(db, user_id)
    if not usage_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to determine usage limits"
        )
    
    if usage_data.questionsCount >= usage_data.limits.maxQuestionsPerMonth:
        raise LimitExceededError(
            limit_type="question",
            limit_value=usage_data.limits.maxQuestionsPerMonth,
            current_usage=usage_data.questionsCount,
            limit_period="month"
        )
    
    # Determine if we should use context at all
    # None means "no context", so we need to check if it's explicitly "none" or None
    use_context = request.pageContext is not None or (context_type and context_type != "none")
    
    # Save user message with context info
    user_message = create_chat_message(
        db, thread_id, "user", request.content, 
        page_context=request.pageContext,
        context_type=context_type or "none",
        chapter_id=chapter_id
    )
    
    # Prepare messages for AI (excluding the just-added user message)
    ai_messages = [
        {"role": msg.role, "content": msg.content}
        for msg in thread_with_messages.messages
    ]
    
    # Add the new user message
    ai_messages.append({"role": "user", "content": request.content})
    
    # If use_context is False, don't add any context to AI
    if not use_context:
        async def generate_response():
            """Generate streaming response without document context"""
            assistant_content = ""
            tokens_used = 0
            prompt_tokens = 0
            completion_tokens = 0
            
            try:
                # Stream AI response without PDF context
                async for chunk in ai_service.generate_response_stream_no_context(ai_messages):
                    if isinstance(chunk, dict) and chunk.get('type') == 'usage':
                        # Extract token usage info
                        usage_data = chunk.get('usage', {})
                        prompt_tokens = usage_data.get('prompt_tokens', 0)
                        completion_tokens = usage_data.get('completion_tokens', 0)
                        tokens_used = prompt_tokens + completion_tokens
                    elif isinstance(chunk, str):
                        assistant_content += chunk
                        yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
                
                # Save complete assistant message with token usage
                from models import ChatMessage as ChatMessageModel
                assistant_message_model = ChatMessageModel(
                    id=uuid.uuid4(),
                    thread_id=uuid.UUID(thread_id),
                    role="assistant",
                    content=assistant_content,
                    page_context=None,
                    context_type="none",
                    chapter_id=None,
                    tokens_used=tokens_used if tokens_used > 0 else None,
                    usage_tracked_at=datetime.utcnow() if tokens_used > 0 else None
                )
                db.add(assistant_message_model)
                
                # Update thread's updated_at timestamp
                thread = db.query(ChatThread).filter(ChatThread.id == uuid.UUID(thread_id)).first()
                if thread:
                    thread.updated_at = datetime.utcnow()
                
                db.commit()
                
                assistant_message = MessageResponse(
                    id=str(assistant_message_model.id),
                    role=assistant_message_model.role,
                    content=assistant_message_model.content,
                    pageContext=assistant_message_model.page_context,
                    contextType=assistant_message_model.context_type,
                    chapterId=str(assistant_message_model.chapter_id) if assistant_message_model.chapter_id else None,
                    createdAt=assistant_message_model.created_at.isoformat()
                )
                
                # Update usage counters
                if tokens_used > 0:
                    increment_user_usage(db, user_id, tokens=tokens_used, questions=1)
                
                # Send completion signal
                yield f"data: {json.dumps({'type': 'complete', 'messageId': assistant_message.id})}\n\n"
                
            except Exception as e:
                # Send error signal
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
        
        return StreamingResponse(
            generate_response(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
            }
        )
    
    # Get document view URL for AI context (only if we're using context)
    try:
        if not supabase:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Supabase storage not available"
            )
            
        signed_url_response = supabase.storage.from_('pdfs').create_signed_url(
            document.storage_key,
            expires_in=3600
        )
        
        if not signed_url_response.get('signedURL'):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create signed URL"
            )
        
        pdf_url = signed_url_response['signedURL']
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create signed URL: {str(e)}"
        )
    
    # Get current page context (use request pageContext or document's last viewed page)
    current_page = request.pageContext or document.last_viewed_page or 1
    
    # Get chapter info if context is chapter/section
    chapter_info = None
    if context_type in ["chapter", "section"] and chapter_id:
        from models import DocumentStructure
        chapter = db.query(DocumentStructure).filter(DocumentStructure.id == uuid.UUID(chapter_id)).first()
        if chapter:
            chapter_info = {
                "id": str(chapter.id),
                "title": chapter.title,
                "pageFrom": chapter.page_from,
                "pageTo": chapter.page_to
            }
    
    # Estimate total pages (this is a rough estimate, could be improved)
    total_pages = 100  # Default fallback
    
    async def generate_response():
        """Generate streaming response with context"""
        assistant_content = ""
        tokens_used = 0
        prompt_tokens = 0
        completion_tokens = 0
        
        try:
            # Stream AI response with context type
            async for chunk in ai_service.generate_response_stream(
                ai_messages, pdf_url, current_page, total_pages, context_type, chapter_info
            ):
                if isinstance(chunk, dict) and chunk.get('type') == 'usage':
                    # Extract token usage info
                    usage_data = chunk.get('usage', {})
                    prompt_tokens = usage_data.get('prompt_tokens', 0)
                    completion_tokens = usage_data.get('completion_tokens', 0)
                    tokens_used = prompt_tokens + completion_tokens
                elif isinstance(chunk, str):
                    assistant_content += chunk
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
            
            # Save complete assistant message with token usage
            from models import ChatMessage as ChatMessageModel
            assistant_message_model = ChatMessageModel(
                id=uuid.uuid4(),
                thread_id=uuid.UUID(thread_id),
                role="assistant",
                content=assistant_content,
                page_context=current_page,
                context_type=context_type,
                chapter_id=uuid.UUID(chapter_id) if chapter_id else None,
                tokens_used=tokens_used if tokens_used > 0 else None,
                usage_tracked_at=datetime.utcnow() if tokens_used > 0 else None
            )
            db.add(assistant_message_model)
            
            # Update thread's updated_at timestamp
            thread = db.query(ChatThread).filter(ChatThread.id == uuid.UUID(thread_id)).first()
            if thread:
                thread.updated_at = datetime.utcnow()
            
            db.commit()
            
            assistant_message = MessageResponse(
                id=str(assistant_message_model.id),
                role=assistant_message_model.role,
                content=assistant_message_model.content,
                pageContext=assistant_message_model.page_context,
                contextType=assistant_message_model.context_type,
                chapterId=str(assistant_message_model.chapter_id) if assistant_message_model.chapter_id else None,
                createdAt=assistant_message_model.created_at.isoformat()
            )
            
            # Update usage counters
            if tokens_used > 0:
                # Check token limit before incrementing
                allowed, error_msg = check_tokens_limit(db, user_id, tokens_used)
                if not allowed:
                    # Already exceeded, but we've used the tokens, so just log it
                    pass
                increment_user_usage(db, user_id, tokens=tokens_used, questions=1)
            
            # Send completion signal
            yield f"data: {json.dumps({'type': 'complete', 'messageId': assistant_message.id})}\n\n"
            
        except Exception as e:
            # Send error signal
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_response(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        }
    )

# Document structure endpoints
@app.post("/api/documents/{document_id}/extract-structure", response_model=DocumentStructureResponse)
async def extract_document_structure(
    document_id: str,
    request: ExtractStructureRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Extract document structure (TOC) from PDF"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Verify document exists and belongs to user
    document = get_document_by_id(db, document_id, user_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if structure already exists
    existing_structure = get_document_structure(db, document_id)
    if existing_structure and not request.force:
        return existing_structure
    
    try:
        # Get document view URL
        if not supabase:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Supabase storage not available"
            )
        
        signed_url_response = supabase.storage.from_('pdfs').create_signed_url(
            document.storage_key,
            expires_in=3600
        )
        
        if not signed_url_response.get('signedURL'):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create signed URL"
            )
        
        pdf_url = signed_url_response['signedURL']
        
        # Extract outline from PDF
        structure_items = await extract_pdf_outline(pdf_url)
        
        if not structure_items:
            # Return empty structure response
            return DocumentStructureResponse(
                documentId=document_id,
                items=[]
            )
        
        # Save structure to database
        save_document_structure(db, document_id, structure_items)
        
        # Return saved structure
        return get_document_structure(db, document_id) or DocumentStructureResponse(
            documentId=document_id,
            items=[]
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract document structure: {str(e)}"
        )

@app.get("/api/documents/{document_id}/structure", response_model=DocumentStructureResponse)
async def get_document_structure_endpoint(
    document_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get document structure. Works for owned and shared documents."""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Verify document exists and user has access (ownership or shared)
    if not check_user_has_document_access(db, document_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    structure = get_document_structure(db, document_id)
    
    if not structure:
        # Return empty structure
        return DocumentStructureResponse(
            documentId=document_id,
            items=[]
        )
    
    return structure

@app.get("/api/documents/{document_id}/pages/{page_number}/chapter")
async def get_chapter_for_page(
    document_id: str,
    page_number: int,
    level: Optional[int] = None,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get chapter/section information for a specific page. Works for owned and shared documents."""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Verify document exists and user has access (ownership or shared)
    if not check_user_has_document_access(db, document_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # If level is specified, get structure at that level, otherwise get the most specific one
    if level is not None:
        from repository import get_nearest_chapter
        chapter = get_nearest_chapter(db, document_id, page_number, level)
    else:
        chapter = get_chapter_by_page(db, document_id, page_number)
    
    if not chapter:
        return None
    
    return {
        "id": str(chapter.id),
        "title": chapter.title,
        "level": chapter.level,
        "pageFrom": chapter.page_from,
        "pageTo": chapter.page_to
    }

# User plan and usage endpoints
@app.get("/api/user/plan", response_model=UserPlanResponse)
async def get_user_plan_endpoint(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get current user's plan"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    plan = get_user_plan(db, user_id)
    if not plan:
        # Create default beta plan if none exists
        plan = set_user_plan(db, user_id, 'beta')
    
    return UserPlanResponse(
        id=str(plan.id),
        userId=str(plan.user_id),
        planType=plan.plan_type,
        status=plan.status,
        startedAt=plan.started_at.isoformat(),
        expiresAt=plan.expires_at.isoformat() if plan.expires_at else None
    )

@app.post("/api/user/plan", response_model=UserPlanResponse)
async def set_user_plan_endpoint(
    request: SetUserPlanRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Set or change user's plan"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    try:
        plan = set_user_plan(db, user_id, request.planType)
        return UserPlanResponse(
            id=str(plan.id),
            userId=str(plan.user_id),
            planType=plan.plan_type,
            status=plan.status,
            startedAt=plan.started_at.isoformat(),
            expiresAt=plan.expires_at.isoformat() if plan.expires_at else None
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@app.get("/api/user/usage", response_model=UserUsageResponse)
async def get_user_usage_endpoint(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get current user's resource usage"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    usage_data = get_user_usage(db, user_id)
    if not usage_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to retrieve usage data"
        )
    
    return usage_data

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
