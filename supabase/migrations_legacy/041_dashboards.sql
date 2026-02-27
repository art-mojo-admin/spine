-- 041: Dashboard definitions + widgets — configurable per-account dashboards
CREATE TABLE IF NOT EXISTS dashboard_definitions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug          text NOT NULL,
  title         text NOT NULL,
  description   text,
  layout        jsonb NOT NULL DEFAULT '[]',
  is_default    boolean NOT NULL DEFAULT false,
  min_role      text NOT NULL DEFAULT 'member' CHECK (min_role IN ('portal', 'member', 'operator', 'admin')),
  created_by    uuid REFERENCES persons(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_definitions_account ON dashboard_definitions(account_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_definitions_default ON dashboard_definitions(account_id, is_default) WHERE is_default = true;

DROP TRIGGER IF EXISTS trg_dashboard_definitions_updated_at ON dashboard_definitions;
CREATE TRIGGER trg_dashboard_definitions_updated_at
  BEFORE UPDATE ON dashboard_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE dashboard_definitions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id    uuid NOT NULL REFERENCES dashboard_definitions(id) ON DELETE CASCADE,
  widget_type     text NOT NULL,
  title           text NOT NULL,
  config          jsonb NOT NULL DEFAULT '{}',
  position        jsonb NOT NULL DEFAULT '{}',
  min_role        text NOT NULL DEFAULT 'member' CHECK (min_role IN ('portal', 'member', 'operator', 'admin')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard ON dashboard_widgets(dashboard_id);

ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
