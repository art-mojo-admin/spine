-- 005: Threads + Messages — universal messaging attachable to any entity
-- Replaces ticket_messages and entity_comments.

-- ── threads ────────────────────────────────────────────────────────────
CREATE TABLE threads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_type   text NOT NULL REFERENCES entity_type_registry(slug),
  target_id     uuid NOT NULL,
  thread_type   text NOT NULL DEFAULT 'discussion'
                CHECK (thread_type IN ('discussion', 'support', 'approval', 'notes', 'transcript')),
  visibility    text NOT NULL DEFAULT 'internal'
                CHECK (visibility IN ('internal', 'portal', 'public')),
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'closed', 'archived')),
  metadata      jsonb NOT NULL DEFAULT '{}',
  is_active     boolean NOT NULL DEFAULT true,
  is_test_data  boolean NOT NULL DEFAULT false,
  pack_id       uuid,  -- FK added in 011_packs.sql
  ownership     text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_threads_target ON threads(account_id, target_type, target_id);
CREATE INDEX idx_threads_status ON threads(account_id, status);
CREATE INDEX idx_threads_type ON threads(account_id, thread_type);

CREATE TRIGGER trg_threads_updated_at
  BEFORE UPDATE ON threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── messages ───────────────────────────────────────────────────────────
CREATE TABLE messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  person_id     uuid REFERENCES persons(id) ON DELETE SET NULL,
  direction     text NOT NULL DEFAULT 'internal'
                CHECK (direction IN ('inbound', 'outbound', 'internal')),
  body          text NOT NULL,
  sequence      integer NOT NULL,
  visibility    text NOT NULL DEFAULT 'inherit'
                CHECK (visibility IN ('inherit', 'internal', 'portal', 'public')),
  metadata      jsonb NOT NULL DEFAULT '{}',
  is_active     boolean NOT NULL DEFAULT true,
  is_test_data  boolean NOT NULL DEFAULT false,
  pack_id       uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_messages_sequence ON messages(thread_id, sequence);
CREATE INDEX idx_messages_thread ON messages(thread_id, sequence);
CREATE INDEX idx_messages_person ON messages(person_id);
