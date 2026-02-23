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

CREATE TABLE webhook_subscriptions (
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

CREATE INDEX idx_webhook_subscriptions_account_id ON webhook_subscriptions(account_id);
CREATE INDEX idx_webhook_subscriptions_enabled ON webhook_subscriptions(enabled);

CREATE TRIGGER trg_webhook_subscriptions_updated_at
  BEFORE UPDATE ON webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE webhook_deliveries (
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

CREATE INDEX idx_webhook_deliveries_subscription ON webhook_deliveries(webhook_subscription_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_next_attempt ON webhook_deliveries(status, next_attempt_at)
  WHERE status IN ('pending', 'failed');

CREATE TRIGGER trg_webhook_deliveries_updated_at
  BEFORE UPDATE ON webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
