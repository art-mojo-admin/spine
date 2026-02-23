CREATE TABLE tickets (
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

CREATE INDEX idx_tickets_account_id ON tickets(account_id);
CREATE INDEX idx_tickets_status ON tickets(account_id, status);
CREATE INDEX idx_tickets_priority ON tickets(account_id, priority);
CREATE INDEX idx_tickets_opened_by ON tickets(opened_by_person_id);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to_person_id);
CREATE INDEX idx_tickets_entity ON tickets(entity_type, entity_id);

CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE ticket_messages (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id     uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  person_id     uuid NOT NULL REFERENCES persons(id),
  body          text NOT NULL,
  is_internal   boolean NOT NULL DEFAULT false,
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_created_at ON ticket_messages(ticket_id, created_at);
