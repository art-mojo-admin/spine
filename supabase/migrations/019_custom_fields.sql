-- Custom field definitions: admin-defined fields per entity type
CREATE TABLE custom_field_definitions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity_type     text NOT NULL CHECK (entity_type IN (
    'account', 'person', 'workflow_item', 'ticket', 'kb_article'
  )),
  name            text NOT NULL,
  field_key       text NOT NULL,
  field_type      text NOT NULL CHECK (field_type IN (
    'text', 'number', 'date', 'boolean', 'select', 'multi_select', 'url', 'email', 'textarea'
  )),
  options         jsonb NOT NULL DEFAULT '[]',
  required        boolean NOT NULL DEFAULT false,
  default_value   text,
  section         text,
  position        integer NOT NULL DEFAULT 0,
  enabled         boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, entity_type, field_key)
);

CREATE INDEX idx_custom_field_defs_account ON custom_field_definitions(account_id);
CREATE INDEX idx_custom_field_defs_entity ON custom_field_definitions(account_id, entity_type);

CREATE TRIGGER trg_custom_field_definitions_updated_at
  BEFORE UPDATE ON custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add metadata column to accounts and persons (other entities already have it)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';
ALTER TABLE persons ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';
