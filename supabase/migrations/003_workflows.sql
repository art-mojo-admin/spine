-- 003: Workflow engine — definitions, stages, transitions, actions

-- ── workflow_definitions ───────────────────────────────────────────────
CREATE TABLE workflow_definitions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  config        jsonb NOT NULL DEFAULT '{}',
  public_config jsonb NOT NULL DEFAULT '{}',
  is_active     boolean NOT NULL DEFAULT true,
  is_test_data  boolean NOT NULL DEFAULT false,
  pack_id       uuid,  -- FK added in 011_packs.sql
  ownership     text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_definitions_account_id ON workflow_definitions(account_id);

CREATE TRIGGER trg_workflow_definitions_updated_at
  BEFORE UPDATE ON workflow_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── stage_definitions ──────────────────────────────────────────────────
CREATE TABLE stage_definitions (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_definition_id  uuid NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  description             text,
  position                integer NOT NULL DEFAULT 0,
  allowed_transitions     uuid[] DEFAULT '{}',
  is_initial              boolean NOT NULL DEFAULT false,
  is_terminal             boolean NOT NULL DEFAULT false,
  is_public               boolean NOT NULL DEFAULT false,
  config                  jsonb NOT NULL DEFAULT '{}',
  is_active               boolean NOT NULL DEFAULT true,
  is_test_data            boolean NOT NULL DEFAULT false,
  pack_id                 uuid,
  ownership               text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stage_definitions_workflow ON stage_definitions(workflow_definition_id);
CREATE INDEX idx_stage_definitions_position ON stage_definitions(workflow_definition_id, position);

CREATE TRIGGER trg_stage_definitions_updated_at
  BEFORE UPDATE ON stage_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── transition_definitions ─────────────────────────────────────────────
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
  is_active               boolean NOT NULL DEFAULT true,
  is_test_data            boolean NOT NULL DEFAULT false,
  pack_id                 uuid,
  ownership               text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_transition_definitions_workflow ON transition_definitions(workflow_definition_id);
CREATE INDEX idx_transition_definitions_from ON transition_definitions(from_stage_id);
CREATE INDEX idx_transition_definitions_to ON transition_definitions(to_stage_id);

CREATE TRIGGER trg_transition_definitions_updated_at
  BEFORE UPDATE ON transition_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── workflow_actions ───────────────────────────────────────────────────
CREATE TABLE workflow_actions (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_definition_id  uuid NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  trigger_type            text NOT NULL CHECK (trigger_type IN (
    'on_enter_stage', 'on_exit_stage', 'on_transition', 'on_create'
  )),
  trigger_ref_id          uuid,
  action_type             text NOT NULL REFERENCES action_type_registry(slug),
  action_config           jsonb NOT NULL DEFAULT '{}',
  conditions              jsonb NOT NULL DEFAULT '[]',
  position                integer NOT NULL DEFAULT 0,
  enabled                 boolean NOT NULL DEFAULT true,
  is_active               boolean NOT NULL DEFAULT true,
  is_test_data            boolean NOT NULL DEFAULT false,
  pack_id                 uuid,
  ownership               text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_actions_workflow ON workflow_actions(workflow_definition_id);
CREATE INDEX idx_workflow_actions_trigger ON workflow_actions(trigger_type, trigger_ref_id);
CREATE INDEX idx_workflow_actions_enabled ON workflow_actions(enabled);

CREATE TRIGGER trg_workflow_actions_updated_at
  BEFORE UPDATE ON workflow_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
