-- 036: Entity comments — generic threaded comments on any entity
CREATE TABLE IF NOT EXISTS entity_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity_type   text NOT NULL,
  entity_id     uuid NOT NULL,
  person_id     uuid REFERENCES persons(id) ON DELETE SET NULL,
  role          text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'system', 'assistant')),
  body          text NOT NULL,
  is_internal   boolean NOT NULL DEFAULT false,
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_comments_entity ON entity_comments(account_id, entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_entity_comments_person ON entity_comments(person_id);

ALTER TABLE entity_comments ENABLE ROW LEVEL SECURITY;
