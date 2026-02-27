-- 001: Foundations — extensions, utility functions, accounts, persons, profiles, memberships
-- Clean schema rebuild for Spine v2

-- ── Extensions ─────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── Utility: updated_at trigger function ───────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── accounts ───────────────────────────────────────────────────────────
CREATE TABLE accounts (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_type  text NOT NULL CHECK (account_type IN ('individual', 'organization')),
  display_name  text NOT NULL,
  slug          text UNIQUE,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  settings      jsonb NOT NULL DEFAULT '{}',
  metadata      jsonb NOT NULL DEFAULT '{}',
  is_active     boolean NOT NULL DEFAULT true,
  is_test_data  boolean NOT NULL DEFAULT false,
  pack_id       uuid,  -- FK added after config_packs table exists
  ownership     text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_type ON accounts(account_type);
CREATE INDEX idx_accounts_slug ON accounts(slug);

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── persons ────────────────────────────────────────────────────────────
CREATE TABLE persons (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_uid      uuid UNIQUE,
  email         text NOT NULL UNIQUE,
  full_name     text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  metadata      jsonb NOT NULL DEFAULT '{}',
  is_active     boolean NOT NULL DEFAULT true,
  is_test_data  boolean NOT NULL DEFAULT false,
  pack_id       uuid,  -- FK added after config_packs table exists
  ownership     text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_persons_email ON persons(email);
CREATE INDEX idx_persons_auth_uid ON persons(auth_uid);
CREATE INDEX idx_persons_status ON persons(status);

CREATE TRIGGER trg_persons_updated_at
  BEFORE UPDATE ON persons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── profiles ───────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id     uuid NOT NULL UNIQUE REFERENCES persons(id) ON DELETE CASCADE,
  display_name  text NOT NULL,
  avatar_url    text,
  system_role   text CHECK (system_role IN ('system_admin', 'system_operator', 'support_operator')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_person_id ON profiles(person_id);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── memberships ────────────────────────────────────────────────────────
CREATE TABLE memberships (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id     uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  account_role  text NOT NULL DEFAULT 'member' CHECK (account_role IN ('admin', 'operator', 'member', 'portal')),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),
  is_active     boolean NOT NULL DEFAULT true,
  is_test_data  boolean NOT NULL DEFAULT false,
  pack_id       uuid,  -- FK added after config_packs table exists
  ownership     text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(person_id, account_id)
);

CREATE INDEX idx_memberships_person_id ON memberships(person_id);
CREATE INDEX idx_memberships_account_id ON memberships(account_id);
CREATE INDEX idx_memberships_status ON memberships(status);

CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── invites ────────────────────────────────────────────────────────────
CREATE TABLE invites (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invited_by    uuid NOT NULL REFERENCES persons(id),
  email         text NOT NULL,
  account_role  text NOT NULL DEFAULT 'member' CHECK (account_role IN ('admin', 'operator', 'member')),
  token         text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_account_id ON invites(account_id);
CREATE INDEX idx_invites_token ON invites(token);
CREATE INDEX idx_invites_email ON invites(email);

-- ── tenant_themes ──────────────────────────────────────────────────────
CREATE TABLE tenant_themes (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  preset        text NOT NULL DEFAULT 'clean' CHECK (preset IN ('clean', 'bold', 'muted', 'custom')),
  logo_url      text,
  tokens        jsonb NOT NULL DEFAULT '{}',
  dark_tokens   jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_themes_account_id ON tenant_themes(account_id);

CREATE TRIGGER trg_tenant_themes_updated_at
  BEFORE UPDATE ON tenant_themes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── audit_log ──────────────────────────────────────────────────────────
CREATE TABLE audit_log (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid REFERENCES accounts(id),
  person_id     uuid REFERENCES persons(id),
  request_id    text NOT NULL,
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     uuid,
  before_data   jsonb,
  after_data    jsonb,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_account_id ON audit_log(account_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_request_id ON audit_log(request_id);

-- ── activity_events ────────────────────────────────────────────────────
CREATE TABLE activity_events (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid REFERENCES accounts(id),
  person_id     uuid REFERENCES persons(id),
  request_id    text,
  event_type    text NOT NULL,
  entity_type   text,
  entity_id     uuid,
  summary       text NOT NULL,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_events_account_id ON activity_events(account_id);
CREATE INDEX idx_activity_events_entity ON activity_events(entity_type, entity_id);
CREATE INDEX idx_activity_events_created_at ON activity_events(created_at DESC);
CREATE INDEX idx_activity_events_event_type ON activity_events(event_type);

-- ── impersonation_sessions ─────────────────────────────────────────────
CREATE TABLE impersonation_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_person_id     uuid NOT NULL REFERENCES persons(id),
  target_person_id    uuid NOT NULL REFERENCES persons(id),
  target_account_id   uuid NOT NULL REFERENCES accounts(id),
  target_account_role text NOT NULL,
  reason              text,
  started_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  ended_at            timestamptz,
  status              text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'expired', 'ended')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_impersonation_active ON impersonation_sessions (admin_person_id, status)
  WHERE status = 'active';
CREATE INDEX idx_impersonation_target ON impersonation_sessions (target_person_id);
