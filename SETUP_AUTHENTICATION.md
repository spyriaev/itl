# Authentication Setup Guide

Quick guide to set up authentication for the AI Reader application.

## Prerequisites

- Supabase project set up (already done)
- Backend and frontend code deployed (Epic 1 complete)
- Database migrations ready

## Step 1: Configure Backend Environment

1. Navigate to server directory:
```bash
cd server
```

2. Copy environment example:
```bash
cp env.example .env
```

3. Edit `.env` and set the JWT secret:
```bash
# Get JWT secret from Supabase Dashboard
# Settings → API → JWT Settings → JWT Secret
SUPABASE_JWT_SECRET=your_actual_jwt_secret_here
```

**Where to find JWT Secret**:
1. Go to: https://supabase.com/dashboard/project/sjrfppeisxmglrozufoy
2. Navigate to: Settings → API
3. Scroll down to "JWT Settings"
4. Copy the "JWT Secret" value

## Step 2: Apply Database Migrations

### Option A: Using Supabase CLI (Recommended)
```bash
cd supabase
supabase db push
```

### Option B: Manual SQL Execution

**Apply RLS Policies** (if not already applied):
```bash
psql -h db.sjrfppeisxmglrozufoy.supabase.co -U postgres -d postgres \
  -f migrations/20251010074014_rls_policies.sql
```

**Apply owner_id NOT NULL Migration**:
```bash
psql -h db.sjrfppeisxmglrozufoy.supabase.co -U postgres -d postgres \
  -f migrations/0005_require_owner_id.sql
```

**⚠️ Warning**: Migration `0005_require_owner_id.sql` will delete documents with `NULL owner_id`. Back up your database first if you have important anonymous uploads!

## Step 3: Enable Supabase Auth Providers

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/sjrfppeisxmglrozufoy
2. Navigate to: Authentication → Providers

### Enable Email/Password Auth
- Should be enabled by default
- Configure:
  - ✅ Enable email confirmations (optional, recommended for production)
  - ✅ Enable email change confirmations
  - Set site URL: `http://localhost:5173` (development)

### Enable Google OAuth (Optional)

1. **Create Google OAuth Credentials**:
   - Go to: https://console.cloud.google.com
   - Create a new project (or use existing)
   - Go to: APIs & Services → Credentials
   - Click "Create Credentials" → OAuth 2.0 Client ID
   - Configure consent screen if prompted
   - Application type: "Web application"
   - Authorized redirect URIs: 
     ```
     https://sjrfppeisxmglrozufoy.supabase.co/auth/v1/callback
     ```
   - Copy the Client ID and Client Secret

2. **Configure in Supabase**:
   - In Supabase Dashboard → Authentication → Providers
   - Click on "Google"
   - Toggle "Enable Sign in with Google"
   - Paste Client ID
   - Paste Client Secret
   - Save

## Step 4: Install Backend Dependencies

```bash
cd server
./gradlew build
```

This will download the new JJWT libraries.

## Step 5: Install Frontend Dependencies

The frontend already has all required dependencies (`@supabase/supabase-js`), but run this to be sure:

```bash
cd web
npm install
```

## Step 6: Start Development Servers

### Backend
```bash
cd server
./gradlew run
# Or use the dev script
./run-dev.sh
```

Server will start on: http://localhost:8080

### Frontend
```bash
cd web
npm run dev
# Or use the dev script
./run-dev.sh
```

Frontend will start on: http://localhost:5173

## Step 7: Test Authentication

1. Open browser: http://localhost:5173
2. You should see the authentication modal (not logged in)
3. Click "Sign Up" tab
4. Enter email and password
5. Click "Sign Up"
6. If email confirmation is enabled, check your email
7. Click confirmation link
8. You'll be redirected back and logged in
9. Try uploading a PDF
10. Sign out and sign back in
11. Verify you only see your own documents

## Step 8: Test Google OAuth (If Configured)

1. Open browser: http://localhost:5173
2. Click "Sign In" tab
3. Click "Continue with Google"
4. Authorize the app
5. You should be redirected back and logged in

## Verification Checklist

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Authentication modal appears when not logged in
- [ ] Sign up works with email/password
- [ ] Sign in works with email/password
- [ ] Google OAuth works (if configured)
- [ ] Sign out works
- [ ] File upload requires authentication
- [ ] Uploaded files appear in document list
- [ ] After sign out and sign in as different user, previous user's documents not visible
- [ ] Backend logs show JWT validation
- [ ] No console errors in browser

## Troubleshooting

### "SUPABASE_JWT_SECRET environment variable is not set"
- Check that `.env` file exists in `server/` directory
- Verify JWT secret is set correctly
- Restart backend server

### "Failed to fetch documents"
- Check backend is running
- Check `VITE_API_URL` in `web/.env` (should be `http://localhost:8080`)
- Check browser console for errors
- Verify JWT token is being sent (check Network tab)

### Google OAuth redirect loop
- Verify callback URL in Google Console matches: `https://sjrfppeisxmglrozufoy.supabase.co/auth/v1/callback`
- Check Client ID and Secret are correct in Supabase
- Clear browser cookies and try again

### RLS policy errors in database
- Ensure migrations were applied successfully
- Check Supabase logs: Dashboard → Database → Logs
- Verify policies exist: Dashboard → Database → Policies

## Production Deployment

Before deploying to production:

1. **Update Environment Variables**:
   - Set production `DATABASE_URL`
   - Set production `SUPABASE_JWT_SECRET`
   - Update `VITE_API_URL` to production backend URL

2. **Update OAuth Redirect URLs**:
   - Add production domain to Google OAuth authorized redirect URIs
   - Update Supabase site URL and additional redirect URLs

3. **Enable Email Confirmations**:
   - Supabase Dashboard → Authentication → Email
   - Enable "Confirm email"

4. **Rate Limiting** (Recommended):
   - Configure rate limiting in Supabase Dashboard
   - Or add middleware to backend (e.g., Ktor rate limiting plugin)

5. **Monitoring**:
   - Enable Supabase logs
   - Set up backend logging (Logback configuration)
   - Monitor authentication metrics

## Next Steps

After authentication is working:

1. **Epic 3 - PDF Processing**:
   - Text extraction from PDFs
   - Document chunking
   - Embedding generation
   - Vector storage

2. **Additional Features**:
   - Password reset
   - Email verification
   - Profile management
   - Social auth (GitHub, Apple, etc.)

## Support

- Documentation: `AUTHENTICATION_IMPLEMENTATION.md`
- Supabase Docs: https://supabase.com/docs/guides/auth
- Ktor Docs: https://ktor.io/docs/

## Summary

✅ Backend JWT validation  
✅ Frontend auth context and UI  
✅ Protected API endpoints  
✅ User-specific document isolation  
✅ RLS policies at database level  
✅ Email/password authentication  
✅ Google OAuth (optional)  

**Status**: Ready for testing!


