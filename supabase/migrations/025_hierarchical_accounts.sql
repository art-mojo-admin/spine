-- 025: Hierarchical accounts foundations
BEGIN;

-- Expand account types + add parent pointers
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_account_type_check;
ALTER TABLE accounts
  ALTER COLUMN account_type SET DEFAULT 'tenant';

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS parent_account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT accounts_account_type_check
    CHECK (account_type IN ('platform', 'tenant', 'company', 'individual', 'custom'));

CREATE INDEX IF NOT EXISTS idx_accounts_parent_account ON accounts(parent_account_id);

-- Closure table for ancestor/descendant queries
CREATE TABLE IF NOT EXISTS account_paths (
  ancestor_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  descendant_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  depth          integer NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE INDEX IF NOT EXISTS idx_account_paths_descendant ON account_paths(descendant_id, depth);

-- Membership scope column for hierarchical permissions
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'descendants'
    CHECK (scope IN ('node', 'descendants', 'ancestors'));

-- Items get explicit account node pointer
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS account_node_id uuid REFERENCES accounts(id);

UPDATE items SET account_node_id = account_id WHERE account_node_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_items_account_node ON items(account_node_id);

CREATE OR REPLACE FUNCTION set_account_node_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_node_id IS NULL THEN
    NEW.account_node_id := NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_items_account_node ON items;
CREATE TRIGGER trg_items_account_node
  BEFORE INSERT OR UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION set_account_node_id();

-- Ensure platform root exists and parent pointers populated
DO $$
DECLARE
  platform_id uuid;
BEGIN
  INSERT INTO accounts (account_type, display_name, slug, status, settings, metadata, ownership)
  VALUES ('platform', 'Spine Platform', 'spine-platform', 'active', '{}'::jsonb, '{}'::jsonb, 'tenant')
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO platform_id;

  IF platform_id IS NULL THEN
    SELECT id INTO platform_id FROM accounts WHERE slug = 'spine-platform' LIMIT 1;
  END IF;

  UPDATE accounts
  SET account_type = 'tenant'
  WHERE account_type NOT IN ('platform', 'tenant', 'company', 'individual', 'custom');

  UPDATE accounts
  SET parent_account_id = platform_id
  WHERE id <> platform_id AND parent_account_id IS NULL;
END $$;

-- Rebuild closure table from current hierarchy
TRUNCATE account_paths;
WITH RECURSIVE hierarchy AS (
  SELECT id AS descendant_id, parent_account_id, id AS ancestor_id, 0 AS depth
  FROM accounts
  UNION ALL
  SELECT h.descendant_id, a.parent_account_id, a.id AS ancestor_id, h.depth + 1
  FROM hierarchy h
  JOIN accounts a ON h.parent_account_id = a.id
)
INSERT INTO account_paths (ancestor_id, descendant_id, depth)
SELECT ancestor_id, descendant_id, depth
FROM hierarchy
WHERE ancestor_id IS NOT NULL
ON CONFLICT (ancestor_id, descendant_id) DO UPDATE SET depth = EXCLUDED.depth;

-- Maintain closure table automatically
CREATE OR REPLACE FUNCTION maintain_account_paths_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- self path
  INSERT INTO account_paths (ancestor_id, descendant_id, depth)
  VALUES (NEW.id, NEW.id, 0)
  ON CONFLICT (ancestor_id, descendant_id) DO UPDATE SET depth = EXCLUDED.depth;

  IF NEW.parent_account_id IS NOT NULL THEN
    INSERT INTO account_paths (ancestor_id, descendant_id, depth)
    SELECT ancestor_id, NEW.id, depth + 1
    FROM account_paths
    WHERE descendant_id = NEW.parent_account_id
    UNION
    SELECT NEW.parent_account_id, NEW.id, 1
    ON CONFLICT (ancestor_id, descendant_id) DO UPDATE SET depth = EXCLUDED.depth;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION maintain_account_paths_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_account_id IS DISTINCT FROM OLD.parent_account_id THEN
    DELETE FROM account_paths
    WHERE descendant_id IN (
      SELECT descendant_id FROM account_paths WHERE ancestor_id = OLD.id
    )
    AND ancestor_id IN (
      SELECT ancestor_id FROM account_paths WHERE descendant_id = OLD.id AND ancestor_id <> OLD.id
    );

    INSERT INTO account_paths (ancestor_id, descendant_id, depth)
    SELECT super.ancestor_id, sub.descendant_id, super.depth + sub.depth + 1
    FROM account_paths AS super
    CROSS JOIN account_paths AS sub
    WHERE super.descendant_id = COALESCE(NEW.parent_account_id, NEW.id)
      AND sub.ancestor_id = NEW.id
    ON CONFLICT (ancestor_id, descendant_id) DO UPDATE SET depth = EXCLUDED.depth;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_account_paths_insert ON accounts;
CREATE TRIGGER trg_account_paths_insert
  AFTER INSERT ON accounts
  FOR EACH ROW EXECUTE FUNCTION maintain_account_paths_on_insert();

DROP TRIGGER IF EXISTS trg_account_paths_update ON accounts;
CREATE TRIGGER trg_account_paths_update
  AFTER UPDATE OF parent_account_id ON accounts
  FOR EACH ROW EXECUTE FUNCTION maintain_account_paths_on_update();

COMMIT;
