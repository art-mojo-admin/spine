-- ============================================================================
-- Spine: NAMESPACED Installation SQL (Multi-Instance on One Supabase Project)
-- Each instance lives in its own PostgreSQL schema, allowing side-by-side
-- installations on the same database (e.g. spine_v1, spine_v2, client_a).
--
-- ┌──────────────────────────────────────────────────────────────────────┐
-- │  CONFIGURE: Change 'spine_v1' on the TWO lines below, then run.    │
-- └──────────────────────────────────────────────────────────────────────┘
CREATE SCHEMA IF NOT EXISTS spine_v1;
SET search_path TO spine_v1, extensions;
-- ════════════════════════════════════════════════════════════════════════════
-- Everything below auto-derives the schema from current_schema().
-- No further edits needed.
-- ════════════════════════════════════════════════════════════════════════════

-- App-side requirement:
--   supabase-js clients must set  db: { schema: '<your_schema>' }
--   Add the schema to Supabase Dashboard → Settings → API → Exposed schemas.
--   See SETUP.md for details.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- 001: EXTENSIONS (database-wide — safe to repeat)
-- ════════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ════════════════════════════════════════════════════════════════════════════
-- 002: ACCOUNTS
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS accounts (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_type  text NOT NULL CHECK (account_type IN ('individual', 'organization')),
  display_name  text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  settings      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 003: PERSONS
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS persons (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_uid      uuid UNIQUE,
  email         text NOT NULL UNIQUE,
  full_name     text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persons_email ON persons(email);
CREATE INDEX IF NOT EXISTS idx_persons_auth_uid ON persons(auth_uid);
CREATE INDEX IF NOT EXISTS idx_persons_status ON persons(status);

DROP TRIGGER IF EXISTS trg_persons_updated_at ON persons;
CREATE TRIGGER trg_persons_updated_at
  BEFORE UPDATE ON persons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 004: PROFILES
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id     uuid NOT NULL UNIQUE REFERENCES persons(id) ON DELETE CASCADE,
  display_name  text NOT NULL,
  avatar_url    text,
  system_role   text CHECK (system_role IN ('system_admin', 'system_operator', 'support_operator')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_person_id ON profiles(person_id);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 005: MEMBERSHIPS
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS memberships (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id     uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  account_role  text NOT NULL DEFAULT 'member',
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(person_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_person_id ON memberships(person_id);
CREATE INDEX IF NOT EXISTS idx_memberships_account_id ON memberships(account_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);

DROP TRIGGER IF EXISTS trg_memberships_updated_at ON memberships;
CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 006: AUDIT LOG
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_log (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid REFERENCES accounts(id),
  person_id     uuid REFERENCES persons(id),
  request_id    text NOT NULL,
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     uuid,
  before_data   jsonb,
  after_data    jsonb,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_account_id ON audit_log(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_request_id ON audit_log(request_id);

CREATE TABLE IF NOT EXISTS audit_event_batches (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id         uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source             text NOT NULL,
  batch_identifier   text,
  event_count        integer NOT NULL DEFAULT 0,
  payload            jsonb NOT NULL DEFAULT '{}',
  processing_status  text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  processed_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_audit_event_batches_account ON audit_event_batches(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_batches_status ON audit_event_batches(processing_status);

-- ════════════════════════════════════════════════════════════════════════════
-- 007: ACTIVITY EVENTS
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS activity_events (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid REFERENCES accounts(id),
  person_id     uuid REFERENCES persons(id),
  request_id    text,
  event_type    text NOT NULL,
  entity_type   text,
  entity_id     uuid,
  summary       text NOT NULL,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_account_id ON activity_events(account_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_entity ON activity_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_event_type ON activity_events(event_type);

-- ════════════════════════════════════════════════════════════════════════════
-- 008: WORKFLOW DEFINITIONS
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  config        jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_account_id ON workflow_definitions(account_id);

DROP TRIGGER IF EXISTS trg_workflow_definitions_updated_at ON workflow_definitions;
CREATE TRIGGER trg_workflow_definitions_updated_at
  BEFORE UPDATE ON workflow_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS stage_definitions (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_definition_id  uuid NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  description             text,
  position                integer NOT NULL DEFAULT 0,
  allowed_transitions     uuid[] DEFAULT '{}',
  is_initial              boolean NOT NULL DEFAULT false,
  is_terminal             boolean NOT NULL DEFAULT false,
  config                  jsonb NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_definitions_workflow ON stage_definitions(workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_stage_definitions_position ON stage_definitions(workflow_definition_id, position);

DROP TRIGGER IF EXISTS trg_stage_definitions_updated_at ON stage_definitions;
CREATE TRIGGER trg_stage_definitions_updated_at
  BEFORE UPDATE ON stage_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 009: WORKFLOW ITEMS + AUTOMATION RULES
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS workflow_items (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id              uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  workflow_definition_id  uuid NOT NULL REFERENCES workflow_definitions(id),
  stage_definition_id     uuid NOT NULL REFERENCES stage_definitions(id),
  workflow_type           text NOT NULL,
  title                   text NOT NULL,
  description             text,
  owner_person_id         uuid REFERENCES persons(id),
  due_date                date,
  entity_type             text,
  entity_id               uuid,
  priority                text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  metadata                jsonb NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_items_account_id ON workflow_items(account_id);
CREATE INDEX IF NOT EXISTS idx_workflow_items_workflow ON workflow_items(workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_workflow_items_stage ON workflow_items(stage_definition_id);
CREATE INDEX IF NOT EXISTS idx_workflow_items_owner ON workflow_items(owner_person_id);
CREATE INDEX IF NOT EXISTS idx_workflow_items_entity ON workflow_items(entity_type, entity_id);

DROP TRIGGER IF EXISTS trg_workflow_items_updated_at ON workflow_items;
CREATE TRIGGER trg_workflow_items_updated_at
  BEFORE UPDATE ON workflow_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS automation_rules (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id              uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  workflow_definition_id  uuid REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  description             text,
  trigger_event           text NOT NULL,
  conditions              jsonb NOT NULL DEFAULT '[]',
  action_type             text NOT NULL,
  action_config           jsonb NOT NULL DEFAULT '{}',
  enabled                 boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_account_id ON automation_rules(account_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON automation_rules(trigger_event);
CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON automation_rules(enabled);

DROP TRIGGER IF EXISTS trg_automation_rules_updated_at ON automation_rules;
CREATE TRIGGER trg_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 010: TICKETS
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tickets (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id        uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject           text NOT NULL,
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  priority          text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category          text,
  opened_by_person_id uuid NOT NULL REFERENCES persons(id),
  assigned_to_person_id uuid REFERENCES persons(id),
  entity_type       text,
  entity_id         uuid,
  metadata          jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_account_id ON tickets(account_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(account_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(account_id, priority);
CREATE INDEX IF NOT EXISTS idx_tickets_opened_by ON tickets(opened_by_person_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to_person_id);
CREATE INDEX IF NOT EXISTS idx_tickets_entity ON tickets(entity_type, entity_id);

DROP TRIGGER IF EXISTS trg_tickets_updated_at ON tickets;
CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS ticket_messages (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id     uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  person_id     uuid NOT NULL REFERENCES persons(id),
  body          text NOT NULL,
  is_internal   boolean NOT NULL DEFAULT false,
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON ticket_messages(ticket_id, created_at);

-- ════════════════════════════════════════════════════════════════════════════
-- 011: KNOWLEDGE BASE ARTICLES
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS knowledge_base_articles (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title         text NOT NULL,
  slug          text NOT NULL,
  body          text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  category      text,
  author_person_id uuid REFERENCES persons(id),
  metadata      jsonb NOT NULL DEFAULT '{}',
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_kb_articles_account_id ON knowledge_base_articles(account_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON knowledge_base_articles(account_id, status);
CREATE INDEX IF NOT EXISTS idx_kb_articles_slug ON knowledge_base_articles(account_id, slug);

DROP TRIGGER IF EXISTS trg_kb_articles_updated_at ON knowledge_base_articles;
CREATE TRIGGER trg_kb_articles_updated_at
  BEFORE UPDATE ON knowledge_base_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 012: TENANT THEMES
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tenant_themes (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  preset        text NOT NULL DEFAULT 'clean' CHECK (preset IN ('clean', 'bold', 'muted', 'custom')),
  logo_url      text,
  tokens        jsonb NOT NULL DEFAULT '{}',
  dark_tokens   jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_themes_account_id ON tenant_themes(account_id);

DROP TRIGGER IF EXISTS trg_tenant_themes_updated_at ON tenant_themes;
CREATE TRIGGER trg_tenant_themes_updated_at
  BEFORE UPDATE ON tenant_themes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 013: WEBHOOKS
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS outbox_events (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL REFERENCES accounts(id),
  event_type    text NOT NULL,
  entity_type   text,
  entity_id     uuid,
  payload       jsonb NOT NULL DEFAULT '{}',
  processed     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_account_id ON outbox_events(account_id);
CREATE INDEX IF NOT EXISTS idx_outbox_events_processed ON outbox_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_events_event_type ON outbox_events(event_type);

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  url             text NOT NULL,
  enabled         boolean NOT NULL DEFAULT true,
  event_types     text[] NOT NULL DEFAULT '{}',
  signing_secret  text NOT NULL,
  description     text,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_account_id ON webhook_subscriptions(account_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_enabled ON webhook_subscriptions(enabled);

DROP TRIGGER IF EXISTS trg_webhook_subscriptions_updated_at ON webhook_subscriptions;
CREATE TRIGGER trg_webhook_subscriptions_updated_at
  BEFORE UPDATE ON webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_subscription_id uuid NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  outbox_event_id         uuid NOT NULL REFERENCES outbox_events(id),
  status                  text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'dead_letter')),
  attempts                integer NOT NULL DEFAULT 0,
  last_error              text,
  last_status_code        integer,
  next_attempt_at         timestamptz,
  completed_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_subscription ON webhook_deliveries(webhook_subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_attempt ON webhook_deliveries(status, next_attempt_at)
  WHERE status IN ('pending', 'failed');

DROP TRIGGER IF EXISTS trg_webhook_deliveries_updated_at ON webhook_deliveries;
CREATE TRIGGER trg_webhook_deliveries_updated_at
  BEFORE UPDATE ON webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 014: EMBEDDINGS
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS embeddings (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity_type   text NOT NULL,
  entity_id     uuid NOT NULL,
  vector_type   text NOT NULL,
  embedding     vector(1536) NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}',
  model         text NOT NULL DEFAULT 'text-embedding-ada-002',
  version       integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, entity_type, entity_id, vector_type)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_account_id ON embeddings(account_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_entity ON embeddings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_type ON embeddings(account_id, entity_type, vector_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ════════════════════════════════════════════════════════════════════════════
-- 015: INVITES
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS invites (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invited_by    uuid NOT NULL REFERENCES persons(id),
  email         text NOT NULL,
  account_role  text NOT NULL DEFAULT 'member' CHECK (account_role IN ('admin', 'operator', 'member')),
  token         text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invites_account_id ON invites(account_id);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);

-- ════════════════════════════════════════════════════════════════════════════
-- 017: WORKFLOW BUILDER (transitions + actions)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS transition_definitions (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_definition_id  uuid NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  from_stage_id           uuid NOT NULL REFERENCES stage_definitions(id) ON DELETE CASCADE,
  to_stage_id             uuid NOT NULL REFERENCES stage_definitions(id) ON DELETE CASCADE,
  conditions              jsonb NOT NULL DEFAULT '[]',
  require_comment         boolean NOT NULL DEFAULT false,
  require_fields          text[] DEFAULT '{}',
  position                integer NOT NULL DEFAULT 0,
  config                  jsonb NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transition_definitions_workflow ON transition_definitions(workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_transition_definitions_from ON transition_definitions(from_stage_id);
CREATE INDEX IF NOT EXISTS idx_transition_definitions_to ON transition_definitions(to_stage_id);

DROP TRIGGER IF EXISTS trg_transition_definitions_updated_at ON transition_definitions;
CREATE TRIGGER trg_transition_definitions_updated_at
  BEFORE UPDATE ON transition_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS workflow_actions (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_definition_id  uuid NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  trigger_type            text NOT NULL CHECK (trigger_type IN (
    'on_enter_stage', 'on_exit_stage', 'on_transition', 'on_create'
  )),
  trigger_ref_id          uuid,
  action_type             text NOT NULL CHECK (action_type IN (
    'webhook', 'update_field', 'emit_event', 'ai_prompt', 'create_entity', 'send_notification'
  )),
  action_config           jsonb NOT NULL DEFAULT '{}',
  conditions              jsonb NOT NULL DEFAULT '[]',
  position                integer NOT NULL DEFAULT 0,
  enabled                 boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_actions_workflow ON workflow_actions(workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_workflow_actions_trigger ON workflow_actions(trigger_type, trigger_ref_id);
CREATE INDEX IF NOT EXISTS idx_workflow_actions_enabled ON workflow_actions(enabled);

DROP TRIGGER IF EXISTS trg_workflow_actions_updated_at ON workflow_actions;
CREATE TRIGGER trg_workflow_actions_updated_at
  BEFORE UPDATE ON workflow_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 018: INBOUND WEBHOOKS
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS inbound_webhook_keys (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name            text NOT NULL,
  api_key         text NOT NULL UNIQUE,
  enabled         boolean NOT NULL DEFAULT true,
  last_used_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbound_webhook_keys_account ON inbound_webhook_keys(account_id);
CREATE INDEX IF NOT EXISTS idx_inbound_webhook_keys_api_key ON inbound_webhook_keys(api_key);

DROP TRIGGER IF EXISTS trg_inbound_webhook_keys_updated_at ON inbound_webhook_keys;
CREATE TRIGGER trg_inbound_webhook_keys_updated_at
  BEFORE UPDATE ON inbound_webhook_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS inbound_webhook_mappings (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id              uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  event_name              text NOT NULL,
  action                  text NOT NULL CHECK (action IN (
    'transition_item', 'update_item_field', 'create_item', 'emit_event'
  )),
  action_config           jsonb NOT NULL DEFAULT '{}',
  conditions              jsonb NOT NULL DEFAULT '[]',
  enabled                 boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbound_webhook_mappings_account ON inbound_webhook_mappings(account_id);
CREATE INDEX IF NOT EXISTS idx_inbound_webhook_mappings_event ON inbound_webhook_mappings(event_name);

DROP TRIGGER IF EXISTS trg_inbound_webhook_mappings_updated_at ON inbound_webhook_mappings;
CREATE TRIGGER trg_inbound_webhook_mappings_updated_at
  BEFORE UPDATE ON inbound_webhook_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 019: CUSTOM FIELDS
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity_type     text NOT NULL CHECK (entity_type IN (
    'account', 'person', 'workflow_item', 'ticket', 'kb_article'
  )),
  name            text NOT NULL,
  field_key       text NOT NULL,
  field_type      text NOT NULL CHECK (field_type IN (
    'text', 'number', 'date', 'boolean', 'select', 'multi_select', 'url', 'email', 'textarea'
  )),
  options         jsonb NOT NULL DEFAULT '[]',
  required        boolean NOT NULL DEFAULT false,
  default_value   text,
  section         text,
  position        integer NOT NULL DEFAULT 0,
  enabled         boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, entity_type, field_key)
);

CREATE INDEX IF NOT EXISTS idx_custom_field_defs_account ON custom_field_definitions(account_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_defs_entity ON custom_field_definitions(account_id, entity_type);

DROP TRIGGER IF EXISTS trg_custom_field_definitions_updated_at ON custom_field_definitions;
CREATE TRIGGER trg_custom_field_definitions_updated_at
  BEFORE UPDATE ON custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';
ALTER TABLE persons ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

-- ════════════════════════════════════════════════════════════════════════════
-- 020: KB GLOBAL FLAG
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE knowledge_base_articles
  ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_kb_articles_is_global ON knowledge_base_articles (is_global) WHERE is_global = true;

-- ════════════════════════════════════════════════════════════════════════════
-- 021: SCHEDULED TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS scheduled_triggers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name            text NOT NULL,
  trigger_type    text NOT NULL CHECK (trigger_type IN ('one_time', 'recurring', 'countdown')),
  fire_at         timestamptz,
  cron_expression text,
  next_fire_at    timestamptz,
  delay_seconds   integer,
  delay_event     text,
  action_type     text NOT NULL,
  action_config   jsonb NOT NULL DEFAULT '{}',
  conditions      jsonb NOT NULL DEFAULT '[]',
  enabled         boolean NOT NULL DEFAULT true,
  last_fired_at   timestamptz,
  fire_count      integer NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES persons(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sched_triggers_account ON scheduled_triggers (account_id);
CREATE INDEX IF NOT EXISTS idx_sched_triggers_one_time ON scheduled_triggers (fire_at) WHERE trigger_type = 'one_time' AND enabled = true AND fire_count = 0;
CREATE INDEX IF NOT EXISTS idx_sched_triggers_recurring ON scheduled_triggers (next_fire_at) WHERE trigger_type = 'recurring' AND enabled = true;
CREATE INDEX IF NOT EXISTS idx_sched_triggers_countdown ON scheduled_triggers (delay_event) WHERE trigger_type = 'countdown' AND enabled = true;

CREATE TABLE IF NOT EXISTS scheduled_trigger_instances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id      uuid REFERENCES scheduled_triggers(id) ON DELETE CASCADE,
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  fire_at         timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fired', 'cancelled', 'failed')),
  context         jsonb NOT NULL DEFAULT '{}',
  action_type     text,
  action_config   jsonb,
  result          jsonb,
  fired_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sched_instances_pending ON scheduled_trigger_instances (fire_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sched_instances_trigger ON scheduled_trigger_instances (trigger_id);
CREATE INDEX IF NOT EXISTS idx_sched_instances_account ON scheduled_trigger_instances (account_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 022: ENTITY LINKS
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS entity_links (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source_type   text NOT NULL CHECK (source_type IN ('person', 'account', 'workflow_item', 'ticket', 'kb_article')),
  source_id     uuid NOT NULL,
  target_type   text NOT NULL CHECK (target_type IN ('person', 'account', 'workflow_item', 'ticket', 'kb_article')),
  target_id     uuid NOT NULL,
  link_type     text NOT NULL DEFAULT 'related',
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_by    uuid REFERENCES persons(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, source_type, source_id, target_type, target_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_entity_links_account ON entity_links(account_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_source ON entity_links(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_target ON entity_links(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_link_type ON entity_links(account_id, link_type);

CREATE TABLE IF NOT EXISTS link_type_definitions (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id          uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name                text NOT NULL,
  slug                text NOT NULL,
  source_entity_type  text CHECK (source_entity_type IN ('person', 'account', 'workflow_item', 'ticket', 'kb_article')),
  target_entity_type  text CHECK (target_entity_type IN ('person', 'account', 'workflow_item', 'ticket', 'kb_article')),
  metadata_schema     jsonb NOT NULL DEFAULT '{}',
  color               text,
  icon                text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_link_type_defs_account ON link_type_definitions(account_id);

DROP TRIGGER IF EXISTS trg_link_type_definitions_updated_at ON link_type_definitions;
CREATE TRIGGER trg_link_type_definitions_updated_at
  BEFORE UPDATE ON link_type_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 023: PUBLIC LAYER
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS slug text;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.conname = 'accounts_slug_key' AND n.nspname = current_schema()
  ) THEN
    ALTER TABLE accounts ADD CONSTRAINT accounts_slug_key UNIQUE (slug);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_accounts_slug ON accounts(slug);

ALTER TABLE stage_definitions ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

ALTER TABLE workflow_definitions ADD COLUMN IF NOT EXISTS public_config jsonb NOT NULL DEFAULT '{}';

ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- ════════════════════════════════════════════════════════════════════════════
-- 024: PORTAL ROLE
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_account_role_check;
ALTER TABLE memberships ADD CONSTRAINT memberships_account_role_check
  CHECK (account_role IN ('admin', 'operator', 'member', 'portal'));

-- ════════════════════════════════════════════════════════════════════════════
-- 025: CONFIG PACKS TABLE
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS config_packs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  description text,
  pack_data   jsonb NOT NULL DEFAULT '{}',
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 028: EXTENSION LAYER
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS account_modules (
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

CREATE INDEX IF NOT EXISTS idx_account_modules_account ON account_modules(account_id);
CREATE INDEX IF NOT EXISTS idx_account_modules_slug    ON account_modules(account_id, module_slug) WHERE enabled = true;

CREATE TABLE IF NOT EXISTS custom_action_types (
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

CREATE INDEX IF NOT EXISTS idx_custom_action_types_account ON custom_action_types(account_id);

DROP TRIGGER IF EXISTS trg_custom_action_types_updated ON custom_action_types;
CREATE TRIGGER trg_custom_action_types_updated
  BEFORE UPDATE ON custom_action_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS nav_extensions (
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

CREATE INDEX IF NOT EXISTS idx_nav_extensions_account ON nav_extensions(account_id);
CREATE INDEX IF NOT EXISTS idx_nav_extensions_location ON nav_extensions(account_id, location);

-- ════════════════════════════════════════════════════════════════════════════
-- 029: IMPERSONATION SESSIONS
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_person_id uuid NOT NULL REFERENCES persons(id),
  target_person_id uuid NOT NULL REFERENCES persons(id),
  target_account_id uuid NOT NULL REFERENCES accounts(id),
  target_account_role text NOT NULL,
  reason        text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  ended_at      timestamptz,
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'expired', 'ended')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impersonation_active ON impersonation_sessions (admin_person_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_impersonation_target ON impersonation_sessions (target_person_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 032: OBSERVABILITY
-- ════════════════════════════════════════════════════════════════════════════
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

-- ════════════════════════════════════════════════════════════════════════════
-- 030: RLS ENABLE
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE transition_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_webhook_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_webhook_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_trigger_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_action_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE nav_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_snapshots ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════════
-- 030/031: SECURITY LOCKDOWN + FUNCTIONS + RLS POLICIES
-- All dynamic SQL — schema name derived from current_schema()
-- ════════════════════════════════════════════════════════════════════════════
DO $security$
DECLARE
  _s text := current_schema();
  _pol record;
BEGIN
  -- ── Revoke direct access (defence-in-depth; app uses service_role) ────
  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM anon', _s);
  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM authenticated', _s);
  EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM anon', _s);
  EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM authenticated', _s);

  -- ── Pin search_path on trigger + RPC functions ────────────────────────
  EXECUTE format('ALTER FUNCTION %I.update_updated_at() SET search_path = %I, extensions', _s, _s);

  -- ── match_embeddings RPC ──────────────────────────────────────────────
  EXECUTE format($f$
    CREATE OR REPLACE FUNCTION %1$I.match_embeddings(
      query_embedding text,
      match_count int DEFAULT 10,
      p_account_id uuid DEFAULT NULL
    )
    RETURNS TABLE (
      id uuid, account_id uuid, entity_type text, entity_id uuid,
      vector_type text, metadata jsonb, model text,
      created_at timestamptz, similarity float
    )
    LANGUAGE plpgsql SET search_path = %1$I, extensions
    AS $fn$
    BEGIN
      RETURN QUERY
      SELECT e.id, e.account_id, e.entity_type, e.entity_id,
             e.vector_type, e.metadata, e.model, e.created_at,
             1 - (e.embedding <=> query_embedding::vector) AS similarity
      FROM embeddings e
      WHERE (p_account_id IS NULL OR e.account_id = p_account_id)
      ORDER BY e.embedding <=> query_embedding::vector
      LIMIT match_count;
    END;
    $fn$
  $f$, _s);

  -- ── SECURITY DEFINER helper functions ─────────────────────────────────
  EXECUTE format($f$
    CREATE OR REPLACE FUNCTION %1$I.user_account_ids()
    RETURNS SETOF uuid
    LANGUAGE sql SECURITY DEFINER STABLE SET search_path = %1$I, extensions
    AS $fn$
      SELECT m.account_id FROM memberships m
      JOIN persons p ON p.id = m.person_id
      WHERE p.auth_uid = auth.uid() AND m.status = 'active';
    $fn$
  $f$, _s);

  EXECUTE format($f$
    CREATE OR REPLACE FUNCTION %1$I.user_person_id()
    RETURNS uuid
    LANGUAGE sql SECURITY DEFINER STABLE SET search_path = %1$I, extensions
    AS $fn$
      SELECT p.id FROM persons p WHERE p.auth_uid = auth.uid() LIMIT 1;
    $fn$
  $f$, _s);

  EXECUTE format($f$
    CREATE OR REPLACE FUNCTION %1$I.user_admin_account_ids()
    RETURNS SETOF uuid
    LANGUAGE sql SECURITY DEFINER STABLE SET search_path = %1$I, extensions
    AS $fn$
      SELECT m.account_id FROM memberships m
      JOIN persons p ON p.id = m.person_id
      WHERE p.auth_uid = auth.uid() AND m.status = 'active'
        AND m.account_role IN ('admin', 'operator');
    $fn$
  $f$, _s);

  -- ── Drop all existing Spine policies in THIS schema ───────────────────
  FOR _pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = _s
      AND policyname IN (
        'accounts_select','accounts_update',
        'wf_defs_select','wf_defs_modify',
        'stage_defs_select','stage_defs_modify',
        'trans_defs_select','trans_defs_modify',
        'wf_actions_select','wf_actions_modify',
        'wf_items_select','wf_items_insert','wf_items_update',
        'auto_rules_select','auto_rules_modify',
        'tickets_select','tickets_insert','tickets_update',
        'ticket_msgs_select','ticket_msgs_insert',
        'kb_select','kb_modify',
        'themes_select','themes_modify',
        'cfd_select','cfd_modify',
        'elinks_select','elinks_insert','elinks_delete',
        'ltdefs_select','ltdefs_modify',
        'embed_select',
        'modules_select','modules_modify',
        'cat_select','cat_modify',
        'navext_select','navext_modify',
        'webhooksub_select','webhooksub_modify',
        'outbox_select',
        'whdeliv_select',
        'schtrig_select','schtrig_modify',
        'schtrigi_select',
        'iwm_select','iwm_modify',
        'persons_select_own','persons_update_own',
        'profiles_select','profiles_update_own',
        'memberships_select','memberships_modify',
        'invites_select','invites_modify',
        'audit_select','activity_select','packs_select',
        'error_events_select','metrics_snapshots_select'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', _pol.policyname, _s, _pol.tablename);
  END LOOP;

  -- ── Tenant-scoped policies ────────────────────────────────────────────
  EXECUTE format($p$
    CREATE POLICY "accounts_select" ON %1$I.accounts FOR SELECT TO authenticated
      USING (id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "accounts_update" ON %1$I.accounts FOR UPDATE TO authenticated
      USING (id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "wf_defs_select" ON %1$I.workflow_definitions FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "wf_defs_modify" ON %1$I.workflow_definitions FOR ALL TO authenticated
      USING (account_id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "stage_defs_select" ON %1$I.stage_definitions FOR SELECT TO authenticated
      USING (workflow_definition_id IN (
        SELECT id FROM %1$I.workflow_definitions WHERE account_id IN (SELECT %1$I.user_account_ids())
      ))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "stage_defs_modify" ON %1$I.stage_definitions FOR ALL TO authenticated
      USING (workflow_definition_id IN (
        SELECT id FROM %1$I.workflow_definitions WHERE account_id IN (SELECT %1$I.user_admin_account_ids())
      ))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "trans_defs_select" ON %1$I.transition_definitions FOR SELECT TO authenticated
      USING (workflow_definition_id IN (
        SELECT id FROM %1$I.workflow_definitions WHERE account_id IN (SELECT %1$I.user_account_ids())
      ))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "trans_defs_modify" ON %1$I.transition_definitions FOR ALL TO authenticated
      USING (workflow_definition_id IN (
        SELECT id FROM %1$I.workflow_definitions WHERE account_id IN (SELECT %1$I.user_admin_account_ids())
      ))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "wf_actions_select" ON %1$I.workflow_actions FOR SELECT TO authenticated
      USING (workflow_definition_id IN (
        SELECT id FROM %1$I.workflow_definitions WHERE account_id IN (SELECT %1$I.user_account_ids())
      ))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "wf_actions_modify" ON %1$I.workflow_actions FOR ALL TO authenticated
      USING (workflow_definition_id IN (
        SELECT id FROM %1$I.workflow_definitions WHERE account_id IN (SELECT %1$I.user_admin_account_ids())
      ))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "wf_items_select" ON %1$I.workflow_items FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "wf_items_insert" ON %1$I.workflow_items FOR INSERT TO authenticated
      WITH CHECK (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "wf_items_update" ON %1$I.workflow_items FOR UPDATE TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "auto_rules_select" ON %1$I.automation_rules FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "auto_rules_modify" ON %1$I.automation_rules FOR ALL TO authenticated
      USING (account_id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "tickets_select" ON %1$I.tickets FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "tickets_insert" ON %1$I.tickets FOR INSERT TO authenticated
      WITH CHECK (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "tickets_update" ON %1$I.tickets FOR UPDATE TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "ticket_msgs_select" ON %1$I.ticket_messages FOR SELECT TO authenticated
      USING (ticket_id IN (
        SELECT id FROM %1$I.tickets WHERE account_id IN (SELECT %1$I.user_account_ids())
      ))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "ticket_msgs_insert" ON %1$I.ticket_messages FOR INSERT TO authenticated
      WITH CHECK (ticket_id IN (
        SELECT id FROM %1$I.tickets WHERE account_id IN (SELECT %1$I.user_account_ids())
      ))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "kb_select" ON %1$I.knowledge_base_articles FOR SELECT TO authenticated
      USING (
        account_id IN (SELECT %1$I.user_account_ids())
        OR is_global = true
      )
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "kb_modify" ON %1$I.knowledge_base_articles FOR ALL TO authenticated
      USING (account_id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "themes_select" ON %1$I.tenant_themes FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "themes_modify" ON %1$I.tenant_themes FOR ALL TO authenticated
      USING (account_id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "cfd_select" ON %1$I.custom_field_definitions FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "cfd_modify" ON %1$I.custom_field_definitions FOR ALL TO authenticated
      USING (account_id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "elinks_select" ON %1$I.entity_links FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "elinks_insert" ON %1$I.entity_links FOR INSERT TO authenticated
      WITH CHECK (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "elinks_delete" ON %1$I.entity_links FOR DELETE TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "ltdefs_select" ON %1$I.link_type_definitions FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "ltdefs_modify" ON %1$I.link_type_definitions FOR ALL TO authenticated
      USING (account_id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "embed_select" ON %1$I.embeddings FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "modules_select" ON %1$I.account_modules FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "modules_modify" ON %1$I.account_modules FOR ALL TO authenticated
      USING (account_id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "cat_select" ON %1$I.custom_action_types FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "cat_modify" ON %1$I.custom_action_types FOR ALL TO authenticated
      USING (account_id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "navext_select" ON %1$I.nav_extensions FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "navext_modify" ON %1$I.nav_extensions FOR ALL TO authenticated
      USING (account_id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "webhooksub_select" ON %1$I.webhook_subscriptions FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "webhooksub_modify" ON %1$I.webhook_subscriptions FOR ALL TO authenticated
      USING (account_id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "outbox_select" ON %1$I.outbox_events FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "whdeliv_select" ON %1$I.webhook_deliveries FOR SELECT TO authenticated
      USING (webhook_subscription_id IN (
        SELECT id FROM %1$I.webhook_subscriptions WHERE account_id IN (SELECT %1$I.user_account_ids())
      ))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "schtrig_select" ON %1$I.scheduled_triggers FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "schtrig_modify" ON %1$I.scheduled_triggers FOR ALL TO authenticated
      USING (account_id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "schtrigi_select" ON %1$I.scheduled_trigger_instances FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "iwm_select" ON %1$I.inbound_webhook_mappings FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "iwm_modify" ON %1$I.inbound_webhook_mappings FOR ALL TO authenticated
      USING (account_id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);

  -- ── Identity-scoped policies ──────────────────────────────────────────
  EXECUTE format($p$
    CREATE POLICY "persons_select_own" ON %1$I.persons FOR SELECT TO authenticated
      USING (
        auth_uid = auth.uid()
        OR id IN (
          SELECT m2.person_id FROM %1$I.memberships m2
          WHERE m2.account_id IN (SELECT %1$I.user_account_ids())
            AND m2.status = 'active'
        )
      )
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "persons_update_own" ON %1$I.persons FOR UPDATE TO authenticated
      USING (auth_uid = auth.uid())
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "profiles_select" ON %1$I.profiles FOR SELECT TO authenticated
      USING (
        person_id = %1$I.user_person_id()
        OR person_id IN (
          SELECT m2.person_id FROM %1$I.memberships m2
          WHERE m2.account_id IN (SELECT %1$I.user_account_ids())
            AND m2.status = 'active'
        )
      )
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "profiles_update_own" ON %1$I.profiles FOR UPDATE TO authenticated
      USING (person_id = %1$I.user_person_id())
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "memberships_select" ON %1$I.memberships FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "memberships_modify" ON %1$I.memberships FOR ALL TO authenticated
      USING (account_id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);

  EXECUTE format($p$
    CREATE POLICY "invites_select" ON %1$I.invites FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "invites_modify" ON %1$I.invites FOR ALL TO authenticated
      USING (account_id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);

  -- ── Read-only policies ────────────────────────────────────────────────
  EXECUTE format($p$
    CREATE POLICY "audit_select" ON %1$I.audit_log FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_admin_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "activity_select" ON %1$I.activity_events FOR SELECT TO authenticated
      USING (account_id IN (SELECT %1$I.user_account_ids()))
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "packs_select" ON %1$I.config_packs FOR SELECT TO authenticated
      USING (true)
  $p$, _s);

  -- ── Observability policies (system admins only) ───────────────────────
  EXECUTE format($p$
    CREATE POLICY "error_events_select" ON %1$I.error_events FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM %1$I.profiles p
          JOIN %1$I.persons per ON per.id = p.person_id
          WHERE per.auth_uid = auth.uid()
            AND p.system_role IN ('system_admin', 'system_operator')
        )
      )
  $p$, _s);
  EXECUTE format($p$
    CREATE POLICY "metrics_snapshots_select" ON %1$I.metrics_snapshots FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM %1$I.profiles p
          JOIN %1$I.persons per ON per.id = p.person_id
          WHERE per.auth_uid = auth.uid()
            AND p.system_role IN ('system_admin', 'system_operator')
        )
      )
  $p$, _s);

END $security$;

-- ════════════════════════════════════════════════════════════════════════════
-- TEMPLATE PACKS (skip duplicates via ON CONFLICT)
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.conname = 'config_packs_name_key' AND n.nspname = current_schema()
  ) THEN
    ALTER TABLE config_packs ADD CONSTRAINT config_packs_name_key UNIQUE (name);
  END IF;
END $$;

INSERT INTO config_packs (name, description, is_system, pack_data) VALUES
('CRM Pack', 'Sales pipeline with deal tracking, contact management, and follow-up automations.', true, '{
  "workflows": [{
    "name": "Sales Pipeline",
    "description": "Track deals from lead to close",
    "public_config": {},
    "stages": [
      {"_ref": "lead", "name": "Lead", "position": 0, "is_initial": true},
      {"_ref": "qualified", "name": "Qualified", "position": 1},
      {"_ref": "proposal", "name": "Proposal", "position": 2},
      {"_ref": "negotiation", "name": "Negotiation", "position": 3},
      {"_ref": "closed_won", "name": "Closed Won", "position": 4, "is_terminal": true},
      {"_ref": "closed_lost", "name": "Closed Lost", "position": 5, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Qualify", "_from_ref": "lead", "_to_ref": "qualified"},
      {"name": "Send Proposal", "_from_ref": "qualified", "_to_ref": "proposal"},
      {"name": "Negotiate", "_from_ref": "proposal", "_to_ref": "negotiation"},
      {"name": "Close Won", "_from_ref": "negotiation", "_to_ref": "closed_won", "require_comment": true},
      {"name": "Close Lost", "_from_ref": "negotiation", "_to_ref": "closed_lost", "require_comment": true},
      {"name": "Back to Qualified", "_from_ref": "proposal", "_to_ref": "qualified"}
    ]
  }],
  "custom_fields": [
    {"entity_type": "workflow_item", "name": "Deal Value", "field_key": "deal_value", "field_type": "number"},
    {"entity_type": "workflow_item", "name": "Source", "field_key": "source", "field_type": "select", "options": ["Website", "Referral", "Cold Outreach", "Event", "Other"]},
    {"entity_type": "workflow_item", "name": "Close Date", "field_key": "close_date", "field_type": "date"},
    {"entity_type": "person", "name": "Company", "field_key": "company", "field_type": "text"},
    {"entity_type": "person", "name": "Phone", "field_key": "phone", "field_type": "text"},
    {"entity_type": "person", "name": "Job Title", "field_key": "job_title", "field_type": "text"}
  ],
  "link_types": [
    {"name": "Contact", "slug": "contact", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#3b82f6"},
    {"name": "Company", "slug": "company", "source_entity_type": "workflow_item", "target_entity_type": "account", "color": "#8b5cf6"}
  ],
  "automations": []
}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO config_packs (name, description, is_system, pack_data) VALUES
('Support Pack', 'Ticket management with SLA tracking, escalation workflows, and customer communication.', true, '{
  "workflows": [{
    "name": "Support Escalation",
    "description": "Escalation path for complex support issues",
    "stages": [
      {"_ref": "new", "name": "New", "position": 0, "is_initial": true},
      {"_ref": "triaged", "name": "Triaged", "position": 1},
      {"_ref": "in_progress", "name": "In Progress", "position": 2},
      {"_ref": "awaiting_customer", "name": "Awaiting Customer", "position": 3},
      {"_ref": "resolved", "name": "Resolved", "position": 4, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Triage", "_from_ref": "new", "_to_ref": "triaged"},
      {"name": "Start Work", "_from_ref": "triaged", "_to_ref": "in_progress"},
      {"name": "Ask Customer", "_from_ref": "in_progress", "_to_ref": "awaiting_customer"},
      {"name": "Customer Replied", "_from_ref": "awaiting_customer", "_to_ref": "in_progress"},
      {"name": "Resolve", "_from_ref": "in_progress", "_to_ref": "resolved", "require_comment": true}
    ]
  }],
  "custom_fields": [
    {"entity_type": "ticket", "name": "Product", "field_key": "product", "field_type": "select", "options": ["Core", "API", "Mobile", "Integrations"]},
    {"entity_type": "ticket", "name": "Environment", "field_key": "environment", "field_type": "select", "options": ["Production", "Staging", "Development"]},
    {"entity_type": "ticket", "name": "Severity", "field_key": "severity", "field_type": "select", "options": ["Critical", "Major", "Minor", "Cosmetic"]},
    {"entity_type": "person", "name": "Plan Tier", "field_key": "plan_tier", "field_type": "select", "options": ["Free", "Pro", "Enterprise"]}
  ],
  "link_types": [
    {"name": "Related Ticket", "slug": "related_ticket", "source_entity_type": "ticket", "target_entity_type": "ticket", "color": "#f59e0b"},
    {"name": "Affected Customer", "slug": "affected_customer", "source_entity_type": "ticket", "target_entity_type": "person", "color": "#ef4444"}
  ],
  "automations": []
}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO config_packs (name, description, is_system, pack_data) VALUES
('Recruiting Pack', 'Hiring pipeline with candidate tracking, interview stages, and job posting support.', true, '{
  "workflows": [{
    "name": "Hiring Pipeline",
    "description": "Track candidates through the hiring process",
    "public_config": {"enabled": true, "listing_title": "Open Positions", "visible_fields": ["title", "description", "due_date"]},
    "stages": [
      {"_ref": "open", "name": "Open", "position": 0, "is_initial": true, "is_public": true},
      {"_ref": "applied", "name": "Applied", "position": 1},
      {"_ref": "screening", "name": "Screening", "position": 2},
      {"_ref": "interview", "name": "Interview", "position": 3},
      {"_ref": "offer", "name": "Offer", "position": 4},
      {"_ref": "hired", "name": "Hired", "position": 5, "is_terminal": true},
      {"_ref": "rejected", "name": "Rejected", "position": 6, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Receive Application", "_from_ref": "open", "_to_ref": "applied"},
      {"name": "Screen", "_from_ref": "applied", "_to_ref": "screening"},
      {"name": "Schedule Interview", "_from_ref": "screening", "_to_ref": "interview"},
      {"name": "Extend Offer", "_from_ref": "interview", "_to_ref": "offer"},
      {"name": "Hire", "_from_ref": "offer", "_to_ref": "hired"},
      {"name": "Reject", "_from_ref": "screening", "_to_ref": "rejected", "require_comment": true},
      {"name": "Reject", "_from_ref": "interview", "_to_ref": "rejected", "require_comment": true}
    ]
  }],
  "custom_fields": [
    {"entity_type": "workflow_item", "name": "Department", "field_key": "department", "field_type": "select", "options": ["Engineering", "Design", "Marketing", "Sales", "Operations"], "is_public": true},
    {"entity_type": "workflow_item", "name": "Location", "field_key": "location", "field_type": "text", "is_public": true},
    {"entity_type": "workflow_item", "name": "Salary Range", "field_key": "salary_range", "field_type": "text", "is_public": true},
    {"entity_type": "person", "name": "Resume URL", "field_key": "resume_url", "field_type": "url"},
    {"entity_type": "person", "name": "Skills", "field_key": "skills", "field_type": "multi_select", "options": ["JavaScript", "Python", "React", "Node.js", "SQL", "AWS", "Design", "Marketing"]},
    {"entity_type": "person", "name": "Years of Experience", "field_key": "years_experience", "field_type": "number"}
  ],
  "link_types": [
    {"name": "Candidate", "slug": "candidate", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#10b981"},
    {"name": "Recruiter", "slug": "recruiter", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#6366f1"},
    {"name": "Hiring Manager", "slug": "hiring_manager", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#f97316"}
  ],
  "automations": []
}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO config_packs (name, description, is_system, pack_data) VALUES
('Community Events Pack', 'Event management with RSVP tracking, public event listings, and participant management.', true, '{
  "workflows": [{
    "name": "Event Lifecycle",
    "description": "Manage community events from proposal to completion",
    "public_config": {"enabled": true, "listing_title": "Upcoming Events", "visible_fields": ["title", "description", "due_date"]},
    "stages": [
      {"_ref": "proposed", "name": "Proposed", "position": 0, "is_initial": true},
      {"_ref": "confirmed", "name": "Confirmed", "position": 1, "is_public": true},
      {"_ref": "in_progress", "name": "In Progress", "position": 2, "is_public": true},
      {"_ref": "completed", "name": "Completed", "position": 3, "is_terminal": true},
      {"_ref": "cancelled", "name": "Cancelled", "position": 4, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Confirm", "_from_ref": "proposed", "_to_ref": "confirmed"},
      {"name": "Start Event", "_from_ref": "confirmed", "_to_ref": "in_progress"},
      {"name": "Complete", "_from_ref": "in_progress", "_to_ref": "completed"},
      {"name": "Cancel", "_from_ref": "proposed", "_to_ref": "cancelled", "require_comment": true},
      {"name": "Cancel", "_from_ref": "confirmed", "_to_ref": "cancelled", "require_comment": true}
    ]
  }],
  "custom_fields": [
    {"entity_type": "workflow_item", "name": "Event Date", "field_key": "event_date", "field_type": "date", "is_public": true},
    {"entity_type": "workflow_item", "name": "Location", "field_key": "location", "field_type": "text", "is_public": true},
    {"entity_type": "workflow_item", "name": "Difficulty", "field_key": "difficulty", "field_type": "select", "options": ["Easy", "Moderate", "Hard", "Expert"], "is_public": true},
    {"entity_type": "workflow_item", "name": "Distance (km)", "field_key": "distance_km", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Max Attendees", "field_key": "max_attendees", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Meeting Point", "field_key": "meeting_point", "field_type": "text", "is_public": true}
  ],
  "link_types": [
    {"name": "Participant", "slug": "participant", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#22c55e"},
    {"name": "Organizer", "slug": "organizer", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#a855f7"}
  ],
  "automations": []
}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO config_packs (name, description, is_system, pack_data) VALUES
('Project Management Pack', 'Agile-friendly task and project tracking with sprints, priorities, and dependency links.', true, '{
  "workflows": [{
    "name": "Project Delivery",
    "description": "Track tasks from backlog to completion",
    "stages": [
      {"_ref": "backlog", "name": "Backlog", "position": 0, "is_initial": true},
      {"_ref": "planning", "name": "Planning", "position": 1},
      {"_ref": "in_progress", "name": "In Progress", "position": 2},
      {"_ref": "review", "name": "Review", "position": 3},
      {"_ref": "done", "name": "Done", "position": 4, "is_terminal": true},
      {"_ref": "cancelled", "name": "Cancelled", "position": 5, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Plan", "_from_ref": "backlog", "_to_ref": "planning"},
      {"name": "Start Work", "_from_ref": "planning", "_to_ref": "in_progress"},
      {"name": "Submit for Review", "_from_ref": "in_progress", "_to_ref": "review"},
      {"name": "Approve", "_from_ref": "review", "_to_ref": "done"},
      {"name": "Request Changes", "_from_ref": "review", "_to_ref": "in_progress", "require_comment": true},
      {"name": "Back to Backlog", "_from_ref": "planning", "_to_ref": "backlog"},
      {"name": "Cancel", "_from_ref": "backlog", "_to_ref": "cancelled"},
      {"name": "Cancel", "_from_ref": "planning", "_to_ref": "cancelled"}
    ]
  }],
  "custom_fields": [
    {"entity_type": "workflow_item", "name": "Priority", "field_key": "priority", "field_type": "select", "options": ["Critical", "High", "Medium", "Low"]},
    {"entity_type": "workflow_item", "name": "Estimated Hours", "field_key": "estimated_hours", "field_type": "number"},
    {"entity_type": "workflow_item", "name": "Sprint", "field_key": "sprint", "field_type": "text"},
    {"entity_type": "workflow_item", "name": "Story Points", "field_key": "story_points", "field_type": "number"},
    {"entity_type": "workflow_item", "name": "Task Type", "field_key": "task_type", "field_type": "select", "options": ["Feature", "Bug", "Chore", "Spike", "Epic"]},
    {"entity_type": "person", "name": "Team", "field_key": "team", "field_type": "select", "options": ["Engineering", "Design", "QA", "DevOps", "Product"]}
  ],
  "link_types": [
    {"name": "Depends On", "slug": "depends_on", "source_entity_type": "workflow_item", "target_entity_type": "workflow_item", "color": "#ef4444"},
    {"name": "Blocks", "slug": "blocks", "source_entity_type": "workflow_item", "target_entity_type": "workflow_item", "color": "#f97316"},
    {"name": "Sub-task", "slug": "subtask", "source_entity_type": "workflow_item", "target_entity_type": "workflow_item", "color": "#6366f1"},
    {"name": "Assignee", "slug": "assignee", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#3b82f6"}
  ],
  "automations": [
    {"name": "Notify on Review", "description": "Send webhook when item enters Review", "trigger_event": "workflow_item.stage_changed", "conditions": [{"field": "new_stage_name", "op": "eq", "value": "Review"}], "action_type": "webhook", "action_config": {"url": "{{REVIEW_WEBHOOK_URL}}", "method": "POST"}}
  ]
}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO config_packs (name, description, is_system, pack_data) VALUES
('Real Estate Pack', 'Property listing and deal management with public MLS-style listings, buyer/seller tracking, and deal stages.', true, '{
  "workflows": [{
    "name": "Property Listing",
    "description": "Manage properties from listing to close",
    "public_config": {"enabled": true, "listing_title": "Available Properties", "visible_fields": ["title", "description"]},
    "stages": [
      {"_ref": "draft", "name": "Draft", "position": 0, "is_initial": true},
      {"_ref": "active", "name": "Active", "position": 1, "is_public": true},
      {"_ref": "under_contract", "name": "Under Contract", "position": 2, "is_public": true},
      {"_ref": "pending", "name": "Pending", "position": 3},
      {"_ref": "sold", "name": "Sold", "position": 4, "is_terminal": true},
      {"_ref": "withdrawn", "name": "Withdrawn", "position": 5, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Publish", "_from_ref": "draft", "_to_ref": "active"},
      {"name": "Accept Offer", "_from_ref": "active", "_to_ref": "under_contract"},
      {"name": "Move to Pending", "_from_ref": "under_contract", "_to_ref": "pending"},
      {"name": "Close Sale", "_from_ref": "pending", "_to_ref": "sold", "require_comment": true},
      {"name": "Back to Active", "_from_ref": "under_contract", "_to_ref": "active"},
      {"name": "Withdraw", "_from_ref": "active", "_to_ref": "withdrawn", "require_comment": true},
      {"name": "Withdraw", "_from_ref": "draft", "_to_ref": "withdrawn"}
    ]
  }],
  "custom_fields": [
    {"entity_type": "workflow_item", "name": "Price", "field_key": "price", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Bedrooms", "field_key": "bedrooms", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Bathrooms", "field_key": "bathrooms", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Square Footage", "field_key": "sqft", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Property Type", "field_key": "property_type", "field_type": "select", "options": ["Single Family", "Condo", "Townhouse", "Multi-Family", "Land", "Commercial"], "is_public": true},
    {"entity_type": "workflow_item", "name": "MLS Number", "field_key": "mls_number", "field_type": "text", "is_public": true},
    {"entity_type": "workflow_item", "name": "Year Built", "field_key": "year_built", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Address", "field_key": "address", "field_type": "text", "is_public": true},
    {"entity_type": "person", "name": "License Number", "field_key": "license_number", "field_type": "text"},
    {"entity_type": "person", "name": "Brokerage", "field_key": "brokerage", "field_type": "text"}
  ],
  "link_types": [
    {"name": "Buyer", "slug": "buyer", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#22c55e"},
    {"name": "Seller", "slug": "seller", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#f59e0b"},
    {"name": "Listing Agent", "slug": "listing_agent", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#3b82f6"},
    {"name": "Buying Agent", "slug": "buying_agent", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#8b5cf6"}
  ],
  "automations": []
}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO config_packs (name, description, is_system, pack_data) VALUES
('Nonprofit & Volunteer Pack', 'Volunteer onboarding, program management, and hour tracking for nonprofits and community organizations.', true, '{
  "workflows": [{
    "name": "Volunteer Onboarding",
    "description": "Track volunteers from application to active status",
    "stages": [
      {"_ref": "applied", "name": "Applied", "position": 0, "is_initial": true},
      {"_ref": "screening", "name": "Screening", "position": 1},
      {"_ref": "orientation", "name": "Orientation", "position": 2},
      {"_ref": "active", "name": "Active", "position": 3},
      {"_ref": "inactive", "name": "Inactive", "position": 4, "is_terminal": true},
      {"_ref": "declined", "name": "Declined", "position": 5, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Screen", "_from_ref": "applied", "_to_ref": "screening"},
      {"name": "Schedule Orientation", "_from_ref": "screening", "_to_ref": "orientation"},
      {"name": "Activate", "_from_ref": "orientation", "_to_ref": "active"},
      {"name": "Deactivate", "_from_ref": "active", "_to_ref": "inactive", "require_comment": true},
      {"name": "Reactivate", "_from_ref": "inactive", "_to_ref": "active"},
      {"name": "Decline", "_from_ref": "screening", "_to_ref": "declined", "require_comment": true}
    ]
  },
  {
    "name": "Program Cycle",
    "description": "Manage program delivery from planning to completion",
    "public_config": {"enabled": true, "listing_title": "Our Programs", "visible_fields": ["title", "description"]},
    "stages": [
      {"_ref": "planning", "name": "Planning", "position": 0, "is_initial": true},
      {"_ref": "recruiting", "name": "Recruiting Volunteers", "position": 1, "is_public": true},
      {"_ref": "running", "name": "Running", "position": 2, "is_public": true},
      {"_ref": "completed", "name": "Completed", "position": 3, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Open Recruiting", "_from_ref": "planning", "_to_ref": "recruiting"},
      {"name": "Launch", "_from_ref": "recruiting", "_to_ref": "running"},
      {"name": "Complete", "_from_ref": "running", "_to_ref": "completed", "require_comment": true}
    ]
  }],
  "custom_fields": [
    {"entity_type": "person", "name": "Availability", "field_key": "availability", "field_type": "multi_select", "options": ["Weekday Mornings", "Weekday Afternoons", "Weekday Evenings", "Weekends", "Flexible"]},
    {"entity_type": "person", "name": "Skills", "field_key": "volunteer_skills", "field_type": "multi_select", "options": ["Teaching", "Cooking", "Driving", "Admin", "Fundraising", "Construction", "Medical", "Legal", "IT"]},
    {"entity_type": "person", "name": "Background Check", "field_key": "background_check", "field_type": "select", "options": ["Not Started", "Pending", "Cleared", "Failed"]},
    {"entity_type": "person", "name": "Hours Logged", "field_key": "hours_logged", "field_type": "number"},
    {"entity_type": "workflow_item", "name": "Program Area", "field_key": "program_area", "field_type": "select", "options": ["Education", "Health", "Environment", "Community", "Arts", "Youth"], "is_public": true},
    {"entity_type": "workflow_item", "name": "Volunteers Needed", "field_key": "volunteers_needed", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Start Date", "field_key": "start_date", "field_type": "date", "is_public": true}
  ],
  "link_types": [
    {"name": "Volunteer", "slug": "volunteer", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#22c55e"},
    {"name": "Program Coordinator", "slug": "program_coordinator", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#a855f7"},
    {"name": "Beneficiary", "slug": "beneficiary", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#f59e0b"},
    {"name": "Mentor", "slug": "mentor", "source_entity_type": "person", "target_entity_type": "person", "color": "#6366f1"}
  ],
  "automations": []
}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO config_packs (name, description, is_system, pack_data) VALUES
('IT Service Desk Pack', 'ITIL-aligned incident and change management with escalation, SLA tracking, and resolution workflows.', true, '{
  "workflows": [{
    "name": "Incident Management",
    "description": "Track and resolve IT incidents",
    "stages": [
      {"_ref": "reported", "name": "Reported", "position": 0, "is_initial": true},
      {"_ref": "investigating", "name": "Investigating", "position": 1},
      {"_ref": "implementing", "name": "Implementing Fix", "position": 2},
      {"_ref": "testing", "name": "Testing", "position": 3},
      {"_ref": "resolved", "name": "Resolved", "position": 4},
      {"_ref": "closed", "name": "Closed", "position": 5, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Investigate", "_from_ref": "reported", "_to_ref": "investigating"},
      {"name": "Implement Fix", "_from_ref": "investigating", "_to_ref": "implementing"},
      {"name": "Test Fix", "_from_ref": "implementing", "_to_ref": "testing"},
      {"name": "Resolve", "_from_ref": "testing", "_to_ref": "resolved"},
      {"name": "Reopen", "_from_ref": "resolved", "_to_ref": "investigating", "require_comment": true},
      {"name": "Close", "_from_ref": "resolved", "_to_ref": "closed"},
      {"name": "Escalate", "_from_ref": "investigating", "_to_ref": "implementing", "require_comment": true}
    ]
  },
  {
    "name": "Change Request",
    "description": "Manage IT change requests through approval and implementation",
    "stages": [
      {"_ref": "submitted", "name": "Submitted", "position": 0, "is_initial": true},
      {"_ref": "review", "name": "Under Review", "position": 1},
      {"_ref": "approved", "name": "Approved", "position": 2},
      {"_ref": "scheduled", "name": "Scheduled", "position": 3},
      {"_ref": "implemented", "name": "Implemented", "position": 4},
      {"_ref": "verified", "name": "Verified", "position": 5, "is_terminal": true},
      {"_ref": "rejected", "name": "Rejected", "position": 6, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Review", "_from_ref": "submitted", "_to_ref": "review"},
      {"name": "Approve", "_from_ref": "review", "_to_ref": "approved", "require_comment": true},
      {"name": "Reject", "_from_ref": "review", "_to_ref": "rejected", "require_comment": true},
      {"name": "Schedule", "_from_ref": "approved", "_to_ref": "scheduled"},
      {"name": "Implement", "_from_ref": "scheduled", "_to_ref": "implemented"},
      {"name": "Verify", "_from_ref": "implemented", "_to_ref": "verified", "require_comment": true}
    ]
  }],
  "custom_fields": [
    {"entity_type": "workflow_item", "name": "Impact", "field_key": "impact", "field_type": "select", "options": ["Critical", "High", "Medium", "Low"]},
    {"entity_type": "workflow_item", "name": "Urgency", "field_key": "urgency", "field_type": "select", "options": ["Immediate", "High", "Medium", "Low"]},
    {"entity_type": "workflow_item", "name": "Affected System", "field_key": "affected_system", "field_type": "select", "options": ["Email", "Network", "Database", "Application", "Hardware", "Security", "Cloud Infrastructure"]},
    {"entity_type": "workflow_item", "name": "Resolution Category", "field_key": "resolution_category", "field_type": "select", "options": ["Configuration", "Code Fix", "Hardware Replacement", "Workaround", "Vendor Patch", "User Training"]},
    {"entity_type": "workflow_item", "name": "Change Type", "field_key": "change_type", "field_type": "select", "options": ["Standard", "Normal", "Emergency"]},
    {"entity_type": "workflow_item", "name": "Downtime Required", "field_key": "downtime_required", "field_type": "checkbox"},
    {"entity_type": "workflow_item", "name": "Rollback Plan", "field_key": "rollback_plan", "field_type": "text"}
  ],
  "link_types": [
    {"name": "Related Incident", "slug": "related_incident", "source_entity_type": "workflow_item", "target_entity_type": "workflow_item", "color": "#ef4444"},
    {"name": "Change Request", "slug": "change_request", "source_entity_type": "workflow_item", "target_entity_type": "workflow_item", "color": "#3b82f6"},
    {"name": "Affected User", "slug": "affected_user", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#f59e0b"},
    {"name": "Assigned Engineer", "slug": "assigned_engineer", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#8b5cf6"}
  ],
  "automations": [
    {"name": "Auto-escalate Critical", "description": "Send webhook when a critical incident is reported", "trigger_event": "workflow_item.created", "conditions": [], "action_type": "webhook", "action_config": {"url": "{{ESCALATION_WEBHOOK_URL}}", "method": "POST"}}
  ]
}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO config_packs (name, description, is_system, pack_data) VALUES
('Education & Course Pack', 'Course management with enrollment tracking, public course catalog, student progress, and grading workflows.', true, '{
  "workflows": [{
    "name": "Course Lifecycle",
    "description": "Manage courses from creation to completion",
    "public_config": {"enabled": true, "listing_title": "Course Catalog", "visible_fields": ["title", "description"]},
    "stages": [
      {"_ref": "draft", "name": "Draft", "position": 0, "is_initial": true},
      {"_ref": "open_enrollment", "name": "Open Enrollment", "position": 1, "is_public": true},
      {"_ref": "in_session", "name": "In Session", "position": 2, "is_public": true},
      {"_ref": "grading", "name": "Grading", "position": 3},
      {"_ref": "completed", "name": "Completed", "position": 4, "is_terminal": true},
      {"_ref": "cancelled", "name": "Cancelled", "position": 5, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Open Enrollment", "_from_ref": "draft", "_to_ref": "open_enrollment"},
      {"name": "Start Session", "_from_ref": "open_enrollment", "_to_ref": "in_session"},
      {"name": "Begin Grading", "_from_ref": "in_session", "_to_ref": "grading"},
      {"name": "Complete", "_from_ref": "grading", "_to_ref": "completed"},
      {"name": "Cancel", "_from_ref": "draft", "_to_ref": "cancelled"},
      {"name": "Cancel", "_from_ref": "open_enrollment", "_to_ref": "cancelled", "require_comment": true}
    ]
  }],
  "custom_fields": [
    {"entity_type": "workflow_item", "name": "Subject", "field_key": "subject", "field_type": "select", "options": ["Mathematics", "Science", "English", "History", "Art", "Music", "Technology", "Business"], "is_public": true},
    {"entity_type": "workflow_item", "name": "Level", "field_key": "level", "field_type": "select", "options": ["Beginner", "Intermediate", "Advanced"], "is_public": true},
    {"entity_type": "workflow_item", "name": "Max Enrollment", "field_key": "max_enrollment", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Start Date", "field_key": "course_start_date", "field_type": "date", "is_public": true},
    {"entity_type": "workflow_item", "name": "End Date", "field_key": "course_end_date", "field_type": "date", "is_public": true},
    {"entity_type": "workflow_item", "name": "Credits", "field_key": "credits", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Room / Location", "field_key": "room_location", "field_type": "text", "is_public": true},
    {"entity_type": "person", "name": "Student ID", "field_key": "student_id", "field_type": "text"},
    {"entity_type": "person", "name": "Grade Level", "field_key": "grade_level", "field_type": "select", "options": ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"]}
  ],
  "link_types": [
    {"name": "Student", "slug": "student", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#22c55e"},
    {"name": "Instructor", "slug": "instructor", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#3b82f6"},
    {"name": "Teaching Assistant", "slug": "ta", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#8b5cf6"},
    {"name": "Prerequisite", "slug": "prerequisite", "source_entity_type": "workflow_item", "target_entity_type": "workflow_item", "color": "#f59e0b"}
  ],
  "automations": []
}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO config_packs (name, description, is_system, pack_data) VALUES
('Membership & Club Pack', 'Member management with dues tracking, event coordination, public member directory, and renewal workflows.', true, '{
  "workflows": [{
    "name": "Membership Lifecycle",
    "description": "Track members from application to renewal",
    "stages": [
      {"_ref": "applied", "name": "Applied", "position": 0, "is_initial": true},
      {"_ref": "approved", "name": "Approved", "position": 1},
      {"_ref": "active", "name": "Active Member", "position": 2},
      {"_ref": "renewal_due", "name": "Renewal Due", "position": 3},
      {"_ref": "lapsed", "name": "Lapsed", "position": 4, "is_terminal": true},
      {"_ref": "rejected", "name": "Rejected", "position": 5, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Approve", "_from_ref": "applied", "_to_ref": "approved", "require_comment": true},
      {"name": "Reject", "_from_ref": "applied", "_to_ref": "rejected", "require_comment": true},
      {"name": "Activate", "_from_ref": "approved", "_to_ref": "active"},
      {"name": "Renewal Due", "_from_ref": "active", "_to_ref": "renewal_due"},
      {"name": "Renew", "_from_ref": "renewal_due", "_to_ref": "active"},
      {"name": "Lapse", "_from_ref": "renewal_due", "_to_ref": "lapsed"}
    ]
  },
  {
    "name": "Club Events",
    "description": "Plan and manage club events and meetups",
    "public_config": {"enabled": true, "listing_title": "Upcoming Events", "visible_fields": ["title", "description"]},
    "stages": [
      {"_ref": "idea", "name": "Idea", "position": 0, "is_initial": true},
      {"_ref": "planned", "name": "Planned", "position": 1, "is_public": true},
      {"_ref": "open_rsvp", "name": "Open for RSVP", "position": 2, "is_public": true},
      {"_ref": "past", "name": "Past Event", "position": 3, "is_terminal": true},
      {"_ref": "cancelled", "name": "Cancelled", "position": 4, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Plan", "_from_ref": "idea", "_to_ref": "planned"},
      {"name": "Open RSVP", "_from_ref": "planned", "_to_ref": "open_rsvp"},
      {"name": "Close Event", "_from_ref": "open_rsvp", "_to_ref": "past"},
      {"name": "Cancel", "_from_ref": "planned", "_to_ref": "cancelled", "require_comment": true},
      {"name": "Cancel", "_from_ref": "open_rsvp", "_to_ref": "cancelled", "require_comment": true}
    ]
  }],
  "custom_fields": [
    {"entity_type": "person", "name": "Membership Tier", "field_key": "membership_tier", "field_type": "select", "options": ["Basic", "Premium", "VIP", "Lifetime"]},
    {"entity_type": "person", "name": "Join Date", "field_key": "join_date", "field_type": "date"},
    {"entity_type": "person", "name": "Renewal Date", "field_key": "renewal_date", "field_type": "date"},
    {"entity_type": "person", "name": "Dues Paid", "field_key": "dues_paid", "field_type": "checkbox"},
    {"entity_type": "workflow_item", "name": "Event Date", "field_key": "event_date", "field_type": "date", "is_public": true},
    {"entity_type": "workflow_item", "name": "Location", "field_key": "event_location", "field_type": "text", "is_public": true},
    {"entity_type": "workflow_item", "name": "Max Capacity", "field_key": "max_capacity", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Cost", "field_key": "event_cost", "field_type": "text", "is_public": true}
  ],
  "link_types": [
    {"name": "Member", "slug": "member", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#22c55e"},
    {"name": "Event Organizer", "slug": "event_organizer", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#a855f7"},
    {"name": "RSVP", "slug": "rsvp", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#3b82f6"},
    {"name": "Sponsor", "slug": "sponsor", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#f59e0b"}
  ],
  "automations": []
}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO config_packs (name, description, is_system, pack_data) VALUES
('Freelancer & Client Pack', 'Client project management with proposals, invoicing stages, time tracking, and client portal support.', true, '{
  "workflows": [{
    "name": "Client Project",
    "description": "Manage client engagements from proposal to payment",
    "stages": [
      {"_ref": "proposal", "name": "Proposal", "position": 0, "is_initial": true},
      {"_ref": "negotiation", "name": "Negotiation", "position": 1},
      {"_ref": "active", "name": "Active", "position": 2},
      {"_ref": "delivered", "name": "Delivered", "position": 3},
      {"_ref": "invoiced", "name": "Invoiced", "position": 4},
      {"_ref": "paid", "name": "Paid", "position": 5, "is_terminal": true},
      {"_ref": "lost", "name": "Lost", "position": 6, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Negotiate", "_from_ref": "proposal", "_to_ref": "negotiation"},
      {"name": "Win Project", "_from_ref": "negotiation", "_to_ref": "active"},
      {"name": "Deliver", "_from_ref": "active", "_to_ref": "delivered"},
      {"name": "Send Invoice", "_from_ref": "delivered", "_to_ref": "invoiced"},
      {"name": "Mark Paid", "_from_ref": "invoiced", "_to_ref": "paid"},
      {"name": "Lost", "_from_ref": "proposal", "_to_ref": "lost", "require_comment": true},
      {"name": "Lost", "_from_ref": "negotiation", "_to_ref": "lost", "require_comment": true}
    ]
  }],
  "custom_fields": [
    {"entity_type": "workflow_item", "name": "Project Value", "field_key": "project_value", "field_type": "number"},
    {"entity_type": "workflow_item", "name": "Hourly Rate", "field_key": "hourly_rate", "field_type": "number"},
    {"entity_type": "workflow_item", "name": "Hours Logged", "field_key": "hours_logged", "field_type": "number"},
    {"entity_type": "workflow_item", "name": "Deadline", "field_key": "deadline", "field_type": "date"},
    {"entity_type": "workflow_item", "name": "Project Type", "field_key": "project_type", "field_type": "select", "options": ["Web Development", "Mobile App", "Design", "Consulting", "Content", "Marketing", "Other"]},
    {"entity_type": "person", "name": "Company", "field_key": "client_company", "field_type": "text"},
    {"entity_type": "person", "name": "Budget Range", "field_key": "budget_range", "field_type": "select", "options": ["< $1K", "$1K-$5K", "$5K-$20K", "$20K-$50K", "$50K+"]}
  ],
  "link_types": [
    {"name": "Client Contact", "slug": "client_contact", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#3b82f6"},
    {"name": "Subcontractor", "slug": "subcontractor", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#f97316"},
    {"name": "Related Project", "slug": "related_project", "source_entity_type": "workflow_item", "target_entity_type": "workflow_item", "color": "#6366f1"}
  ],
  "automations": []
}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO config_packs (name, description, is_system, pack_data) VALUES
('Healthcare & Patient Pack', 'Patient intake and care coordination with referral tracking, appointment workflows, and HIPAA-conscious field design.', true, '{
  "workflows": [{
    "name": "Patient Intake",
    "description": "Track patients from referral to active care",
    "stages": [
      {"_ref": "referred", "name": "Referred", "position": 0, "is_initial": true},
      {"_ref": "scheduled", "name": "Scheduled", "position": 1},
      {"_ref": "intake_complete", "name": "Intake Complete", "position": 2},
      {"_ref": "active_care", "name": "Active Care", "position": 3},
      {"_ref": "discharged", "name": "Discharged", "position": 4, "is_terminal": true},
      {"_ref": "no_show", "name": "No Show", "position": 5, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Schedule", "_from_ref": "referred", "_to_ref": "scheduled"},
      {"name": "Complete Intake", "_from_ref": "scheduled", "_to_ref": "intake_complete"},
      {"name": "Begin Care", "_from_ref": "intake_complete", "_to_ref": "active_care"},
      {"name": "Discharge", "_from_ref": "active_care", "_to_ref": "discharged", "require_comment": true},
      {"name": "No Show", "_from_ref": "scheduled", "_to_ref": "no_show"}
    ]
  }],
  "custom_fields": [
    {"entity_type": "person", "name": "Date of Birth", "field_key": "dob", "field_type": "date"},
    {"entity_type": "person", "name": "Insurance Provider", "field_key": "insurance_provider", "field_type": "text"},
    {"entity_type": "person", "name": "Policy Number", "field_key": "policy_number", "field_type": "text"},
    {"entity_type": "person", "name": "Emergency Contact", "field_key": "emergency_contact", "field_type": "text"},
    {"entity_type": "person", "name": "Allergies", "field_key": "allergies", "field_type": "text"},
    {"entity_type": "workflow_item", "name": "Referral Source", "field_key": "referral_source", "field_type": "select", "options": ["Self", "Physician", "Insurance", "Hospital", "Other"]},
    {"entity_type": "workflow_item", "name": "Appointment Date", "field_key": "appointment_date", "field_type": "date"},
    {"entity_type": "workflow_item", "name": "Visit Type", "field_key": "visit_type", "field_type": "select", "options": ["Initial Consultation", "Follow-up", "Procedure", "Lab Work", "Imaging"]}
  ],
  "link_types": [
    {"name": "Patient", "slug": "patient", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#22c55e"},
    {"name": "Referring Provider", "slug": "referring_provider", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#3b82f6"},
    {"name": "Care Team Member", "slug": "care_team", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#8b5cf6"},
    {"name": "Related Case", "slug": "related_case", "source_entity_type": "workflow_item", "target_entity_type": "workflow_item", "color": "#f59e0b"}
  ],
  "automations": []
}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- INSTALLATION COMPLETE
-- ════════════════════════════════════════════════════════════════════════════
-- This script is safe to re-run. Existing data is never modified or deleted.
-- Each instance is isolated in its own schema.
--
-- Next steps:
--   1. Add the schema name to Supabase Dashboard → Settings → API → Exposed schemas
--   2. Set DB_SCHEMA / VITE_DB_SCHEMA env vars in your app
--   3. See SETUP.md for full configuration guide
-- ════════════════════════════════════════════════════════════════════════════
