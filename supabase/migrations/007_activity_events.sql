CREATE TABLE activity_events (
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

CREATE INDEX idx_activity_events_account_id ON activity_events(account_id);
CREATE INDEX idx_activity_events_entity ON activity_events(entity_type, entity_id);
CREATE INDEX idx_activity_events_created_at ON activity_events(created_at DESC);
CREATE INDEX idx_activity_events_event_type ON activity_events(event_type);
