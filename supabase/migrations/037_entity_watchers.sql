-- 037: Entity watchers — subscribe to any entity for notification hooks
CREATE TABLE IF NOT EXISTS entity_watchers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity_type   text NOT NULL,
  entity_id     uuid NOT NULL,
  person_id     uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, entity_type, entity_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_watchers_entity ON entity_watchers(account_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_watchers_person ON entity_watchers(person_id);

ALTER TABLE entity_watchers ENABLE ROW LEVEL SECURITY;
