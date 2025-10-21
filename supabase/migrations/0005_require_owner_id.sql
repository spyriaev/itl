-- Make owner_id NOT NULL in documents table
-- This migration assumes authentication is now required for all operations

-- First, delete any existing documents with null owner_id (anonymous uploads from MVP)
-- In production, you may want to assign these to a system user instead
DELETE FROM public.documents WHERE owner_id IS NULL;

-- Now make owner_id NOT NULL
ALTER TABLE public.documents 
  ALTER COLUMN owner_id SET NOT NULL;

-- Add a comment to document the change
COMMENT ON COLUMN public.documents.owner_id IS 'UUID of the user who owns this document. Required after authentication implementation.';


