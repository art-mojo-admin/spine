-- 038: Phase B - Introspection Endpoint
-- Adds system introspection capabilities for schema and runtime information

BEGIN;

-- Create schema introspection functions
CREATE OR REPLACE FUNCTION get_account_schema(
  introspect_account_id uuid,
  include_system_types boolean DEFAULT false
)
RETURNS jsonb AS $$
DECLARE
  schema_info jsonb;
BEGIN
  SELECT jsonb_build_object(
    'account_id', introspect_account_id,
    'item_types', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'slug', slug,
          'label', label,
          'description', description,
          'ownership', ownership,
          'lifecycle_states', lifecycle_states,
          'default_status', default_status,
          'allowed_link_types', allowed_link_types,
          'embedding_strategy', embedding_strategy,
          'indexing_hints', indexing_hints,
          'permission_behavior', permission_behavior,
          'display_hints', display_hints,
          'search_config', search_config
        )
      )
      FROM item_type_registry
      WHERE (include_system_types OR ownership != 'system')
    ),
    'field_definitions', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'item_type', item_type,
          'field_key', field_key,
          'field_type', field_type,
          'field_label', field_label,
          'is_required', is_required,
          'default_value', default_value,
          'validation_rules', validation_rules,
          'display_config', display_config,
          'ownership', ownership
        )
      )
      FROM field_definitions
      WHERE account_id = introspect_account_id
    ),
    'link_types', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'slug', slug,
          'label', label,
          'source_item_type', source_item_type,
          'target_item_type', target_item_type,
          'is_directional', is_directional,
          'cardinality', cardinality,
          'constraints', constraints
        )
      )
      FROM link_type_definitions
      WHERE account_id = introspect_account_id
    )
  ) INTO schema_info;
  
  RETURN schema_info;
END;
$$ LANGUAGE plpgsql;

-- Function to get runtime statistics
CREATE OR REPLACE FUNCTION get_runtime_stats(
  stats_account_id uuid
)
RETURNS jsonb AS $$
DECLARE
  stats_info jsonb;
BEGIN
  SELECT jsonb_build_object(
    'account_id', stats_account_id,
    'generated_at', now(),
    'item_counts', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'item_type', item_type,
          'count', count,
          'status_breakdown', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'status', status,
                'count', status_count
              )
            )
            FROM (
              SELECT status, COUNT(*) as status_count
              FROM items
              WHERE account_id = stats_account_id
                AND item_type = item_counts.item_type
              GROUP BY status
            ) status_counts
          )
        )
      )
      FROM (
        SELECT item_type, COUNT(*) as count
        FROM items
        WHERE account_id = stats_account_id
        GROUP BY item_type
      ) item_counts
    ),
    'link_counts', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'link_type', link_type,
          'count', count
        )
      )
      FROM (
        SELECT link_type, COUNT(*) as count
        FROM item_links
        WHERE account_id = stats_account_id
        GROUP BY link_type
      ) link_counts
    ),
    'thread_activity', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'thread_type', thread_type,
          'status', status,
          'count', count,
          'avg_messages', avg_messages
        )
      )
      FROM (
        SELECT 
          thread_type, 
          status, 
          COUNT(*) as count,
          AVG(message_count) as avg_messages
        FROM active_item_threads
        WHERE account_id = stats_account_id
        GROUP BY thread_type, status
      ) thread_stats
    ),
    'event_volume', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'event_type', event_type,
          'count', count,
          'latest_event', latest_event
        )
      )
      FROM (
        SELECT 
          event_type, 
          COUNT(*) as count,
          MAX(created_at) as latest_event
        FROM item_events
        WHERE account_id = stats_account_id
          AND created_at >= now() - interval '30 days'
        GROUP BY event_type
      ) event_stats
    )
  ) INTO stats_info;
  
  RETURN stats_info;
END;
$$ LANGUAGE plpgsql;

