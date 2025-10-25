-- Chat threads table
CREATE TABLE chat_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  page_context INTEGER, -- page number when message was sent
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_threads_document ON chat_threads(document_id);
CREATE INDEX idx_chat_threads_user ON chat_threads(user_id);
CREATE INDEX idx_chat_messages_thread ON chat_messages(thread_id);

-- RLS policies for chat_threads
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chat threads" ON chat_threads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create chat threads for their documents" ON chat_threads
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = chat_threads.document_id 
      AND documents.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own chat threads" ON chat_threads
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat threads" ON chat_threads
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from their threads" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_threads 
      WHERE chat_threads.id = chat_messages.thread_id 
      AND chat_threads.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their threads" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_threads 
      WHERE chat_threads.id = chat_messages.thread_id 
      AND chat_threads.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages in their threads" ON chat_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM chat_threads 
      WHERE chat_threads.id = chat_messages.thread_id 
      AND chat_threads.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages from their threads" ON chat_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM chat_threads 
      WHERE chat_threads.id = chat_messages.thread_id 
      AND chat_threads.user_id = auth.uid()
    )
  );
