-- 034: Phase A Kernel Foundations
-- Introduces principals, item_events, item_links, enriched item/type metadata, and supporting triggers.

BEGIN;

-- ── principals (identity abstraction layer) ──────────────────────────────
CREATE TABLE IF NOT EXISTS principals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  principal_type text NOT NULL CHECK (principal_type IN ('human','machine','system','service')),
  person_id uuid UNIQUE REFERENCES persons(id) ON DELETE CASCADE,
  machine_principal_id uuid UNIQUE REFERENCES machine_principals(id) ON DELETE CASCADE,
  display_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','revoked')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_principals_updated_at
  BEFORE UPDATE ON principals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO principals (id, principal_type, person_id, display_name)
SELECT id, 'human', id, full_name
FROM persons
ON CONFLICT (person_id) DO NOTHING;

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS principal_id uuid REFERENCES principals(id);

UPDATE memberships m
SET principal_id = p.id
FROM principals p
WHERE p.person_id = m.person_id
  AND m.principal_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_memberships_principal ON memberships(principal_id);

-- ── items lifecycle enrichments ─────────────────────────────────────────
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS owner_account_id uuid REFERENCES accounts(id),
  ADD COLUMN IF NOT EXISTS created_by_principal_id uuid REFERENCES principals(id),
  ADD COLUMN IF NOT EXISTS updated_by_principal_id uuid REFERENCES principals(id),
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE items
SET owner_account_id = account_id
WHERE owner_account_id IS NULL;

UPDATE items
SET slug = LEFT(id::text, 12)
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_items_account_slug ON items(account_id, slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_owner_account ON items(owner_account_id);
CREATE INDEX IF NOT EXISTS idx_items_status_account ON items(account_id, status);

CREATE OR REPLACE FUNCTION ensure_item_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_account_id IS NULL THEN
    NEW.owner_account_id := NEW.account_id;
  END IF;

  IF NEW.slug IS NULL THEN
    NEW.slug := LEFT(replace(gen_random_uuid()::text, '-', ''), 12);
  END IF;

  IF NEW.status IS NULL THEN
    NEW.status := 'active';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.version := COALESCE(NEW.version, 1);
  ELSE
    IF NEW.version IS NULL OR NEW.version = OLD.version THEN
      NEW.version := OLD.version + 1;
    ELSIF NEW.version <> OLD.version + 1 THEN
      RAISE EXCEPTION 'Version mismatch for item % (expected %, received %)', NEW.id, OLD.version + 1, NEW.version;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_items_defaults ON items;
CREATE TRIGGER trg_items_defaults
  BEFORE INSERT OR UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION ensure_item_defaults();

-- ── item_events (immutable audit log) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS item_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_principal_id uuid REFERENCES principals(id) ON DELETE SET NULL,
  sequence_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_events_account_item ON item_events(account_id, item_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_item_events_type ON item_events(account_id, event_type);

CREATE OR REPLACE FUNCTION assign_item_event_sequence()
RETURNS TRIGGER AS $$
DECLARE
  next_sequence integer;
BEGIN
  SELECT COALESCE(MAX(sequence_number), 0) + 1
  INTO next_sequence
  FROM item_events
  WHERE item_id = NEW.item_id
  FOR UPDATE;

  NEW.sequence_number := next_sequence;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_item_events_sequence ON item_events;
CREATE TRIGGER trg_item_events_sequence
  BEFORE INSERT ON item_events
  FOR EACH ROW EXECUTE FUNCTION assign_item_event_sequence();

-- ── item_links (item-to-item relationships) ─────────────────────────────
CREATE TABLE IF NOT EXISTS item_links (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source_item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  target_item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  link_type text NOT NULL,
  sequence integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_principal_id uuid REFERENCES principals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, source_item_id, target_item_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_item_links_source ON item_links(account_id, source_item_id, link_type);
CREATE INDEX IF NOT EXISTS idx_item_links_target ON item_links(account_id, target_item_id, link_type);

-- ── item type + field registries ────────────────────────────────────────
ALTER TABLE item_type_registry
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS lifecycle_states text[] NOT NULL DEFAULT ARRAY['active','archived'],
  ADD COLUMN IF NOT EXISTS default_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS allowed_link_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS embedding_strategy jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS indexing_hints jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS permission_behavior jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS display_hints jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ownership text NOT NULL DEFAULT 'system' CHECK (ownership IN ('system','pack','tenant')),
  ADD COLUMN IF NOT EXISTS pack_id uuid;

CREATE TABLE IF NOT EXISTS field_definitions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  field_key text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text','number','date','boolean','enum','json','ref')),
  field_label text NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  default_value jsonb,
  validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ownership text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack','tenant')),
  pack_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, item_type, field_key)
);

CREATE INDEX IF NOT EXISTS idx_field_definitions_account_type ON field_definitions(account_id, item_type);

ALTER TABLE link_type_definitions
  ADD COLUMN IF NOT EXISTS source_item_type text,
  ADD COLUMN IF NOT EXISTS target_item_type text,
  ADD COLUMN IF NOT EXISTS is_directional boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cardinality text NOT NULL DEFAULT 'many_to_many' CHECK (cardinality IN ('one_to_one','one_to_many','many_to_many')),
  ADD COLUMN IF NOT EXISTS constraints jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
