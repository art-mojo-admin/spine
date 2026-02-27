-- 039: Nav overrides — per-account nav renaming, hiding, role scoping, default entity pinning
CREATE TABLE IF NOT EXISTS nav_overrides (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  nav_key           text NOT NULL,
  label             text,
  hidden            boolean NOT NULL DEFAULT false,
  min_role          text NOT NULL DEFAULT 'member' CHECK (min_role IN ('portal', 'member', 'operator', 'admin')),
  default_entity_id uuid,
  position          integer NOT NULL DEFAULT 0,
  UNIQUE(account_id, nav_key)
);

CREATE INDEX IF NOT EXISTS idx_nav_overrides_account ON nav_overrides(account_id);

ALTER TABLE nav_overrides ENABLE ROW LEVEL SECURITY;
