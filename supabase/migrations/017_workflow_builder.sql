-- Named transitions between stages (edges in the workflow graph)
CREATE TABLE transition_definitions (
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

CREATE INDEX idx_transition_definitions_workflow ON transition_definitions(workflow_definition_id);
CREATE INDEX idx_transition_definitions_from ON transition_definitions(from_stage_id);
CREATE INDEX idx_transition_definitions_to ON transition_definitions(to_stage_id);

CREATE TRIGGER trg_transition_definitions_updated_at
  BEFORE UPDATE ON transition_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Actions attached to stages or transitions in a workflow
CREATE TABLE workflow_actions (
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

CREATE INDEX idx_workflow_actions_workflow ON workflow_actions(workflow_definition_id);
CREATE INDEX idx_workflow_actions_trigger ON workflow_actions(trigger_type, trigger_ref_id);
CREATE INDEX idx_workflow_actions_enabled ON workflow_actions(enabled);

CREATE TRIGGER trg_workflow_actions_updated_at
  BEFORE UPDATE ON workflow_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
