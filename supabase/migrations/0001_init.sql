-- Enable extensions
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- Documents table
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  title text,
  storage_key text not null,
  size_bytes bigint,
  mime text,
  checksum_sha256 text,
  status text not null default 'created',
  created_at timestamptz not null default now()
);

create index if not exists documents_owner_created_idx on public.documents(owner_id, created_at desc);

-- Optional chunks with embeddings (for future RAG)
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.documents(id) on delete cascade,
  section_id uuid,
  page_from int not null,
  page_to int not null,
  chunk_order int not null,
  text text not null,
  embedding vector(1024),
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_doc_idx on public.document_chunks(doc_id, chunk_order);
create index if not exists document_chunks_embed_idx on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
