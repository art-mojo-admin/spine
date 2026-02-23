CREATE TABLE workflow_definitions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  config        jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_definitions_account_id ON workflow_definitions(account_id);

CREATE TRIGGER trg_workflow_definitions_updated_at
  BEFORE UPDATE ON workflow_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE stage_definitions (
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

CREATE INDEX idx_stage_definitions_workflow ON stage_definitions(workflow_definition_id);
CREATE INDEX idx_stage_definitions_position ON stage_definitions(workflow_definition_id, position);

CREATE TRIGGER trg_stage_definitions_updated_at
  BEFORE UPDATE ON stage_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
