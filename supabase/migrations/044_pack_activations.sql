-- 044: Pack activations table + config_packs enhancements
-- Tracks which packs are activated per account with toggle state for config and test data.

-- ── Enhance config_packs ──────────────────────────────────────────────
ALTER TABLE config_packs ADD COLUMN IF NOT EXISTS slug     text UNIQUE;
ALTER TABLE config_packs ADD COLUMN IF NOT EXISTS icon     text;
ALTER TABLE config_packs ADD COLUMN IF NOT EXISTS category text;

-- ── pack_activations ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pack_activations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  pack_id           uuid NOT NULL REFERENCES config_packs(id) ON DELETE CASCADE,
  config_active     boolean NOT NULL DEFAULT false,
  test_data_active  boolean NOT NULL DEFAULT false,
  activated_by      uuid REFERENCES persons(id) ON DELETE SET NULL,
  activated_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, pack_id)
);

CREATE INDEX IF NOT EXISTS idx_pack_activations_account ON pack_activations(account_id);
CREATE INDEX IF NOT EXISTS idx_pack_activations_pack    ON pack_activations(pack_id);

ALTER TABLE pack_activations ENABLE ROW LEVEL SECURITY;
