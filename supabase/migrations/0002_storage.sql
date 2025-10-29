-- Create private bucket for PDFs
insert into storage.buckets (id, name, public) values ('pdfs', 'pdfs', false)
on conflict (id) do nothing;

-- Optional: RLS policies are typically managed via Supabase Storage policies UI.
-- For now, keep bucket private and access via signed URLs from the server.
