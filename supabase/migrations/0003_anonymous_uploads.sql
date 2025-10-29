-- Make owner_id nullable to support anonymous uploads
alter table public.documents alter column owner_id drop not null;

-- Add session tracking for anonymous uploads (optional)
alter table public.documents add column if not exists uploaded_by_session text;

-- Update index to support null owner_id
drop index if exists documents_owner_created_idx;
create index documents_owner_created_idx on public.documents(owner_id, created_at desc) where owner_id is not null;
create index documents_created_idx on public.documents(created_at desc);
