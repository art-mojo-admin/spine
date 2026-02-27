-- 009: Views + Apps — first-class artifact layer
-- view_definitions unifies list/board/detail/portal_page/dashboard views.
-- app_definitions makes packs produce real user-facing applications.

-- ── view_definitions ───────────────────────────────────────────────────
CREATE TABLE view_definitions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug            text NOT NULL,
  name            text NOT NULL,
  view_type       text NOT NULL CHECK (view_type IN (
    'list', 'board', 'detail', 'portal_page', 'dashboard'
  )),
  target_type     text REFERENCES entity_type_registry(slug),
  target_filter   jsonb NOT NULL DEFAULT '{}',
  config          jsonb NOT NULL DEFAULT '{}',
  min_role        text NOT NULL DEFAULT 'member',
  is_active       boolean NOT NULL DEFAULT true,
  is_test_data    boolean NOT NULL DEFAULT false,
  pack_id         uuid,
  ownership       text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, slug)
);

CREATE INDEX idx_view_definitions_account ON view_definitions(account_id);
CREATE INDEX idx_view_definitions_type ON view_definitions(account_id, view_type);
CREATE INDEX idx_view_definitions_target ON view_definitions(account_id, target_type);

CREATE TRIGGER trg_view_definitions_updated_at
  BEFORE UPDATE ON view_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── app_definitions ────────────────────────────────────────────────────
CREATE TABLE app_definitions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug            text NOT NULL,
  name            text NOT NULL,
  icon            text,
  description     text,
  nav_items       jsonb NOT NULL DEFAULT '[]',
  default_view    text,
  min_role        text NOT NULL DEFAULT 'member',
  integration_deps jsonb NOT NULL DEFAULT '[]',
  is_active       boolean NOT NULL DEFAULT true,
  is_test_data    boolean NOT NULL DEFAULT false,
  pack_id         uuid,
  ownership       text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, slug)
);

CREATE INDEX idx_app_definitions_account ON app_definitions(account_id);
CREATE INDEX idx_app_definitions_active ON app_definitions(account_id, is_active) WHERE is_active = true;

CREATE TRIGGER trg_app_definitions_updated_at
  BEFORE UPDATE ON app_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
