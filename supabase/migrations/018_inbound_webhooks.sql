-- API keys for inbound webhook authentication (e.g. Make.com calling us)
CREATE TABLE inbound_webhook_keys (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name            text NOT NULL,
  api_key         text NOT NULL UNIQUE,
  enabled         boolean NOT NULL DEFAULT true,
  last_used_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbound_webhook_keys_account ON inbound_webhook_keys(account_id);
CREATE INDEX idx_inbound_webhook_keys_api_key ON inbound_webhook_keys(api_key);

CREATE TRIGGER trg_inbound_webhook_keys_updated_at
  BEFORE UPDATE ON inbound_webhook_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Maps inbound event names to workflow actions (what to do when Make.com sends us an event)
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
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbound_webhook_mappings_account ON inbound_webhook_mappings(account_id);
CREATE INDEX idx_inbound_webhook_mappings_event ON inbound_webhook_mappings(event_name);

CREATE TRIGGER trg_inbound_webhook_mappings_updated_at
  BEFORE UPDATE ON inbound_webhook_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
