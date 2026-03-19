-- 042: Phase E - Admin UI Support Schema
-- Adds admin-specific views, functions, and monitoring tables for admin UI

BEGIN;

-- Create admin audit views table
CREATE TABLE IF NOT EXISTS admin_audit_views (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  view_name text NOT NULL,
  view_type text NOT NULL CHECK (view_type IN ('system_health','type_registry','pack_lifecycle','agent_monitoring','audit_trail','security_monitoring')),
  view_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_favorite boolean NOT NULL DEFAULT false,
  created_by_principal_id uuid REFERENCES principals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, view_name, view_type)
);

-- Add indexes for admin audit views
CREATE INDEX IF NOT EXISTS idx_admin_audit_views_account ON admin_audit_views(account_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_views_type ON admin_audit_views(view_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_views_favorite ON admin_audit_views(account_id, is_favorite);

-- Create admin alerts table
CREATE TABLE IF NOT EXISTS admin_alerts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('system','security','performance','pack','agent','audit')),
  alert_severity text NOT NULL CHECK (alert_severity IN ('info','warning','error','critical')),
  alert_title text NOT NULL,
  alert_message text,
  alert_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_entity_type text,
  source_entity_id uuid,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_by_principal_id uuid REFERENCES principals(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for admin alerts
CREATE INDEX IF NOT EXISTS idx_admin_alerts_account ON admin_alerts(account_id);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_type ON admin_alerts(account_id, alert_type);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_severity ON admin_alerts(account_id, alert_severity);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_resolved ON admin_alerts(account_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_expires ON admin_alerts(expires_at);

-- Create admin dashboard widgets table
CREATE TABLE IF NOT EXISTS admin_dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  widget_type text NOT NULL CHECK (widget_type IN ('metric','chart','table','alert','health','activity')),
  widget_name text NOT NULL,
  widget_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_source text NOT NULL,
  refresh_interval integer NOT NULL DEFAULT 300, -- seconds
  position_x integer NOT NULL DEFAULT 0,
  position_y integer NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 4,
  height integer NOT NULL DEFAULT 3,
  is_visible boolean NOT NULL DEFAULT true,
  created_by_principal_id uuid REFERENCES principals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for dashboard widgets
CREATE INDEX IF NOT EXISTS idx_admin_dashboard_widgets_account ON admin_dashboard_widgets(account_id);
CREATE INDEX IF NOT EXISTS idx_admin_dashboard_widgets_type ON admin_dashboard_widgets(widget_type);
CREATE INDEX IF NOT EXISTS idx_admin_dashboard_widgets_visible ON admin_dashboard_widgets(account_id, is_visible);

-- Create admin system health snapshots
CREATE TABLE IF NOT EXISTS admin_health_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('hourly','daily','weekly')),
  snapshot_timestamp timestamptz NOT NULL DEFAULT now(),
  system_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  database_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  performance_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  security_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  pack_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  agent_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for health snapshots
CREATE INDEX IF NOT EXISTS idx_admin_health_snapshots_account ON admin_health_snapshots(account_id);
CREATE INDEX IF NOT EXISTS idx_admin_health_snapshots_type ON admin_health_snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_admin_health_snapshots_timestamp ON admin_health_snapshots(snapshot_timestamp);

-- Admin UI functions

-- Function to get comprehensive system health
CREATE OR REPLACE FUNCTION get_admin_system_health(
  health_account_id uuid
)
RETURNS jsonb AS $$
DECLARE
  health_data jsonb;
  error_count integer;
  warning_count integer;
  critical_count integer;
  last_24h timestamptz := now() - interval '24 hours';
BEGIN
  -- Get system metrics
  SELECT jsonb_build_object(
    'timestamp', now(),
    'account_id', health_account_id,
    'database', (
      SELECT jsonb_build_object(
        'total_items', (SELECT COUNT(*) FROM items WHERE account_id = health_account_id),
        'total_principals', (SELECT COUNT(*) FROM principals WHERE id IN (SELECT principal_id FROM memberships WHERE account_id = health_account_id)),
        'total_events', (SELECT COUNT(*) FROM item_events WHERE account_id = health_account_id),
        'total_links', (SELECT COUNT(*) FROM item_links WHERE account_id = health_account_id),
        'total_threads', (SELECT COUNT(*) FROM threads WHERE account_id = health_account_id),
        'total_messages', (SELECT COUNT(*) FROM messages WHERE thread_id IN (SELECT id FROM threads WHERE account_id = health_account_id))
      )
    ),
    'packs', (
      SELECT jsonb_build_object(
        'installed_packs', (SELECT COUNT(*) FROM installed_packs WHERE account_id = health_account_id),
        'active_packs', (SELECT COUNT(*) FROM installed_packs WHERE account_id = health_account_id AND install_status = 'installed'),
        'failed_packs', (SELECT COUNT(*) FROM installed_packs WHERE account_id = health_account_id AND install_status = 'failed'),
        'recent_installations', (SELECT COUNT(*) FROM pack_install_history WHERE account_id = health_account_id AND started_at >= last_24h)
      )
    ),
    'agents', (
      SELECT jsonb_build_object(
        'active_contracts', (SELECT COUNT(*) FROM agent_contracts WHERE account_id = health_account_id AND status = 'active'),
        'total_executions', (SELECT COUNT(*) FROM agent_executions WHERE account_id = health_account_id),
        'running_executions', (SELECT COUNT(*) FROM agent_executions WHERE account_id = health_account_id AND execution_status = 'running'),
        'failed_executions', (SELECT COUNT(*) FROM agent_executions WHERE account_id = health_account_id AND execution_status = 'failed' AND started_at >= last_24h),
        'avg_execution_time', (
          SELECT COALESCE(AVG(duration_ms), 0) 
          FROM agent_executions 
          WHERE account_id = health_account_id 
            AND execution_status = 'completed' 
            AND started_at >= last_24h
        )
      )
    ),
    'alerts', (
      SELECT jsonb_build_object(
        'total_alerts', (SELECT COUNT(*) FROM admin_alerts WHERE account_id = health_account_id AND is_resolved = false),
        'critical_alerts', (SELECT COUNT(*) FROM admin_alerts WHERE account_id = health_account_id AND alert_severity = 'critical' AND is_resolved = false),
        'error_alerts', (SELECT COUNT(*) FROM admin_alerts WHERE account_id = health_account_id AND alert_severity = 'error' AND is_resolved = false),
        'warning_alerts', (SELECT COUNT(*) FROM admin_alerts WHERE account_id = health_account_id AND alert_severity = 'warning' AND is_resolved = false)
      )
    )
  ) INTO health_data;
  
  -- Create health snapshot
  INSERT INTO admin_health_snapshots (
    account_id, snapshot_type, system_metrics,
    database_metrics, performance_metrics, security_metrics,
    pack_metrics, agent_metrics
  )
  VALUES (
    health_account_id, 'hourly', health_data,
    health_data->'database', health_data->'performance', health_data->'security',
    health_data->'packs', health_data->'agents'
  );
  
  RETURN health_data;
END;
$$ LANGUAGE plpgsql;

-- Function to create admin alert
CREATE OR REPLACE FUNCTION create_admin_alert(
  alert_account_id uuid,
  alert_type text,
  alert_severity text,
  alert_title text,
  alert_message text DEFAULT NULL,
  alert_data jsonb DEFAULT '{}'::jsonb,
  source_entity_type text DEFAULT NULL,
  source_entity_id uuid DEFAULT NULL,
  expires_hours integer DEFAULT 24
)
RETURNS uuid AS $$
DECLARE
  alert_id uuid;
  expires_at timestamptz;
BEGIN
  -- Calculate expiration time
  IF expires_hours > 0 THEN
    expires_at := now() + (expires_hours || ' hours')::interval;
  END IF;
  
  -- Create alert
  INSERT INTO admin_alerts (
    account_id, alert_type, alert_severity, alert_title, alert_message,
    alert_data, source_entity_type, source_entity_id, expires_at
  )
  VALUES (
    alert_account_id, alert_type, alert_severity, alert_title, alert_message,
    alert_data, source_entity_type, source_entity_id, expires_at
  )
  RETURNING id INTO alert_id;
  
  RETURN alert_id;
END;
$$ LANGUAGE plpgsql;

-- Function to resolve admin alert
CREATE OR REPLACE FUNCTION resolve_admin_alert(
  alert_id uuid,
  resolving_principal_id uuid
)
RETURNS boolean AS $$
DECLARE
  alert_record RECORD;
BEGIN
  -- Get alert record
  SELECT * INTO alert_record
  FROM admin_alerts
  WHERE id = alert_id AND is_resolved = false;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Update alert
  UPDATE admin_alerts
  SET 
    is_resolved = true,
    resolved_by_principal_id = resolving_principal_id,
    resolved_at = now()
  WHERE id = alert_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to get admin dashboard data
CREATE OR REPLACE FUNCTION get_admin_dashboard_data(
  dashboard_account_id uuid
)
RETURNS jsonb AS $$
DECLARE
  dashboard_data jsonb;
  last_24h timestamptz := now() - interval '24 hours';
  last_7d timestamptz := now() - interval '7 days';
BEGIN
  SELECT jsonb_build_object(
    'summary', (
      SELECT jsonb_build_object(
        'total_items', (SELECT COUNT(*) FROM items WHERE account_id = dashboard_account_id),
        'active_packs', (SELECT COUNT(*) FROM installed_packs WHERE account_id = dashboard_account_id AND install_status = 'installed'),
        'active_agents', (SELECT COUNT(*) FROM agent_contracts WHERE account_id = dashboard_account_id AND status = 'active'),
        'unresolved_alerts', (SELECT COUNT(*) FROM admin_alerts WHERE account_id = dashboard_account_id AND is_resolved = false),
        'recent_activity', (
          SELECT COUNT(*) 
          FROM item_events 
          WHERE account_id = dashboard_account_id AND created_at >= last_24h
        )
      )
    ),
    'health_metrics', (
      SELECT jsonb_build_object(
        'database_size', pg_total_relation_size('public.items') + pg_total_relation_size('public.item_events'),
        'index_usage', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'table', schemaname||'.'||tablename,
              'index_scans', idx_scan,
              'tuples_read', idx_tup_read
            )
          )
          FROM pg_stat_user_indexes
          WHERE schemaname = 'public' AND idx_scan > 0
          LIMIT 10
        ),
        'slow_queries', 0 -- Placeholder for slow query tracking
      )
    ),
    'recent_alerts', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'type', alert_type,
          'severity', alert_severity,
          'title', alert_title,
          'created_at', created_at
        )
      )
      FROM admin_alerts
      WHERE account_id = dashboard_account_id 
        AND is_resolved = false 
        AND alert_severity IN ('critical', 'error')
      ORDER BY created_at DESC
      LIMIT 5
    ),
    'activity_trends', (
      SELECT jsonb_build_object(
        'daily_events', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'date', DATE(created_at),
              'count', COUNT(*)
            )
          )
          FROM item_events
          WHERE account_id = dashboard_account_id 
            AND created_at >= last_7d
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at)
        ),
        'pack_activity', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'date', DATE(started_at),
              'operations', COUNT(*),
              'successes', COUNT(*) FILTER (WHERE operation_status = 'completed')
            )
          )
          FROM pack_install_history
          WHERE account_id = dashboard_account_id 
            AND started_at >= last_7d
          GROUP BY DATE(started_at)
          ORDER BY DATE(started_at)
        )
      )
    )
  ) INTO dashboard_data;
  
  RETURN dashboard_data;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired alerts
