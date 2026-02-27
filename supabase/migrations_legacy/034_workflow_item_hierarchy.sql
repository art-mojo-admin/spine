-- 034: Workflow item hierarchy — parent/child for epics, sprints, sub-tasks
ALTER TABLE workflow_items
  ADD COLUMN IF NOT EXISTS parent_workflow_item_id uuid REFERENCES workflow_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_items_parent ON workflow_items(parent_workflow_item_id);
