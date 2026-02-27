-- 006: Relationships — entity_links, link_type_definitions, custom_field_definitions
-- entity_links uses registry FKs instead of CHECK constraints.
-- Person↔Item roles (requester/assignee/watcher) are modeled here, not as item columns.

-- ── link_type_definitions ──────────────────────────────────────────────
CREATE TABLE link_type_definitions (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id          uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name                text NOT NULL,
  slug                text NOT NULL,
  source_entity_type  text REFERENCES entity_type_registry(slug),
  target_entity_type  text REFERENCES entity_type_registry(slug),
  metadata_schema     jsonb NOT NULL DEFAULT '{}',
  color               text,
  icon                text,
  is_active           boolean NOT NULL DEFAULT true,
  is_test_data        boolean NOT NULL DEFAULT false,
  pack_id             uuid,
  ownership           text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, slug)
);

CREATE INDEX idx_link_type_defs_account ON link_type_definitions(account_id);

CREATE TRIGGER trg_link_type_definitions_updated_at
  BEFORE UPDATE ON link_type_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── entity_links ───────────────────────────────────────────────────────
CREATE TABLE entity_links (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source_type   text NOT NULL REFERENCES entity_type_registry(slug),
  source_id     uuid NOT NULL,
  target_type   text NOT NULL REFERENCES entity_type_registry(slug),
  target_id     uuid NOT NULL,
  link_type     text NOT NULL DEFAULT 'related',
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_by    uuid REFERENCES persons(id) ON DELETE SET NULL,
  is_active     boolean NOT NULL DEFAULT true,
  is_test_data  boolean NOT NULL DEFAULT false,
  pack_id       uuid,
  ownership     text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, source_type, source_id, target_type, target_id, link_type)
);

CREATE INDEX idx_entity_links_account ON entity_links(account_id);
CREATE INDEX idx_entity_links_source ON entity_links(source_type, source_id);
CREATE INDEX idx_entity_links_target ON entity_links(target_type, target_id);
CREATE INDEX idx_entity_links_link_type ON entity_links(account_id, link_type);

-- ── custom_field_definitions ───────────────────────────────────────────
CREATE TABLE custom_field_definitions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity_type     text NOT NULL REFERENCES entity_type_registry(slug),
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
  is_public       boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  is_test_data    boolean NOT NULL DEFAULT false,
  pack_id         uuid,
  ownership       text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, entity_type, field_key)
);

CREATE INDEX idx_custom_field_defs_account ON custom_field_definitions(account_id);
CREATE INDEX idx_custom_field_defs_entity ON custom_field_definitions(account_id, entity_type);

CREATE TRIGGER trg_custom_field_definitions_updated_at
  BEFORE UPDATE ON custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── entity_watchers ────────────────────────────────────────────────────
CREATE TABLE entity_watchers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity_type   text NOT NULL REFERENCES entity_type_registry(slug),
  entity_id     uuid NOT NULL,
  person_id     uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, entity_type, entity_id, person_id)
);

CREATE INDEX idx_entity_watchers_entity ON entity_watchers(account_id, entity_type, entity_id);
CREATE INDEX idx_entity_watchers_person ON entity_watchers(person_id);

-- ── entity_attachments ─────────────────────────────────────────────────
CREATE TABLE entity_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity_type   text NOT NULL REFERENCES entity_type_registry(slug),
  entity_id     uuid NOT NULL,
  filename      text NOT NULL,
  mime_type     text,
  size_bytes    integer,
  storage_path  text NOT NULL,
  uploaded_by   uuid REFERENCES persons(id) ON DELETE SET NULL,
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_attachments_entity ON entity_attachments(account_id, entity_type, entity_id);
CREATE INDEX idx_entity_attachments_uploaded_by ON entity_attachments(uploaded_by);