CREATE OR REPLACE FUNCTION cleanup_expired_alerts()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM admin_alerts 
  WHERE expires_at IS NOT NULL AND expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create admin views for common queries
CREATE OR REPLACE VIEW admin_type_registry_summary AS
SELECT 
  it.*,
  fd_count.field_count,
  link_count.link_count,
  item_count.item_usage_count
FROM item_type_registry it
LEFT JOIN (
  SELECT 
    item_type, 
    COUNT(*) as field_count
  FROM field_definitions
  GROUP BY item_type
) fd_count ON it.slug = fd_count.item_type
LEFT JOIN (
  SELECT 
    source_item_type, 
    COUNT(*) as link_count
  FROM link_type_definitions
  GROUP BY source_item_type
) link_count ON it.slug = link_count.source_item_type
LEFT JOIN (
  SELECT 
    item_type, 
    COUNT(*) as item_usage_count
  FROM items
  GROUP BY item_type
) item_count ON it.slug = item_count.item_type;

CREATE OR REPLACE VIEW admin_pack_lifecycle_summary AS
SELECT 
  ip.*,
  cp.name as pack_name,
  cp.category as pack_category,
  recent_operations.operation_count,
  recent_operations.success_rate,
  recent_operations.last_operation,
  dependency_count.dep_count
