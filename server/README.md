# Ktor Server

Minimal Ktor server with `/health` endpoint.

## Run (dev)
- Ensure Java 17
- From `server/`: `./gradlew run` (after adding Gradle wrapper) or `gradle run`

## Env
- `PORT` (default 8080)
- `DATABASE_URL` (Supabase Postgres connection)
- `SUPABASE_URL` (project URL)
- `SUPABASE_ANON_KEY` (client key for verification if needed)
- `SUPABASE_SERVICE_ROLE_KEY` (server key for Storage signed URLs)
- `REDIS_URL` (Heroku Redis)

