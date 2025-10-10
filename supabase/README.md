# Supabase Configuration

## Cloud Setup

This project uses Supabase cloud database with the following configuration:

- **Project Name**: ITL
- **Project Reference**: `sjrfppeisxmglrozufoy`
- **Region**: East US (North Virginia)
- **API URL**: `https://sjrfppeisxmglrozufoy.supabase.co`

## Database Schema

The database consists of two main tables:

### 1. `documents` table
Stores metadata about uploaded PDF documents:
- `id` (uuid, primary key)
- `owner_id` (uuid, references auth.users)
- `title` (text)
- `storage_key` (text, reference to file in storage)
- `size_bytes` (bigint)
- `mime` (text)
- `checksum_sha256` (text)
- `status` (text, default 'created')
- `created_at` (timestamptz)

### 2. `document_chunks` table
Stores text chunks with embeddings for RAG (Retrieval Augmented Generation):
- `id` (uuid, primary key)
- `doc_id` (uuid, references documents)
- `section_id` (uuid, optional)
- `page_from`, `page_to` (int)
- `chunk_order` (int)
- `text` (text)
- `embedding` (vector(1024))
- `created_at` (timestamptz)

## Storage

- **Bucket**: `pdfs`
- **Access**: Private (requires authentication)
- **File Size Limit**: 200MB
- **Allowed MIME Types**: `application/pdf`

## Migrations

Migrations are located in the `migrations/` directory:

1. **0001_init.sql** - Creates tables, indexes, and enables necessary extensions
2. **0002_storage.sql** - Creates the storage bucket for PDFs

### Running Migrations

To apply migrations to the cloud database:

```bash
# Set your access token
export SUPABASE_ACCESS_TOKEN="your_token_here"

# Push migrations
supabase db push
```

## Local Development

To run Supabase locally:

```bash
# Start local Supabase
supabase start

# Apply migrations
supabase db reset

# Stop local instance
supabase stop
```

## Environment Variables

Required environment variables are documented in `.env.example` files:

- Root: `/.env.example`
- Server: `/server/.env.example`
- Web: `/web/.env.example`

**Note**: Never commit `.env` files to version control!

## Useful Commands

```bash
# Check project status
supabase status

# View project details
supabase projects list

# Get API keys
supabase projects api-keys --project-ref sjrfppeisxmglrozufoy

# Create new migration
supabase migration new migration_name

# Diff remote and local schemas
supabase db diff
```

