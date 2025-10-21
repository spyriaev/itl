# Innesi Monorepo

Monorepo for native iOS (Swift), Android (Kotlin), Web (React), Python server (FastAPI), and Supabase schema.

## Structure

```
ios/          # iOS app (Swift + XcodeGen)
android/      # Android app (Kotlin)
web/          # Web app (React + Vite)
server/       # Backend server (Python + FastAPI)
supabase/     # Database schema and migrations
```

## Prerequisites
- Node.js LTS, pnpm or npm
- Python 3.11+ (for FastAPI server)
- Android Studio / Xcode
- Supabase CLI (for database management)
- Heroku CLI (optional, for server deploy)

## Quick Start

🚀 **NEW: Automated Setup Scripts Available!**

See **[QUICKSTART.md](QUICKSTART.md)** for the fastest way to get started.

Or use the automated startup script:
```bash
# Setup .env files first (see QUICKSTART.md)
./start-dev.sh  # Starts both backend and web client
```

### 1. Clone and Setup Environment

```bash
# Clone the repository
git clone <repository-url>
cd itl

# Copy environment files
cp server/env.example server/.env
cp web/env.example web/.env
# Edit .env files with your Supabase credentials
```

### 2. Supabase Setup

This project uses **Supabase Cloud** database. The database and migrations are already set up.

For local development with Supabase:
```bash
# Start local Supabase (optional)
supabase start

# Apply migrations to local instance
supabase db reset
```

See `supabase/README.md` for more details about database schema and migrations.

### 3. Start Development Servers

**Web App:**
```bash
cd web
npm install
npm run dev
# Access at http://localhost:5173
```

**Backend Server:**
```bash
cd server
./run-dev.sh
# Server runs on http://localhost:8080
```

**Mobile Apps:**
- **Android**: Open `android/` in Android Studio
- **iOS**: Generate Xcode project with `cd ios && xcodegen` then open in Xcode

## Environment Variables

Each component has its own `.env` file:

- **Root** (`/.env`): General Supabase configuration
- **Server** (`/server/.env`): Backend API configuration
- **Web** (`/web/.env`): Frontend configuration (uses `VITE_` prefix)

All `.env.example` files contain the required variables.

## Database

**Supabase Project:**
- Project: ITL
- Region: East US (North Virginia)
- API URL: `https://sjrfppeisxmglrozufoy.supabase.co`

**Schema:**
- `documents` table: PDF metadata and upload tracking
- `document_chunks` table: Text chunks with vector embeddings for RAG
- `pdfs` storage bucket: Private PDF file storage

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Python, FastAPI, SQLAlchemy
- **Database**: Supabase (PostgreSQL + pgvector)
- **Mobile**: Swift (iOS), Kotlin (Android)
- **Storage**: Supabase Storage

## Project Details

Per-project documentation:
- [Supabase Setup](supabase/README.md)
- [Server](server/README.md)
- [Web](web/README.md)
- [iOS](ios/README.md)
- [Android](android/README.md)
