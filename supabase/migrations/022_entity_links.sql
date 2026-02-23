-- Entity Links: universal relationship layer connecting any entity to any other
CREATE TABLE entity_links (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source_type   text NOT NULL CHECK (source_type IN ('person', 'account', 'workflow_item', 'ticket', 'kb_article')),
  source_id     uuid NOT NULL,
  target_type   text NOT NULL CHECK (target_type IN ('person', 'account', 'workflow_item', 'ticket', 'kb_article')),
  target_id     uuid NOT NULL,
  link_type     text NOT NULL DEFAULT 'related',
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_by    uuid REFERENCES persons(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, source_type, source_id, target_type, target_id, link_type)
);

CREATE INDEX idx_entity_links_account ON entity_links(account_id);
CREATE INDEX idx_entity_links_source ON entity_links(source_type, source_id);
CREATE INDEX idx_entity_links_target ON entity_links(target_type, target_id);
CREATE INDEX idx_entity_links_link_type ON entity_links(account_id, link_type);

-- Link Type Definitions: admin-defined named relationship types
CREATE TABLE link_type_definitions (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id          uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name                text NOT NULL,
  slug                text NOT NULL,
  source_entity_type  text CHECK (source_entity_type IN ('person', 'account', 'workflow_item', 'ticket', 'kb_article')),
  target_entity_type  text CHECK (target_entity_type IN ('person', 'account', 'workflow_item', 'ticket', 'kb_article')),
  metadata_schema     jsonb NOT NULL DEFAULT '{}',
  color               text,
  icon                text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, slug)
);

CREATE INDEX idx_link_type_defs_account ON link_type_definitions(account_id);

CREATE TRIGGER trg_link_type_definitions_updated_at
  BEFORE UPDATE ON link_type_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
