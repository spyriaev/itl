<<<<<<< Current (Your changes)
# itl
=======
# AI Reader Monorepo

Monorepo for native iOS (Swift), Android (Kotlin), Web (React), Kotlin server (Ktor), and Supabase schema.

## Structure

```
ios/
android/
web/
server/
supabase/
```

## Prerequisites
- Node.js LTS, pnpm or npm
- Java 17 (for Android + Ktor)
- Android Studio / Xcode
- Supabase CLI
- Heroku CLI (for server deploy)

## Bootstrap (dev)
- Supabase: `supabase start` then `supabase db reset`
- Web: `cd web && npm i && npm run dev`
- Server: `cd server && ./gradlew run`
- Android/iOS: open projects in IDEs

## Environment
- Copy `.env.example` to `.env` at repo root and fill values used by the server.
- Per-project details are in their READMEs.
>>>>>>> Incoming (Background Agent changes)
