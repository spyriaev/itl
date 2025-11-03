-- Document sharing feature
-- Creates tables for sharing documents with unique tokens

-- Table for storing share information
CREATE TABLE document_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL
);

-- Table for tracking users who accessed shared documents
CREATE TABLE document_share_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_id UUID NOT NULL REFERENCES document_shares(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(share_id, user_id)
);

-- Indexes
CREATE INDEX idx_document_shares_token ON document_shares(share_token);
CREATE INDEX idx_document_shares_document ON document_shares(document_id, revoked_at);
CREATE INDEX idx_document_shares_active ON document_shares(document_id, revoked_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_document_share_access_user ON document_share_access(user_id);
CREATE INDEX idx_document_share_access_share ON document_share_access(share_id);
CREATE INDEX idx_document_share_access_composite ON document_share_access(user_id, share_id);

-- Enable RLS
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_share_access ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_shares
CREATE POLICY "Document owners can manage their shares" ON document_shares
  FOR ALL USING (auth.uid() = created_by);

CREATE POLICY "Anyone can check share token validity" ON document_shares
  FOR SELECT USING (
    revoked_at IS NULL 
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- RLS policies for document_share_access
CREATE POLICY "Users can view their own access records" ON document_share_access
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Document owners can view access records for their shares" ON document_share_access
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM document_shares
      WHERE document_shares.id = document_share_access.share_id
      AND document_shares.created_by = auth.uid()
    )
  );

CREATE POLICY "System can create access records" ON document_share_access
  FOR INSERT WITH CHECK (true); -- Backend will control this via service role

-- Update RLS policies for documents to allow viewing shared documents
-- Users can view documents they own OR documents they have access to via sharing
-- Drop and recreate the policy to ensure it's updated correctly
DO $$
BEGIN
  -- Drop policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'documents' 
    AND policyname = 'Users can view their own documents'
  ) THEN
    DROP POLICY "Users can view their own documents" ON documents;
  END IF;
  
  -- Create the policy
  CREATE POLICY "Users can view their own documents" ON documents
    FOR SELECT USING (auth.uid() = owner_id);
END $$;

CREATE POLICY "Users can view shared documents they accessed" ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM document_share_access dsa
      JOIN document_shares ds ON ds.id = dsa.share_id
      WHERE ds.document_id = documents.id
      AND dsa.user_id = auth.uid()
      AND ds.revoked_at IS NULL
      AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
    )
  );

-- Update RLS policies for chat_threads to allow creating threads for shared documents
-- First, drop the old policy if it exists
DROP POLICY IF EXISTS "Users can create chat threads for their documents" ON chat_threads;

CREATE POLICY "Users can create chat threads for their documents" ON chat_threads
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
      -- User owns the document
      EXISTS (
        SELECT 1 FROM documents 
        WHERE documents.id = chat_threads.document_id 
        AND documents.owner_id = auth.uid()
      )
      OR
      -- Document is shared and user has access
      EXISTS (
        SELECT 1 FROM document_share_access dsa
        JOIN document_shares ds ON ds.id = dsa.share_id
        WHERE ds.document_id = chat_threads.document_id
        AND dsa.user_id = auth.uid()
        AND ds.revoked_at IS NULL
        AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
      )
    )
  );

-- Ensure chat_threads SELECT policy only shows own threads (already correct, but making sure)
-- The existing policy "Users can view their own chat threads" already restricts to auth.uid() = user_id
-- This ensures users only see their own threads, not other users' threads

-- Update RLS policies for document_structure to allow viewing structure for shared documents
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can view structure of their documents" ON document_structure;

CREATE POLICY "Users can view structure of their documents" ON document_structure
  FOR SELECT USING (
    -- User owns the document
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = document_structure.document_id 
      AND documents.owner_id = auth.uid()
    )
    OR
    -- Document is shared and user has access
    EXISTS (
      SELECT 1 FROM document_share_access dsa
      JOIN document_shares ds ON ds.id = dsa.share_id
      WHERE ds.document_id = document_structure.document_id
      AND dsa.user_id = auth.uid()
      AND ds.revoked_at IS NULL
      AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
    )
  );

-- Note: chat_threads SELECT policy already allows users to see only their own threads
-- Note: chat_messages policies already work correctly (users see only messages from their threads)

