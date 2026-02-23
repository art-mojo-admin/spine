CREATE TABLE memberships (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id     uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  account_role  text NOT NULL DEFAULT 'member' CHECK (account_role IN ('admin', 'operator', 'member')),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),
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