FROM installed_packs ip
LEFT JOIN config_packs cp ON ip.pack_id = cp.id
LEFT JOIN (
  SELECT 
    installed_pack_id,
    COUNT(*) as operation_count,
    ROUND(
      COUNT(*) FILTER (WHERE operation_status = 'completed') * 100.0 / 
      NULLIF(COUNT(*), 0), 2
    ) as success_rate,
    MAX(started_at) as last_operation
  FROM pack_install_history
  WHERE started_at >= now() - interval '30 days'
  GROUP BY installed_pack_id
) recent_operations ON ip.id = recent_operations.installed_pack_id
LEFT JOIN (
  SELECT 
    installed_pack_id,
    COUNT(*) as dep_count
  FROM pack_dependencies
  GROUP BY installed_pack_id
) dependency_count ON ip.id = dependency_count.installed_pack_id;

CREATE OR REPLACE VIEW admin_agent_performance_summary AS
SELECT 
  ac.*,
  exec_stats.execution_count,
  exec_stats.success_rate,
  exec_stats.avg_duration_ms,
  exec_stats.last_execution,
  exec_stats.running_count
FROM agent_contracts ac
LEFT JOIN (
  SELECT 
    contract_id,
    COUNT(*) as execution_count,
    ROUND(
      COUNT(*) FILTER (WHERE execution_status = 'completed') * 100.0 / 
      NULLIF(COUNT(*), 0), 2
    ) as success_rate,
    COALESCE(AVG(duration_ms), 0) as avg_duration_ms,
    MAX(started_at) as last_execution,
    COUNT(*) FILTER (WHERE execution_status = 'running') as running_count
  FROM agent_executions
  GROUP BY contract_id
) exec_stats ON ac.id = exec_stats.contract_id;

-- Add updated_at triggers
CREATE TRIGGER trg_admin_audit_views_updated_at
  BEFORE UPDATE ON admin_audit_views
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_admin_dashboard_widgets_updated_at
  BEFORE UPDATE ON admin_dashboard_widgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
