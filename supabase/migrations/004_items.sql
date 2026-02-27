-- 004: Items — universal work record (minimal base schema)
-- Vertical-specific fields go in custom_field_definitions + metadata JSONB.
-- Person roles (requester/assignee/watcher) go in entity_links.

CREATE TABLE items (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id              uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_type               text NOT NULL DEFAULT 'task' REFERENCES item_type_registry(slug),
  workflow_definition_id  uuid NOT NULL REFERENCES workflow_definitions(id),
  stage_definition_id     uuid NOT NULL REFERENCES stage_definitions(id),
  title                   text NOT NULL,
  description             text,
  due_date                date,
  priority                text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  parent_item_id          uuid REFERENCES items(id) ON DELETE SET NULL,
  metadata                jsonb NOT NULL DEFAULT '{}',
  is_active               boolean NOT NULL DEFAULT true,
  is_test_data            boolean NOT NULL DEFAULT false,
  pack_id                 uuid,  -- FK added in 011_packs.sql
  ownership               text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_account_id ON items(account_id);
CREATE INDEX idx_items_item_type ON items(account_id, item_type);
CREATE INDEX idx_items_workflow ON items(workflow_definition_id);
CREATE INDEX idx_items_stage ON items(stage_definition_id);
CREATE INDEX idx_items_parent ON items(parent_item_id);
CREATE INDEX idx_items_priority ON items(account_id, priority);
CREATE INDEX idx_items_due_date ON items(account_id, due_date) WHERE due_date IS NOT NULL;

CREATE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