-- Function to get principal information
CREATE OR REPLACE FUNCTION get_principal_info(
  principal_account_id uuid,
  principal_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  principal_info jsonb;
BEGIN
  IF principal_id IS NOT NULL THEN
    -- Specific principal info
    SELECT jsonb_build_object(
      'principal_id', principal_id,
      'account_id', principal_account_id,
      'principal_type', principal_type,
      'display_name', display_name,
      'status', status,
      'metadata', metadata,
      'person_info', (
        SELECT jsonb_build_object(
          'id', p.id,
          'email', p.email,
          'full_name', p.full_name,
          'status', p.status
        )
        FROM persons p
        WHERE p.id = principals.person_id
      ),
      'machine_info', (
        SELECT jsonb_build_object(
          'id', mp.id,
          'name', mp.name,
          'kind', mp.kind,
          'auth_mode', mp.auth_mode,
          'status', mp.status
        )
        FROM machine_principals mp
        WHERE mp.id = principals.machine_principal_id
      ),
      'memberships', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'account_id', m.account_id,
            'account_role', m.account_role,
            'status', m.status,
            'granted_at', m.granted_at
          )
        )
        FROM memberships m
        WHERE m.principal_id = principal_id
      ),
      'scopes', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'scope_slug', scope_slug,
            'granted_at', granted_at,
            'status', status
          )
        )
        FROM principal_scopes
        WHERE principal_id = principal_id
          AND status = 'active'
      )
    ) INTO principal_info
    FROM principals
    WHERE id = principal_id;
  ELSE
    -- All principals for account
    SELECT jsonb_build_object(
      'account_id', principal_account_id,
      'principals', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', id,
            'principal_type', principal_type,
            'display_name', display_name,
            'status', status
          )
        )
        FROM principals
        WHERE id IN (
          SELECT principal_id FROM memberships WHERE account_id = principal_account_id
        )
      )
    ) INTO principal_info;
  END IF;
  
  RETURN principal_info;
END;
$$ LANGUAGE plpgsql;

-- Function to get system health and configuration
CREATE OR REPLACE FUNCTION get_system_health()
RETURNS jsonb AS $$
DECLARE
  health_info jsonb;
BEGIN
  SELECT jsonb_build_object(
    'timestamp', now(),
    'database_version', version(),
    'pgvector_version', (
      SELECT default_version 
      FROM pg_available_extensions 
      WHERE name = 'vector'
    ),
    'table_stats', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'table_name', table_name,
          'row_count', row_count,
          'size_bytes', pg_total_relation_size(table_name::text)
        )
      )
      FROM (
        SELECT 
          schemaname||'.'||tablename as table_name,
          n_tup_ins - n_tup_del as row_count
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
          AND tablename IN ('items', 'principals', 'item_events', 'item_links', 'threads', 'messages', 'embeddings')
      ) table_stats
    ),
    'index_usage', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'index_name', indexrelname,
          'table_name', schemaname||'.'||tablename,
          'scans', idx_scan,
          'tuples_read', idx_tup_read,
          'size_bytes', pg_relation_size(indexrelid)
        )
      )
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND idx_scan > 0
    ),
    'recent_errors', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'error_type', error_type,
          'count', error_count,
          'last_seen', last_seen
        )
      )
      FROM (
        SELECT 
          'migration_error' as error_type,
          COUNT(*) as error_count,
          MAX(created_at) as last_seen
        FROM audit_log
        WHERE action = 'migration_error'
          AND created_at >= now() - interval '24 hours'
      UNION ALL
        SELECT 
          'auth_failure' as error_type,
          COUNT(*) as error_count,
          MAX(created_at) as last_seen
        FROM audit_log
        WHERE action = 'auth_failure'
          AND created_at >= now() - interval '24 hours'
      ) error_stats
      WHERE error_count > 0
    )
  ) INTO health_info;
  
  RETURN health_info;
END;
$$ LANGUAGE plpgsql;

-- Create view for quick system overview
CREATE OR REPLACE VIEW system_overview AS
SELECT 
  (SELECT COUNT(*) FROM items) as total_items,
  (SELECT COUNT(*) FROM principals) as total_principals,
  (SELECT COUNT(*) FROM item_links) as total_links,
  (SELECT COUNT(*) FROM item_events) as total_events,
  (SELECT COUNT(*) FROM threads) as total_threads,
  (SELECT COUNT(*) FROM messages) as total_messages,
  (SELECT COUNT(*) FROM embeddings) as total_embeddings,
  (SELECT COUNT(DISTINCT account_id) FROM items) as active_accounts,
  (SELECT MAX(created_at) FROM items) as latest_item_activity,
  (SELECT MAX(created_at) FROM item_events) as latest_event_activity;

-- Grant necessary permissions for introspection functions
GRANT EXECUTE ON FUNCTION get_account_schema TO authenticated;
GRANT EXECUTE ON FUNCTION get_runtime_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_principal_info TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_health TO authenticated;
GRANT SELECT ON system_overview TO authenticated;

COMMIT;
