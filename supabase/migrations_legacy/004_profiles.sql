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
