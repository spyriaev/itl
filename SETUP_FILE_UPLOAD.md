# File Upload Feature Setup Guide

This guide explains how to set up and run the PDF file upload feature for the AI Reader project.

## Overview

The file upload feature allows users to:
- Upload PDF files via drag & drop or file selector
- Track upload progress in real-time
- View a list of uploaded documents
- Store files in Supabase Storage with metadata in PostgreSQL

## Architecture

```
Web Client → Supabase Storage (file upload)
          → Backend API (metadata tracking)
          → PostgreSQL Database (document records)
```

## Prerequisites

- Node.js 18+ and npm
- Java 17
- PostgreSQL (via Supabase)
- Supabase account and project

## Step 1: Database Setup

1. Apply the new migration for anonymous uploads:

```bash
cd supabase
supabase db push
```

Or manually apply `supabase/migrations/0003_anonymous_uploads.sql` to your database.

This migration:
- Makes `owner_id` nullable in `documents` table
- Adds `uploaded_by_session` field for tracking
- Updates indexes

## Step 2: Supabase Storage Configuration

Ensure the `pdfs` storage bucket is configured (already done via `0002_storage.sql`):
- Bucket name: `pdfs`
- Access: Private
- File size limit: 200MB
- Allowed MIME types: `application/pdf`

Get your Supabase credentials:
- Project URL: `https://sjrfppeisxmglrozufoy.supabase.co`
- Anon Key: From Supabase Dashboard → Project Settings → API
- Service Key: From Supabase Dashboard → Project Settings → API (service_role)
- Database Password: From Supabase Dashboard → Project Settings → Database

## Step 3: Backend Server Setup

1. Navigate to server directory:
```bash
cd server
```

2. Create `.env` file:
```bash
PORT=8080
DATABASE_URL=jdbc:postgresql://db.sjrfppeisxmglrozufoy.supabase.co:5432/postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password_here
SUPABASE_URL=https://sjrfppeisxmglrozufoy.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
```

3. Start the server:
```bash
./gradlew run
```

The server will:
- Connect to PostgreSQL database
- Initialize tables if needed
- Start on http://localhost:8080
- Expose API endpoints:
  - `GET /health` - Health check
  - `POST /api/documents` - Create document metadata
  - `GET /api/documents` - List documents

## Step 4: Web Client Setup

1. Navigate to web directory:
```bash
cd web
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
VITE_SUPABASE_URL=https://sjrfppeisxmglrozufoy.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_API_URL=http://localhost:8080
```

4. Start development server:
```bash
npm run dev
```

The web app will start on http://localhost:5173

## Testing the Feature

1. Open http://localhost:5173 in your browser
2. You should see:
   - Upload section with drag & drop zone
   - Document list (empty initially)

3. Upload a PDF file:
   - Click the upload zone or drag & drop a PDF file
   - Watch the progress bar
   - See the file appear in the document list

4. Verify in database:
```sql
SELECT * FROM documents ORDER BY created_at DESC LIMIT 10;
```

5. Verify in Supabase Storage:
   - Go to Supabase Dashboard → Storage → pdfs bucket
   - You should see files in the `uploads/` folder

## API Testing with curl

### Create Document Metadata
```bash
curl -X POST http://localhost:8080/api/documents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Document",
    "storageKey": "uploads/test.pdf",
    "sizeBytes": 1024000,
    "mime": "application/pdf",
    "checksumSha256": "abc123..."
  }'
```

### List Documents
```bash
curl http://localhost:8080/api/documents
```

## Troubleshooting

### Server won't start
- Check Java version: `java -version` (should be 17+)
- Verify database connection in `.env`
- Check logs for database connection errors

### Upload fails
- Check browser console for errors
- Verify Supabase credentials in web `.env`
- Ensure `pdfs` bucket exists in Supabase Storage
- Check CORS settings allow your origin

### Files upload but don't appear in list
- Check backend server is running
- Verify `VITE_API_URL` in web `.env`
- Check browser network tab for API call errors
- Verify database has records: `SELECT * FROM documents;`

### Database connection issues
- Verify `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD`
- Check Supabase database is running
- Ensure IP is allowlisted in Supabase (if connection pooling enabled)

## File Structure

```
server/
├── src/main/kotlin/com/example/reader/
│   ├── Application.kt              # Main server with API endpoints
│   ├── models/Document.kt          # Database model and DTOs
│   └── repository/DocumentRepository.kt  # Database operations

web/
├── src/
│   ├── lib/supabase.ts            # Supabase client setup
│   ├── services/uploadService.ts  # Upload workflow logic
│   └── ui/
│       ├── App.tsx                # Main app component
│       └── components/
│           ├── FileUpload.tsx     # Upload component
│           └── DocumentList.tsx   # Document list component

supabase/
└── migrations/
    ├── 0001_init.sql              # Initial schema
    ├── 0002_storage.sql           # Storage bucket setup
    └── 0003_anonymous_uploads.sql # Anonymous upload support
```

## Next Steps

After verifying the file upload feature works:

1. **Add Authentication**
   - Integrate Supabase Auth
   - Associate documents with user accounts
   - Add RLS policies

2. **PDF Processing**
   - Extract text from PDFs
   - Generate chunks for RAG
   - Create embeddings

3. **AI Integration**
   - Add chat interface
   - Implement RAG-based Q&A
   - Stream AI responses

4. **Mobile Apps**
   - Port file upload to iOS (Swift)
   - Port file upload to Android (Kotlin)

## Security Notes (MVP)

⚠️ **Current implementation is for MVP/development only:**
- No authentication (anonymous uploads)
- All documents are publicly listable
- No user-based access control
- No file deletion capability

**For production:**
- Add Supabase Auth
- Implement Row Level Security (RLS) policies
- Add user-based document ownership
- Implement file deletion with proper authorization
- Add rate limiting
- Validate file content (not just MIME type)


