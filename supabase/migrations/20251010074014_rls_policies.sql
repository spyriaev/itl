-- Enable Row Level Security on all tables
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

-- ============================================================
-- RLS Policies for documents table
-- ============================================================

-- Policy: Users can view their own documents
-- First, drop the "Anyone can view documents" policy from migration 0004 if it exists
DROP POLICY IF EXISTS "Anyone can view documents" ON public.documents;

-- Use DO block to safely create policy only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'documents' 
    AND policyname = 'Users can view their own documents'
  ) THEN
    CREATE POLICY "Users can view their own documents"
      ON public.documents
      FOR SELECT
      USING (auth.uid() = owner_id);
  END IF;
END $$;

-- Policy: Users can insert their own documents
-- First, drop the "Anyone can insert documents" policy from migration 0004 if it exists
DROP POLICY IF EXISTS "Anyone can insert documents" ON public.documents;

-- Use DO block to safely create policy only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'documents' 
    AND policyname = 'Users can insert their own documents'
  ) THEN
    CREATE POLICY "Users can insert their own documents"
      ON public.documents
      FOR INSERT
      WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

-- Policy: Users can update their own documents
create policy "Users can update their own documents"
  on public.documents
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Policy: Users can delete their own documents
create policy "Users can delete their own documents"
  on public.documents
  for delete
  using (auth.uid() = owner_id);

-- ============================================================
-- RLS Policies for document_chunks table
-- ============================================================

-- Policy: Users can view chunks of their own documents
create policy "Users can view chunks of their own documents"
  on public.document_chunks
  for select
  using (
    exists (
      select 1 from public.documents
      where documents.id = document_chunks.doc_id
      and documents.owner_id = auth.uid()
    )
  );

-- Policy: Users can insert chunks for their own documents
create policy "Users can insert chunks for their own documents"
  on public.document_chunks
  for insert
  with check (
    exists (
      select 1 from public.documents
      where documents.id = document_chunks.doc_id
      and documents.owner_id = auth.uid()
    )
  );

-- Policy: Users can update chunks of their own documents
create policy "Users can update chunks of their own documents"
  on public.document_chunks
  for update
  using (
    exists (
      select 1 from public.documents
      where documents.id = document_chunks.doc_id
      and documents.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.documents
      where documents.id = document_chunks.doc_id
      and documents.owner_id = auth.uid()
    )
  );

-- Policy: Users can delete chunks of their own documents
create policy "Users can delete chunks of their own documents"
  on public.document_chunks
  for delete
  using (
    exists (
      select 1 from public.documents
      where documents.id = document_chunks.doc_id
      and documents.owner_id = auth.uid()
    )
  );

-- ============================================================
-- Storage Policies for pdfs bucket
-- ============================================================

-- Policy: Users can upload PDFs to their own folder
create policy "Users can upload PDFs to their own folder"
  on storage.objects
  for insert
  with check (
    bucket_id = 'pdfs' 
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can view their own PDFs
create policy "Users can view their own PDFs"
  on storage.objects
  for select
  using (
    bucket_id = 'pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can update their own PDFs
create policy "Users can update their own PDFs"
  on storage.objects
  for update
  using (
    bucket_id = 'pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can delete their own PDFs
create policy "Users can delete their own PDFs"
  on storage.objects
  for delete
  using (
    bucket_id = 'pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- Comments and Notes
-- ============================================================

-- Storage folder structure expected: pdfs/{user_id}/{filename}
-- This ensures each user has their own isolated folder in the bucket
-- auth.uid() returns the authenticated user's ID
-- All policies check that the user_id matches the authenticated user
