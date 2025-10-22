-- Add columns for tracking PDF viewing progress
ALTER TABLE documents 
ADD COLUMN last_viewed_page INTEGER DEFAULT 1,
ADD COLUMN last_viewed_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient querying of recently viewed documents
CREATE INDEX idx_documents_last_viewed ON documents(owner_id, last_viewed_at DESC);
