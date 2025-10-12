# Ktor Server

Kotlin backend server using Ktor framework with PostgreSQL database integration.

## Features

- REST API for document metadata management
- PostgreSQL database with Exposed ORM
- CORS support for web client
- Health check endpoint
- Document upload tracking
- Document listing with pagination

## Setup

1. Ensure Java 17 is installed

2. Create `.env` file (or set environment variables):
```
PORT=8080
DATABASE_URL=jdbc:postgresql://db.sjrfppeisxmglrozufoy.supabase.co:5432/postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password_here
SUPABASE_URL=https://sjrfppeisxmglrozufoy.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
```

3. Run the server:
```bash
./gradlew run
```

Server runs on http://localhost:8080

## API Endpoints

### Health Check
- `GET /health` - Returns server status

### Documents
- `POST /api/documents` - Create document metadata
  - Body: `{ title, storageKey, sizeBytes, mime, checksumSha256 }`
  - Returns: Document object with ID
- `GET /api/documents?limit=50&offset=0` - List documents
  - Query params: `limit` (default 50), `offset` (default 0)
  - Returns: Array of document objects

## Environment Variables

- `PORT` - Server port (default: 8080)
- `DATABASE_URL` - PostgreSQL JDBC connection string
- `DATABASE_USER` - Database username
- `DATABASE_PASSWORD` - Database password
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key

## Database

The server uses PostgreSQL with Exposed ORM. Tables are defined in `models/Document.kt`:
- `documents` - Stores PDF metadata (title, storage key, size, mime type, checksum, status)

Database migrations are managed in `supabase/migrations/`

