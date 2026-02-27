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
