-- 002: Registry tables — extensible type registries replacing rigid CHECK constraints
-- Packs can INSERT additional types during activation.

-- ── entity_type_registry ───────────────────────────────────────────────
CREATE TABLE entity_type_registry (
  slug        text PRIMARY KEY,
  label       text NOT NULL,
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── item_type_registry ─────────────────────────────────────────────────
CREATE TABLE item_type_registry (
  slug        text PRIMARY KEY,
  label       text NOT NULL,
  icon        text,
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── action_type_registry ───────────────────────────────────────────────
CREATE TABLE action_type_registry (
  slug        text PRIMARY KEY,
  label       text NOT NULL,
  is_system   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
