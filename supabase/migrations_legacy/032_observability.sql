-- 032: Observability — error_events + metrics_snapshots
-- Structured error capture and hourly metrics rollups for monitoring.

-- ── error_events ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS error_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid REFERENCES accounts(id) ON DELETE SET NULL,
  request_id      text,
  function_name   text NOT NULL,
  error_code      text NOT NULL,
  message         text NOT NULL,
  stack_summary   text,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_events_account ON error_events(account_id);
CREATE INDEX IF NOT EXISTS idx_error_events_function ON error_events(function_name);
CREATE INDEX IF NOT EXISTS idx_error_events_code ON error_events(error_code);
CREATE INDEX IF NOT EXISTS idx_error_events_created ON error_events(created_at DESC);

ALTER TABLE error_events ENABLE ROW LEVEL SECURITY;

-- ── metrics_snapshots ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start        timestamptz NOT NULL,
  period_end          timestamptz NOT NULL,
  function_name       text,
  total_errors        integer NOT NULL DEFAULT 0,
  error_codes         jsonb NOT NULL DEFAULT '{}',
  scheduler_executed  integer NOT NULL DEFAULT 0,
  scheduler_errors    integer NOT NULL DEFAULT 0,
  webhook_delivered   integer NOT NULL DEFAULT 0,
  webhook_failed      integer NOT NULL DEFAULT 0,
  metadata            jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_period ON metrics_snapshots(period_start);
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_function ON metrics_snapshots(function_name);

ALTER TABLE metrics_snapshots ENABLE ROW LEVEL SECURITY;

-- ── RLS policies ────────────────────────────────────────────────────────
-- System admins only (via profiles.system_role check)
DROP POLICY IF EXISTS "error_events_select" ON error_events;
CREATE POLICY "error_events_select" ON error_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN persons per ON per.id = p.person_id
      WHERE per.auth_uid = auth.uid()
        AND p.system_role IN ('system_admin', 'system_operator')
    )
  );

DROP POLICY IF EXISTS "metrics_snapshots_select" ON metrics_snapshots;
CREATE POLICY "metrics_snapshots_select" ON metrics_snapshots FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN persons per ON per.id = p.person_id
      WHERE per.auth_uid = auth.uid()
        AND p.system_role IN ('system_admin', 'system_operator')
    )
  );

-- Revoke direct access (consistent with security lockdown)
REVOKE ALL ON error_events FROM anon;
REVOKE ALL ON error_events FROM authenticated;
REVOKE ALL ON metrics_snapshots FROM anon;
REVOKE ALL ON metrics_snapshots FROM authenticated;
