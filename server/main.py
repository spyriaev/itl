from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import os
import logging
import json
import asyncio
import uuid

from database import get_db, test_database_connection, engine, supabase
from auth import get_current_user_id
from models import (
    CreateDocumentRequest, DocumentResponse, Base, UpdateProgressRequest,
    CreateThreadRequest, ThreadResponse, CreateMessageRequest, MessageResponse,
    ThreadWithMessagesResponse, Document, ChatThread
)
from repository import (
    create_document, list_documents, get_document_by_id, update_document_progress,
    create_chat_thread, list_chat_threads, get_chat_thread_with_messages,
    create_chat_message, update_thread_title
)
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
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail}
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
    
    # Validate file size (200MB limit)
    if request.size_bytes > 200 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 200MB limit"
        )
    
    return create_document(db, request, user_id)

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
    """Get signed URL for viewing a document"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    # Get document and verify ownership
    document = get_document_by_id(db, document_id, user_id)
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
    
    # Update progress
    success = update_document_progress(db, document_id, request.page, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return {"message": "Progress updated successfully"}

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
    
    # Verify document exists and belongs to user
    document = get_document_by_id(db, document_id, user_id)
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
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List chat threads for a document"""
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
    
    return list_chat_threads(db, document_id, user_id)

@app.get("/api/chat/threads/{thread_id}/messages", response_model=ThreadWithMessagesResponse)
async def get_chat_thread_messages(
    thread_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get chat thread with its messages"""
    # Check database connectivity
    if not test_database_connection():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    thread_with_messages = get_chat_thread_with_messages(db, thread_id, user_id)
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
    
    # Save user message
    user_message = create_chat_message(
        db, thread_id, "user", request.content, request.pageContext
    )
    
    # Get document view URL for AI context
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
    
    # Prepare messages for AI (excluding the just-added user message)
    ai_messages = [
        {"role": msg.role, "content": msg.content}
        for msg in thread_with_messages.messages
    ]
    
    # Add the new user message
    ai_messages.append({"role": "user", "content": request.content})
    
    # Get current page context (use request pageContext or document's last viewed page)
    current_page = request.pageContext or document.last_viewed_page or 1
    
    # Estimate total pages (this is a rough estimate, could be improved)
    total_pages = 100  # Default fallback
    
    async def generate_response():
        """Generate streaming response"""
        assistant_content = ""
        
        try:
            # Stream AI response
            async for chunk in ai_service.generate_response_stream(
                ai_messages, pdf_url, current_page, total_pages
            ):
                assistant_content += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
            
            # Save complete assistant message
            assistant_message = create_chat_message(
                db, thread_id, "assistant", assistant_content, current_page
            )
            
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

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
