-- Document structure table for storing PDF outlines/chapters
CREATE TABLE document_structure (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1, -- 1 = chapter, 2 = section, etc.
  page_from INTEGER NOT NULL,
  page_to INTEGER, -- can be null for sections that span to end
  parent_id UUID REFERENCES document_structure(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for document structure
CREATE INDEX idx_document_structure_document ON document_structure(document_id);
CREATE INDEX idx_document_structure_parent ON document_structure(parent_id);
CREATE INDEX idx_document_structure_document_order ON document_structure(document_id, order_index);

-- Update chat_messages table to support chapter context
ALTER TABLE chat_messages 
  ADD COLUMN chapter_id UUID REFERENCES document_structure(id),
  ADD COLUMN context_type TEXT DEFAULT 'page' CHECK (context_type IN ('page', 'chapter', 'section', 'document'));

-- Index for chapter_id
CREATE INDEX idx_chat_messages_chapter ON chat_messages(chapter_id);

-- RLS policies for document_structure
ALTER TABLE document_structure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view structure of their documents" ON document_structure
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = document_structure.document_id 
      AND documents.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create structure for their documents" ON document_structure
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = document_structure.document_id 
      AND documents.owner_id = auth.uid()
    )
  );

-- Update RLS policy for chat_messages to allow chapter_id
-- The existing policies already handle this through thread ownership
