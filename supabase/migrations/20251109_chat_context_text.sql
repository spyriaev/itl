-- Add context text storage to chat messages
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS context_text TEXT;

COMMENT ON COLUMN chat_messages.context_text IS 'Full text of the document context provided to the assistant when generating this message.';

