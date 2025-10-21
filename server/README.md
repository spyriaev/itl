# AI Reader Server (Python FastAPI)

A Python FastAPI server for the AI Reader application that handles document management with JWT authentication and PostgreSQL database integration.

## Features

- **FastAPI Framework**: Modern, fast web framework for building APIs
- **JWT Authentication**: Secure authentication using Supabase JWT tokens
- **PostgreSQL Database**: Database operations using SQLAlchemy ORM
- **Document Management**: Create and list documents with file validation
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

# Authentication (Required for JWT validation)
SUPABASE_JWT_SECRET=your_jwt_secret_here
```

## API Endpoints

### Health Check
- **GET** `/health` - Check server and database status

### Document Management
- **POST** `/api/documents` - Create a new document (requires authentication)
- **GET** `/api/documents` - List user documents with pagination (requires authentication)

## Authentication

The API uses JWT Bearer tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Development

### Project Structure

```
server/
├── main.py              # FastAPI application and routes
├── auth.py              # JWT authentication logic
├── models.py            # SQLAlchemy models and Pydantic schemas
├── repository.py        # Database operations
├── database.py          # Database connection setup
├── requirements.txt     # Python dependencies
├── run-dev.sh          # Development run script
├── env.example         # Environment variables template
└── README.md           # This file
```

### Dependencies

- **FastAPI**: Web framework
- **Uvicorn**: ASGI server
- **SQLAlchemy**: ORM for database operations
- **psycopg2-binary**: PostgreSQL adapter
- **python-jose**: JWT token handling
- **Pydantic**: Data validation and serialization

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
