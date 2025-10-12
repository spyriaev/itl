# Web (React + Vite + TypeScript)

React + Vite + TypeScript application for AI Reader with PDF upload functionality.

## Features

- PDF file upload with drag & drop
- Real-time upload progress tracking
- Document list with metadata
- Integration with Supabase Storage
- Modern, responsive UI

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file with required variables:
```
VITE_SUPABASE_URL=https://sjrfppeisxmglrozufoy.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_API_URL=http://localhost:8080
```

3. Start development server:
```bash
npm run dev
```

Application runs on http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## Environment Variables

- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous/public API key
- `VITE_API_URL` - Backend API URL (default: http://localhost:8080)

## Architecture

- **UI Components**: React components in `src/ui/components/`
- **Services**: Upload service handles file validation, storage, and metadata
- **Supabase Client**: Direct integration with Supabase Storage for file uploads
- **API Integration**: REST API calls to backend for metadata tracking
