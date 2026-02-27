-- Scheduled triggers: one-time, recurring (cron), and countdown timers

CREATE TABLE IF NOT EXISTS scheduled_triggers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name            text NOT NULL,
  trigger_type    text NOT NULL CHECK (trigger_type IN ('one_time', 'recurring', 'countdown')),
  -- one_time
  fire_at         timestamptz,
  -- recurring
  cron_expression text,
  next_fire_at    timestamptz,
  -- countdown
  delay_seconds   integer,
  delay_event     text,
  -- action (reuse existing action types)
  action_type     text NOT NULL,
  action_config   jsonb NOT NULL DEFAULT '{}',
  conditions      jsonb NOT NULL DEFAULT '[]',
  -- state
  enabled         boolean NOT NULL DEFAULT true,
  last_fired_at   timestamptz,
  fire_count      integer NOT NULL DEFAULT 0,
  -- meta
  created_by      uuid REFERENCES persons(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sched_triggers_account ON scheduled_triggers (account_id);
CREATE INDEX IF NOT EXISTS idx_sched_triggers_one_time ON scheduled_triggers (fire_at) WHERE trigger_type = 'one_time' AND enabled = true AND fire_count = 0;
CREATE INDEX IF NOT EXISTS idx_sched_triggers_recurring ON scheduled_triggers (next_fire_at) WHERE trigger_type = 'recurring' AND enabled = true;
CREATE INDEX IF NOT EXISTS idx_sched_triggers_countdown ON scheduled_triggers (delay_event) WHERE trigger_type = 'countdown' AND enabled = true;

CREATE TABLE IF NOT EXISTS scheduled_trigger_instances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id      uuid REFERENCES scheduled_triggers(id) ON DELETE CASCADE,
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  fire_at         timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fired', 'cancelled', 'failed')),
  context         jsonb NOT NULL DEFAULT '{}',
  -- for ad-hoc instances (workflow builder timers with no parent trigger)
  action_type     text,
  action_config   jsonb,
  -- result
  result          jsonb,
  fired_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sched_instances_pending ON scheduled_trigger_instances (fire_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sched_instances_trigger ON scheduled_trigger_instances (trigger_id);
CREATE INDEX IF NOT EXISTS idx_sched_instances_account ON scheduled_trigger_instances (account_id);
