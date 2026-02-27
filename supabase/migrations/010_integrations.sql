-- 010: Integrations — first-class installable I/O modules
-- integration_definitions = system catalog (e.g. Make.com, Zapier)
-- integration_instances = per-account installs with lifecycle

-- ── integration_definitions (catalog) ──────────────────────────────────
CREATE TABLE integration_definitions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  name            text NOT NULL,
  description     text,
  icon            text,
  category        text,
  version         text NOT NULL DEFAULT '1.0.0',
  manifest        jsonb NOT NULL DEFAULT '{}',
  is_system       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── integration_instances (per-account) ────────────────────────────────
CREATE TABLE integration_instances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  definition_id       uuid NOT NULL REFERENCES integration_definitions(id),
  status              text NOT NULL DEFAULT 'installed'
                      CHECK (status IN ('installed', 'enabled', 'disabled', 'error')),
  config              jsonb NOT NULL DEFAULT '{}',
  auth_config         jsonb NOT NULL DEFAULT '{}',
  health_status       text DEFAULT 'unknown',
  last_health_check   timestamptz,
  is_active           boolean NOT NULL DEFAULT true,
  is_test_data        boolean NOT NULL DEFAULT false,
  pack_id             uuid,
  ownership           text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, definition_id)
);

CREATE INDEX idx_integration_instances_account ON integration_instances(account_id);
CREATE INDEX idx_integration_instances_status ON integration_instances(account_id, status);

CREATE TRIGGER trg_integration_instances_updated_at
  BEFORE UPDATE ON integration_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Add integration_instance_id FKs to existing webhook/inbound tables ─
ALTER TABLE webhook_subscriptions
  ADD CONSTRAINT fk_webhook_subs_integration
  FOREIGN KEY (integration_instance_id) REFERENCES integration_instances(id) ON DELETE SET NULL;

ALTER TABLE webhook_deliveries
  ADD CONSTRAINT fk_webhook_del_integration
  FOREIGN KEY (integration_instance_id) REFERENCES integration_instances(id) ON DELETE SET NULL;

ALTER TABLE inbound_webhook_keys
  ADD CONSTRAINT fk_inbound_keys_integration
  FOREIGN KEY (integration_instance_id) REFERENCES integration_instances(id) ON DELETE SET NULL;

ALTER TABLE inbound_webhook_mappings
  ADD CONSTRAINT fk_inbound_mappings_integration
  FOREIGN KEY (integration_instance_id) REFERENCES integration_instances(id) ON DELETE SET NULL;

CREATE INDEX idx_webhook_subs_integration ON webhook_subscriptions(integration_instance_id)
  WHERE integration_instance_id IS NOT NULL;
CREATE INDEX idx_webhook_del_integration ON webhook_deliveries(integration_instance_id)
  WHERE integration_instance_id IS NOT NULL;
CREATE INDEX idx_inbound_keys_integration ON inbound_webhook_keys(integration_instance_id)
  WHERE integration_instance_id IS NOT NULL;
CREATE INDEX idx_inbound_mappings_integration ON inbound_webhook_mappings(integration_instance_id)
  WHERE integration_instance_id IS NOT NULL;
