-- 038: Entity attachments — file uploads on any entity via Supabase Storage
CREATE TABLE IF NOT EXISTS entity_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity_type   text NOT NULL,
  entity_id     uuid NOT NULL,
  filename      text NOT NULL,
  mime_type     text,
  size_bytes    integer,
  storage_path  text NOT NULL,
  uploaded_by   uuid REFERENCES persons(id) ON DELETE SET NULL,
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_attachments_entity ON entity_attachments(account_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_attachments_uploaded_by ON entity_attachments(uploaded_by);

ALTER TABLE entity_attachments ENABLE ROW LEVEL SECURITY;
