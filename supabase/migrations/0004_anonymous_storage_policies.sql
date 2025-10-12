-- Drop existing storage policies that require authentication
drop policy if exists "Users can upload PDFs to their own folder" on storage.objects;
drop policy if exists "Users can view their own PDFs" on storage.objects;
drop policy if exists "Users can update their own PDFs" on storage.objects;
drop policy if exists "Users can delete their own PDFs" on storage.objects;

-- ============================================================
-- Storage Policies for Anonymous and Authenticated Uploads
-- ============================================================

-- Policy: Anyone can upload PDFs (anonymous or authenticated)
create policy "Anyone can upload PDFs"
  on storage.objects
  for insert
  with check (
    bucket_id = 'pdfs'
  );

-- Policy: Anyone can view PDFs (for public access)
create policy "Anyone can view PDFs"
  on storage.objects
  for select
  using (
    bucket_id = 'pdfs'
  );

-- Policy: Anyone can update PDFs they uploaded
create policy "Anyone can update PDFs"
  on storage.objects
  for update
  using (
    bucket_id = 'pdfs'
  )
  with check (
    bucket_id = 'pdfs'
  );

-- Policy: Anyone can delete PDFs
create policy "Anyone can delete PDFs"
  on storage.objects
  for delete
  using (
    bucket_id = 'pdfs'
  );

-- ============================================================
-- Update RLS policies for documents table to allow anonymous inserts
-- ============================================================

-- Drop existing insert policy that requires owner_id = auth.uid()
drop policy if exists "Users can insert their own documents" on public.documents;

-- New policy: Allow anyone to insert documents (anonymous or authenticated)
create policy "Anyone can insert documents"
  on public.documents
  for insert
  with check (true);

-- Allow anyone to view documents (you may want to restrict this later)
drop policy if exists "Users can view their own documents" on public.documents;
create policy "Anyone can view documents"
  on public.documents
  for select
  using (true);

-- ============================================================
-- Comments and Notes
-- ============================================================

-- These policies allow anonymous uploads without authentication
-- For production, you may want to:
-- 1. Add rate limiting
-- 2. Add size limits
-- 3. Restrict who can view/delete documents
-- 4. Use authenticated uploads with proper user_id folder structure
--

