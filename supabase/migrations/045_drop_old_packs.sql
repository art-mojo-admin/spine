-- 045: Drop old config packs (the 11 from seed-config-packs.sql and 027_seed_expanded_packs.sql)
-- These are replaced by the 6 new template packs in 046.
DELETE FROM config_packs WHERE is_system = true;
