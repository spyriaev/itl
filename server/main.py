from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
import os
import logging

from database import get_db, test_database_connection, engine
from auth import get_current_user_id
from models import CreateDocumentRequest, DocumentResponse, Base
from repository import create_document, list_documents


# Create FastAPI app
app = FastAPI(title="AI Reader API", version="1.0.0")

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

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
