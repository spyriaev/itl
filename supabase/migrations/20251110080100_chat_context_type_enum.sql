-- Update chat_messages.context_type to use strict set ('page', 'chapter', 'none')
ALTER TABLE chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_context_type_check;

ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_context_type_check
  CHECK (context_type IN ('page', 'chapter', 'none'));

ALTER TABLE chat_messages
  ALTER COLUMN context_type SET DEFAULT 'page';

