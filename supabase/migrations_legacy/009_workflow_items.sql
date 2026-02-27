CREATE TABLE workflow_items (
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

CREATE INDEX idx_workflow_items_account_id ON workflow_items(account_id);
CREATE INDEX idx_workflow_items_workflow ON workflow_items(workflow_definition_id);
CREATE INDEX idx_workflow_items_stage ON workflow_items(stage_definition_id);
CREATE INDEX idx_workflow_items_owner ON workflow_items(owner_person_id);
CREATE INDEX idx_workflow_items_entity ON workflow_items(entity_type, entity_id);

CREATE TRIGGER trg_workflow_items_updated_at
  BEFORE UPDATE ON workflow_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE automation_rules (
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

CREATE INDEX idx_automation_rules_account_id ON automation_rules(account_id);
CREATE INDEX idx_automation_rules_trigger ON automation_rules(trigger_event);
CREATE INDEX idx_automation_rules_enabled ON automation_rules(enabled);

CREATE TRIGGER trg_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
