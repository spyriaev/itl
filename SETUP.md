# ITL Project Setup Guide

## ✅ Completed Setup

### 1. Supabase Cloud Database

**Project Configuration:**
- ✅ Created Supabase cloud project: **ITL**
- ✅ Project Reference ID: `sjrfppeisxmglrozufoy`
- ✅ Region: East US (North Virginia)
- ✅ API URL: `https://sjrfppeisxmglrozufoy.supabase.co`

### 2. Database Migrations

✅ Successfully applied migrations:
- **0001_init.sql** - Database schema with tables and indexes
  - `documents` table for PDF metadata
  - `document_chunks` table for RAG with vector embeddings
  - Extensions: pgcrypto, uuid-ossp, vector
  - Indexes for performance optimization
  
- **0002_storage.sql** - Storage bucket configuration
  - Created `pdfs` bucket (private)

### 3. Environment Configuration

✅ Created `.env` files for all components:

**Root** (`/.env`)
```bash
SUPABASE_URL=https://sjrfppeisxmglrozufoy.supabase.co
SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SUPABASE_PROJECT_REF=sjrfppeisxmglrozufoy
```

**Server** (`/server/.env`)
```bash
PORT=8080
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**Web** (`/web/.env`)
```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

✅ Created `.env.example` files for documentation

### 4. Project Configuration

✅ Updated `supabase/config.toml` with:
- Correct project reference ID
- Storage bucket configuration for PDFs
- Modern Supabase CLI configuration format

✅ Updated `.gitignore` to protect `.env` files (while allowing `.env.example`)

### 5. Documentation

✅ Created comprehensive documentation:
- `/supabase/README.md` - Database schema and migration guide
- Updated `/README.md` - Complete project setup guide
- `/SETUP.md` - This file with setup summary

## 🚀 Next Steps

### Development Setup

1. **Install dependencies:**
   ```bash
   # Web
   cd web && npm install
   
   # Server (Gradle wrapper already configured)
   cd server && ./gradlew build
   ```

2. **Start development servers:**
   ```bash
   # Web (runs on http://localhost:5173)
   cd web && npm run dev
   
   # Server (runs on http://localhost:8080)
   cd server && ./gradlew run
   ```

3. **Verify Supabase connection:**
   - Check `https://sjrfppeisxmglrozufoy.supabase.co/rest/v1/` is accessible
   - Test authentication endpoints
   - Verify storage bucket access

### Production Deployment

1. **Server Deployment:**
   - Deploy to Heroku, Railway, or other platforms
   - Set environment variables from `.env` file
   - Configure CORS for your domains

2. **Web Deployment:**
   - Build: `npm run build` in `/web`
   - Deploy to Vercel, Netlify, or static hosting
   - Set VITE_* environment variables

3. **Mobile Apps:**
   - Update Supabase keys in app configurations
   - Configure OAuth redirect URLs in Supabase dashboard

## 📚 Useful Resources

- Supabase Dashboard: https://supabase.com/dashboard/project/sjrfppeisxmglrozufoy
- Supabase Docs: https://supabase.com/docs
- Vector/pgvector: https://supabase.com/docs/guides/ai/vector-embeddings

## 🔐 Security Notes

⚠️ **Important:**
- Never commit `.env` files to version control
- Use `SUPABASE_SERVICE_ROLE_KEY` only on the server
- Use `SUPABASE_ANON_KEY` for client applications
- Configure Row Level Security (RLS) policies in Supabase for production
- Set up proper authentication before going live

## 📞 Support

For Supabase CLI issues:
```bash
supabase --help
supabase db --help
```

For project-specific questions, see individual README files in each directory.

