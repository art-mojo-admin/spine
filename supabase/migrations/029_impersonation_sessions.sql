-- Impersonation sessions: allows system admins to act as any user
CREATE TABLE impersonation_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_person_id uuid NOT NULL REFERENCES persons(id),
  target_person_id uuid NOT NULL REFERENCES persons(id),
  target_account_id uuid NOT NULL REFERENCES accounts(id),
  target_account_role text NOT NULL,
  reason        text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  ended_at      timestamptz,
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'expired', 'ended')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_impersonation_active ON impersonation_sessions (admin_person_id, status)
  WHERE status = 'active';

CREATE INDEX idx_impersonation_target ON impersonation_sessions (target_person_id);
