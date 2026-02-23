CREATE TABLE persons (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_uid      uuid UNIQUE,
  email         text NOT NULL UNIQUE,
  full_name     text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_persons_email ON persons(email);
CREATE INDEX idx_persons_auth_uid ON persons(auth_uid);
CREATE INDEX idx_persons_status ON persons(status);

CREATE TRIGGER trg_persons_updated_at
  BEFORE UPDATE ON persons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
