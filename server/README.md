# AI Reader Server (Python FastAPI)

A Python FastAPI server for the AI Reader application that handles document management with JWT authentication, PostgreSQL database integration, and AI-powered chat features.

## Features

- **FastAPI Framework**: Modern, fast web framework for building APIs
- **JWT Authentication**: Secure authentication using Supabase JWT tokens
- **PostgreSQL Database**: Database operations using SQLAlchemy ORM
- **Document Management**: Create and list documents with file validation
- **AI Chat System**: Chat with documents using AI (DeepSeek or GigaChat)
- **Mock AI Service**: Test without API keys (development mode)
- **CORS Support**: Cross-origin resource sharing enabled
- **Health Checks**: Database connectivity monitoring

## Prerequisites

- Python 3.11 or higher
- PostgreSQL database (Supabase)
- Supabase JWT secret

## Quick Start

1. **Clone and navigate to server directory**:
   ```bash
   cd server
   ```

2. **Create virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   # Use the automated installer (recommended)
   ./install-deps.sh
   
   # Or install manually
   pip install -r requirements.txt
   ```

4. **Configure environment**:
   ```bash
   cp env.example .env
   # Edit .env with your actual values
   ```

5. **Run the server**:
   ```bash
   ./run-dev.sh
   # Or manually:
   uvicorn main:app --reload --port 8080
   ```

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Server Configuration
PORT=8080

# PostgreSQL Database (Supabase)
DATABASE_URL=postgresql://postgres:your_password@db.sjrfppeisxmglrozufoy.supabase.co:6543/postgres

# Supabase Configuration
SUPABASE_URL=https://sjrfppeisxmglrozufoy.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here

# Authentication (Required for JWT validation)
SUPABASE_JWT_SECRET=your_jwt_secret_here

# AI Service Configuration
AI_PROVIDER=deepseek  # or "gigachat"
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_API_BASE=https://api.deepseek.com

# Mock AI Service (for testing without API keys)
USE_MOCK_AI=false  # Set to "true" to use mock service
```

See `env.example` for detailed configuration.

## API Endpoints

### Health Check
- **GET** `/health` - Check server and database status

### Document Management
- **POST** `/api/documents` - Create a new document (requires authentication)
- **GET** `/api/documents` - List user documents with pagination (requires authentication)
- **GET** `/api/documents/{id}/view` - Get signed URL for viewing document
- **PATCH** `/api/documents/{id}/progress` - Update viewing progress

### AI Chat
- **POST** `/api/documents/{id}/chat/threads` - Create chat thread
- **GET** `/api/documents/{id}/chat/threads` - List chat threads
- **GET** `/api/chat/threads/{id}/messages` - Get thread with messages
- **POST** `/api/chat/threads/{id}/messages` - Send message and stream AI response
- **GET** `/api/documents/{id}/pages/{page}/questions` - Get questions for page

### Document Structure
- **POST** `/api/documents/{id}/extract-structure` - Extract document TOC
- **GET** `/api/documents/{id}/structure` - Get document structure
- **GET** `/api/documents/{id}/pages/{page}/chapter` - Get chapter info for page

## Authentication

The API uses JWT Bearer tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Development

### Project Structure

```
server/
├── main.py                  # FastAPI application and routes
├── auth.py                  # JWT authentication logic
├── models.py                # SQLAlchemy models and Pydantic schemas
├── repository.py            # Database operations
├── database.py              # Database connection setup
├── ai_service.py            # Real AI service (DeepSeek/GigaChat)
├── ai_service_mock.py       # Mock AI service for testing
├── pdf_utils.py             # PDF processing utilities
├── requirements.txt         # Python dependencies
├── run-dev.sh              # Development run script
├── env.example             # Environment variables template
├── MOCK_AI_SERVICE.md      # Mock service documentation
└── README.md               # This file
```

### Dependencies

- **FastAPI**: Web framework
- **Uvicorn**: ASGI server
- **SQLAlchemy**: ORM for database operations
- **psycopg2-binary**: PostgreSQL adapter
- **python-jose**: JWT token handling
- **Pydantic**: Data validation and serialization
- **openai**: OpenAI API client
- **PyMuPDF**: PDF processing
- **httpx**: Async HTTP client

## Mock AI Service

The server includes a mock AI service for testing without API keys. This is useful for development and demonstration.

### Using Mock AI Service

1. **Set environment variable**:
   ```bash
   export USE_MOCK_AI=true
   ```

2. **Or update `.env` file**:
   ```bash
   USE_MOCK_AI=true
   ```

3. **Restart the server**

The mock service will:
- ✅ Generate realistic responses without real API calls
- ✅ Support streaming responses (word-by-word)
- ✅ Work without internet connection
- ✅ Not consume API quotas

### Documentation

See `MOCK_AI_SERVICE.md` for detailed documentation on the mock service.

### Running Tests

```bash
# Test server setup
python3 test_server.py

# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest
```

## Production Deployment

For production deployment:

1. **Set production environment variables**
2. **Use a production ASGI server**:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8080 --workers 4
   ```
3. **Configure reverse proxy** (nginx/Apache)
4. **Set up SSL/TLS certificates**
5. **Configure database connection pooling**

## Troubleshooting

### PostgreSQL Installation Issues (macOS)

If you encounter `pg_config executable not found` errors:

```bash
# Install PostgreSQL development headers
brew install postgresql

# Or use the automated installer
./install-deps.sh
```

### Database Connection Issues
- Verify DATABASE_URL format: `postgresql://user:password@host:port/database`
- Check network connectivity to Supabase
- Ensure database credentials are correct

### Authentication Issues
- Verify SUPABASE_JWT_SECRET is set correctly
- Check JWT token format and expiration
- Ensure Authorization header format: `Bearer <token>`

### Python Version Issues
- Ensure Python 3.11+ is installed
- Check virtual environment activation
- Verify all dependencies are installed correctly
