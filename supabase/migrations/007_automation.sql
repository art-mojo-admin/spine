-- 007: Automation — rules, scheduled triggers, outbox events, webhooks, inbound webhooks

-- ── automation_rules ───────────────────────────────────────────────────
CREATE TABLE automation_rules (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id              uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  workflow_definition_id  uuid REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  description             text,
  trigger_event           text NOT NULL,
  conditions              jsonb NOT NULL DEFAULT '[]',
  action_type             text NOT NULL REFERENCES action_type_registry(slug),
  action_config           jsonb NOT NULL DEFAULT '{}',
  enabled                 boolean NOT NULL DEFAULT true,
  is_active               boolean NOT NULL DEFAULT true,
  is_test_data            boolean NOT NULL DEFAULT false,
  pack_id                 uuid,
  ownership               text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_rules_account_id ON automation_rules(account_id);
CREATE INDEX idx_automation_rules_trigger ON automation_rules(trigger_event);
CREATE INDEX idx_automation_rules_enabled ON automation_rules(enabled);

CREATE TRIGGER trg_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── scheduled_triggers ─────────────────────────────────────────────────
CREATE TABLE scheduled_triggers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name            text NOT NULL,
  trigger_type    text NOT NULL CHECK (trigger_type IN ('one_time', 'recurring', 'countdown')),
  fire_at         timestamptz,
  cron_expression text,
  next_fire_at    timestamptz,
  delay_seconds   integer,
  delay_event     text,
  action_type     text NOT NULL REFERENCES action_type_registry(slug),
  action_config   jsonb NOT NULL DEFAULT '{}',
  conditions      jsonb NOT NULL DEFAULT '[]',
  enabled         boolean NOT NULL DEFAULT true,
  last_fired_at   timestamptz,
  fire_count      integer NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES persons(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sched_triggers_account ON scheduled_triggers(account_id);
CREATE INDEX idx_sched_triggers_one_time ON scheduled_triggers(fire_at)
  WHERE trigger_type = 'one_time' AND enabled = true AND fire_count = 0;
CREATE INDEX idx_sched_triggers_recurring ON scheduled_triggers(next_fire_at)
  WHERE trigger_type = 'recurring' AND enabled = true;
CREATE INDEX idx_sched_triggers_countdown ON scheduled_triggers(delay_event)
  WHERE trigger_type = 'countdown' AND enabled = true;

CREATE TRIGGER trg_scheduled_triggers_updated_at
  BEFORE UPDATE ON scheduled_triggers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── scheduled_trigger_instances ────────────────────────────────────────
CREATE TABLE scheduled_trigger_instances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id      uuid REFERENCES scheduled_triggers(id) ON DELETE CASCADE,
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  fire_at         timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'fired', 'cancelled', 'failed')),
  context         jsonb NOT NULL DEFAULT '{}',
  action_type     text,
  action_config   jsonb,
  result          jsonb,
  fired_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sched_instances_pending ON scheduled_trigger_instances(fire_at)
  WHERE status = 'pending';
CREATE INDEX idx_sched_instances_trigger ON scheduled_trigger_instances(trigger_id);
CREATE INDEX idx_sched_instances_account ON scheduled_trigger_instances(account_id);

-- ── outbox_events (signals) ────────────────────────────────────────────
CREATE TABLE outbox_events (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL REFERENCES accounts(id),
  event_type    text NOT NULL,
  entity_type   text,
  entity_id     uuid,
  payload       jsonb NOT NULL DEFAULT '{}',
  processed     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_outbox_events_account_id ON outbox_events(account_id);
CREATE INDEX idx_outbox_events_processed ON outbox_events(processed, created_at);
CREATE INDEX idx_outbox_events_event_type ON outbox_events(event_type);

-- ── webhook_subscriptions (outbound) ───────────────────────────────────
CREATE TABLE webhook_subscriptions (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id              uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  url                     text NOT NULL,
  enabled                 boolean NOT NULL DEFAULT true,
  event_types             text[] NOT NULL DEFAULT '{}',
  signing_secret          text NOT NULL,
  description             text,
  metadata                jsonb NOT NULL DEFAULT '{}',
  integration_instance_id uuid,  -- FK added in 010_integrations.sql
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_subscriptions_account_id ON webhook_subscriptions(account_id);
CREATE INDEX idx_webhook_subscriptions_enabled ON webhook_subscriptions(enabled);

CREATE TRIGGER trg_webhook_subscriptions_updated_at
  BEFORE UPDATE ON webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── webhook_deliveries ─────────────────────────────────────────────────
CREATE TABLE webhook_deliveries (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_subscription_id uuid NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  outbox_event_id         uuid NOT NULL REFERENCES outbox_events(id),
  status                  text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'success', 'failed', 'dead_letter')),
  attempts                integer NOT NULL DEFAULT 0,
  last_error              text,
  last_status_code        integer,
  next_attempt_at         timestamptz,
  completed_at            timestamptz,
  integration_instance_id uuid,  -- FK added in 010_integrations.sql
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_subscription ON webhook_deliveries(webhook_subscription_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_next_attempt ON webhook_deliveries(status, next_attempt_at)
  WHERE status IN ('pending', 'failed');

CREATE TRIGGER trg_webhook_deliveries_updated_at
  BEFORE UPDATE ON webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── inbound_webhook_keys ───────────────────────────────────────────────
CREATE TABLE inbound_webhook_keys (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id              uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  api_key                 text NOT NULL UNIQUE,
  enabled                 boolean NOT NULL DEFAULT true,
  last_used_at            timestamptz,
  integration_instance_id uuid,  -- FK added in 010_integrations.sql
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbound_webhook_keys_account ON inbound_webhook_keys(account_id);
CREATE INDEX idx_inbound_webhook_keys_api_key ON inbound_webhook_keys(api_key);

CREATE TRIGGER trg_inbound_webhook_keys_updated_at
  BEFORE UPDATE ON inbound_webhook_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── inbound_webhook_mappings ───────────────────────────────────────────
CREATE TABLE inbound_webhook_mappings (
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
  integration_instance_id uuid,  -- FK added in 010_integrations.sql
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbound_webhook_mappings_account ON inbound_webhook_mappings(account_id);
CREATE INDEX idx_inbound_webhook_mappings_event ON inbound_webhook_mappings(event_name);

CREATE TRIGGER trg_inbound_webhook_mappings_updated_at
  BEFORE UPDATE ON inbound_webhook_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
