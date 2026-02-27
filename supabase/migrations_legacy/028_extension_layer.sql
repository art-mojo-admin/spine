-- 028_extension_layer.sql
-- Adds account_modules, custom_action_types, and nav_extensions tables
-- to support pluggable business functionality without core code changes.

-- ── account_modules ─────────────────────────────────────────────────
CREATE TABLE account_modules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  module_slug  text NOT NULL,
  label        text NOT NULL,
  description  text,
  enabled      boolean NOT NULL DEFAULT true,
  config       jsonb NOT NULL DEFAULT '{}',
  installed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, module_slug)
);

CREATE INDEX idx_account_modules_account ON account_modules(account_id);
CREATE INDEX idx_account_modules_slug    ON account_modules(account_id, module_slug) WHERE enabled = true;

-- ── custom_action_types ─────────────────────────────────────────────
CREATE TABLE custom_action_types (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug          text NOT NULL,
  name          text NOT NULL,
  description   text,
  handler_url   text NOT NULL,
  config_schema jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, slug)
);

CREATE INDEX idx_custom_action_types_account ON custom_action_types(account_id);

CREATE TRIGGER trg_custom_action_types_updated
  BEFORE UPDATE ON custom_action_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── nav_extensions ──────────────────────────────────────────────────
CREATE TABLE nav_extensions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  label       text NOT NULL,
  icon        text,
  url         text NOT NULL,
  location    text NOT NULL DEFAULT 'sidebar' CHECK (location IN ('sidebar', 'admin', 'detail_panel')),
  position    integer NOT NULL DEFAULT 0,
  min_role    text NOT NULL DEFAULT 'member' CHECK (min_role IN ('portal', 'member', 'operator', 'admin')),
  module_slug text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, label)
);

CREATE INDEX idx_nav_extensions_account ON nav_extensions(account_id);
CREATE INDEX idx_nav_extensions_location ON nav_extensions(account_id, location);
