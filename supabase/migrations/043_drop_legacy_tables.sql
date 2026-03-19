-- 043: Drop legacy tables from pre-Phase-A era
-- These tables are fully superseded by Phase A-E architecture

BEGIN;

-- Drop legacy entity system (replaced by item-centric model)
DROP TABLE IF EXISTS entity_links CASCADE;
DROP TABLE IF EXISTS entity_watchers CASCADE;
DROP TABLE IF EXISTS entity_attachments CASCADE;

-- Drop legacy field definitions (replaced by field_definitions)
DROP TABLE IF EXISTS custom_field_definitions CASCADE;

-- Drop legacy knowledge system (migrated to items in 027)
DROP TABLE IF EXISTS knowledge_base_articles CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS lesson_completions CASCADE;

-- Drop legacy pack system (replaced by Phase C lifecycle)
DROP TABLE IF EXISTS pack_activations CASCADE;
DROP TABLE IF EXISTS pack_entity_mappings CASCADE;
DROP TABLE IF EXISTS account_modules CASCADE;

-- Drop legacy admin/metrics tables (replaced by Phase E system)
DROP TABLE IF EXISTS admin_counts CASCADE;
DROP TABLE IF EXISTS metrics_snapshots CASCADE;

COMMIT;
