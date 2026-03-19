-- 035: Phase B - Threads and Messages tied to Items
-- Enhances threads/messages to be item-centric and adds relationship traversal

BEGIN;

-- Update threads to be item-centric (restrict polymorphic target to items only)
ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES items(id) ON DELETE CASCADE;

-- Migrate existing threads that target items to use item_id
UPDATE threads t
SET item_id = t.target_id::uuid
FROM items i
WHERE t.target_type = 'item'
  AND t.target_id = i.id::text
  AND t.item_id IS NULL;

-- Add indexes for item-centric queries
CREATE INDEX IF NOT EXISTS idx_threads_item_id ON threads(item_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_threads_account_item ON threads(account_id, item_id, status);

-- Update messages to support principal-based actors
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS actor_principal_id uuid REFERENCES principals(id) ON DELETE SET NULL;

-- Migrate existing messages to use principal resolution
UPDATE messages m
SET actor_principal_id = p.id
FROM principals p
WHERE m.created_by IS NOT NULL
  AND p.person_id = m.created_by
  AND m.actor_principal_id IS NULL;

-- Add indexes for principal-based queries
CREATE INDEX IF NOT EXISTS idx_messages_actor_principal ON messages(actor_principal_id) WHERE actor_principal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_thread_sequence ON messages(thread_id, sequence_number);

-- Ensure sequence numbering for messages within threads
CREATE OR REPLACE FUNCTION assign_message_sequence()
RETURNS TRIGGER AS $$
DECLARE
  next_sequence integer;
BEGIN
  SELECT COALESCE(MAX(sequence_number), 0) + 1
  INTO next_sequence
  FROM messages
  WHERE thread_id = NEW.thread_id
  FOR UPDATE;

  NEW.sequence_number := next_sequence;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_sequence ON messages;
CREATE TRIGGER trg_messages_sequence
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION assign_message_sequence();

-- Add thread metadata for item context
ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS item_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_archive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archive_after timestamptz;

-- Update message metadata for rich content
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS edit_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add validation constraints
ALTER TABLE messages
  ADD CONSTRAINT chk_content_type CHECK (content_type IN ('text', 'markdown', 'html', 'json'));

-- Create view for active item threads
CREATE OR REPLACE VIEW active_item_threads AS
SELECT 
  t.*,
  i.title as item_title,
  i.slug as item_slug,
  i.item_type,
  COUNT(m.id) as message_count,
  MAX(m.created_at) as last_message_at
FROM threads t
LEFT JOIN items i ON t.item_id = i.id
LEFT JOIN messages m ON t.id = m.thread_id
WHERE t.status = 'open'
  AND t.item_id IS NOT NULL
GROUP BY t.id, i.title, i.slug, i.item_type;

COMMIT;
