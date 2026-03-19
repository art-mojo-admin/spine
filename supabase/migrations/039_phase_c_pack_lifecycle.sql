-- 039: Phase C - Pack Lifecycle Foundation
-- Adds local manifest support, install/upgrade/rollback, and installed_packs registry

BEGIN;

-- Create installed_packs registry table
CREATE TABLE IF NOT EXISTS installed_packs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES config_packs(id) ON DELETE CASCADE,
  pack_version text NOT NULL,
  install_status text NOT NULL DEFAULT 'pending' CHECK (install_status IN ('pending','installing','installed','failed','upgrading','uninstalling','uninstalled')),
  install_mode text NOT NULL DEFAULT 'install' CHECK (install_mode IN ('install','upgrade','rollback')),
  manifest_version integer NOT NULL DEFAULT 1,
  manifest_checksum text NOT NULL,
  installed_at timestamptz,
  activated_at timestamptz,
  error_message text,
  rollback_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, pack_id)
);

-- Add indexes for installed packs
CREATE INDEX IF NOT EXISTS idx_installed_packs_account ON installed_packs(account_id);
CREATE INDEX IF NOT EXISTS idx_installed_packs_status ON installed_packs(account_id, install_status);
CREATE INDEX IF NOT EXISTS idx_installed_packs_pack ON installed_packs(pack_id);

-- Create pack installation history table
CREATE TABLE IF NOT EXISTS pack_install_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES config_packs(id) ON DELETE CASCADE,
  installed_pack_id uuid REFERENCES installed_packs(id) ON DELETE SET NULL,
  operation text NOT NULL CHECK (operation IN ('install','upgrade','rollback','uninstall')),
  from_version text,
  to_version text NOT NULL,
  operation_status text NOT NULL DEFAULT 'pending' CHECK (operation_status IN ('pending','running','completed','failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  operation_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  rollback_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for installation history
CREATE INDEX IF NOT EXISTS idx_pack_install_history_account ON pack_install_history(account_id);
CREATE INDEX IF NOT EXISTS idx_pack_install_history_pack ON pack_install_history(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_install_history_operation ON pack_install_history(account_id, operation, operation_status);

-- Create pack dependencies table
CREATE TABLE IF NOT EXISTS pack_dependencies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  installed_pack_id uuid NOT NULL REFERENCES installed_packs(id) ON DELETE CASCADE,
  dependency_pack_id uuid NOT NULL REFERENCES config_packs(id) ON DELETE CASCADE,
  dependency_type text NOT NULL CHECK (dependency_type IN ('required','optional','conflicts')),
  version_constraint text NOT NULL DEFAULT '*',
  satisfied boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(installed_pack_id, dependency_pack_id)
);

-- Add indexes for dependencies
CREATE INDEX IF NOT EXISTS idx_pack_dependencies_installed ON pack_dependencies(installed_pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_dependencies_dependency ON pack_dependencies(dependency_pack_id);

-- Create pack rollback snapshots table
CREATE TABLE IF NOT EXISTS pack_rollback_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  installed_pack_id uuid NOT NULL REFERENCES installed_packs(id) ON DELETE CASCADE,
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('pre_install','pre_upgrade','pre_uninstall')),
  version text NOT NULL,
  snapshot_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for snapshots
CREATE INDEX IF NOT EXISTS idx_pack_rollback_snapshots_pack ON pack_rollback_snapshots(installed_pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_rollback_snapshots_type ON pack_rollback_snapshots(installed_pack_id, snapshot_type);

-- Create pack lifecycle functions

-- Function to create rollback snapshot
CREATE OR REPLACE FUNCTION create_pack_rollback_snapshot(
  snapshot_account_id uuid,
  snapshot_installed_pack_id uuid,
  snapshot_type text,
  snapshot_version text,
  snapshot_data jsonb
)
RETURNS uuid AS $$
DECLARE
  snapshot_id uuid;
BEGIN
  INSERT INTO pack_rollback_snapshots (
    account_id, 
    installed_pack_id, 
    snapshot_type, 
    version, 
    snapshot_data
  )
  VALUES (
    snapshot_account_id,
    snapshot_installed_pack_id,
    snapshot_type,
    snapshot_version,
    snapshot_data
  )
  RETURNING id INTO snapshot_id;
  
  RETURN snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check pack dependencies
CREATE OR REPLACE FUNCTION check_pack_dependencies(
  check_account_id uuid,
  check_pack_id uuid,
  check_version text
)
RETURNS TABLE (
  dependency_pack_id uuid,
  dependency_pack_name text,
  dependency_type text,
  version_constraint text,
  satisfied boolean,
  current_version text,
  error_message text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pd.dependency_pack_id,
    cp.name as dependency_pack_name,
    pd.dependency_type,
    pd.version_constraint,
    CASE 
      WHEN ip.pack_id IS NULL THEN false
      WHEN pd.version_constraint = '*' THEN true
      ELSE check_version_constraint(ip.pack_version, pd.version_constraint)
    END as satisfied,
    ip.pack_version as current_version,
    CASE 
      WHEN ip.pack_id IS NULL THEN 'Dependency not installed'
      WHEN NOT check_version_constraint(ip.pack_version, pd.version_constraint) THEN 
        'Version constraint not satisfied: ' || ip.pack_version || ' not in ' || pd.version_constraint
      ELSE NULL
    END as error_message
  FROM pack_dependencies pd
  LEFT JOIN config_packs cp ON pd.dependency_pack_id = cp.id
  LEFT JOIN installed_packs ip ON pd.dependency_pack_id = ip.pack_id AND ip.account_id = check_account_id
  WHERE pd.installed_pack_id IN (
    SELECT id FROM installed_packs 
    WHERE account_id = check_account_id AND pack_id = check_pack_id
  );
END;
$$ LANGUAGE plpgsql;

-- Helper function to check version constraints
CREATE OR REPLACE FUNCTION check_version_constraint(
  current_version text,
  constraint_pattern text
)
RETURNS boolean AS $$
BEGIN
  -- Simple version constraint checking
  -- Supports: "*", "1.0.0", ">=1.0.0", "~1.0.0", "^1.0.0"
  IF constraint_pattern = '*' THEN
    RETURN true;
  END IF;
  
  IF constraint_pattern = current_version THEN
    RETURN true;
  END IF;
  
  -- Handle >= constraint
  IF constraint_pattern LIKE '>=%' THEN
    RETURN current_version >= substring(constraint_pattern, 3);
  END IF;
  
  -- Handle ~ constraint (compatible version)
  IF constraint_pattern LIKE '~%' THEN
    DECLARE
      base_version text;
    BEGIN
      base_version := substring(constraint_pattern, 2);
      RETURN current_version LIKE base_version || '%';
    END;
  END IF;
  
  -- Handle ^ constraint (compatible major version)
  IF constraint_pattern LIKE '^%' THEN
    DECLARE
      major_version text;
    BEGIN
      major_version := split_part(substring(constraint_pattern, 2), '.', 1);
      RETURN split_part(current_version, '.', 1) = major_version;
    END;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to initiate pack installation
CREATE OR REPLACE FUNCTION initiate_pack_installation(
  install_account_id uuid,
  install_pack_id uuid,
  install_version text,
  install_mode text DEFAULT 'install'
)
RETURNS uuid AS $$
DECLARE
  installed_pack_id uuid;
  history_id uuid;
  current_version text;
BEGIN
  -- Check if pack is already installed
  SELECT pack_version INTO current_version
  FROM installed_packs
  WHERE account_id = install_account_id AND pack_id = install_pack_id;
  
  IF current_version IS NOT NULL AND install_mode = 'install' THEN
    RAISE EXCEPTION 'Pack already installed. Use upgrade mode instead.';
  END IF;
  
  -- Create or update installed_packs record
  INSERT INTO installed_packs (
    account_id, pack_id, pack_version, install_mode, install_status
  )
  VALUES (
    install_account_id, install_pack_id, install_version, install_mode, 'pending'
  )
  ON CONFLICT (account_id, pack_id)
  DO UPDATE SET
    pack_version = EXCLUDED.pack_version,
    install_mode = EXCLUDED.install_mode,
    install_status = 'pending',
    updated_at = now()
  RETURNING id INTO installed_pack_id;
  
  -- Create installation history record
  INSERT INTO pack_install_history (
    account_id, pack_id, installed_pack_id, operation, 
    from_version, to_version, operation_status
  )
  VALUES (
    install_account_id, install_pack_id, installed_pack_id, install_mode,
    current_version, install_version, 'pending'
  )
  RETURNING id INTO history_id;
  
  RETURN installed_pack_id;
END;
$$ LANGUAGE plpgsql;

-- Function to complete pack installation
CREATE OR REPLACE FUNCTION complete_pack_installation(
  complete_installed_pack_id uuid,
  success boolean,
  error_message text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  pack_record RECORD;
BEGIN
  -- Get pack details
  SELECT * INTO pack_record
  FROM installed_packs
  WHERE id = complete_installed_pack_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installed pack not found';
  END IF;
  
  -- Update installed pack status
  IF success THEN
    UPDATE installed_packs
    SET 
      install_status = 'installed',
      installed_at = now(),
      activated_at = now(),
      error_message = NULL,
      updated_at = now()
    WHERE id = complete_installed_pack_id;
    
    -- Update history record
    UPDATE pack_install_history
    SET 
      operation_status = 'completed',
      completed_at = now(),
      error_message = NULL
    WHERE installed_pack_id = complete_installed_pack_id
      AND operation_status = 'pending';
  ELSE
    UPDATE installed_packs
    SET 
      install_status = 'failed',
      error_message = error_message,
      updated_at = now()
    WHERE id = complete_installed_pack_id;
    
    -- Update history record
    UPDATE pack_install_history
    SET 
      operation_status = 'failed',
      completed_at = now(),
      error_message = error_message
    WHERE installed_pack_id = complete_installed_pack_id
      AND operation_status = 'pending';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create view for pack status overview
CREATE OR REPLACE VIEW pack_status_overview AS
SELECT 
  ip.*,
  cp.name as pack_name,
  cp.display_name as pack_display_name,
  cp.description as pack_description,
  cp.category as pack_category,
  cp.author as pack_author,
  iph.operation as latest_operation,
  iph.operation_status as latest_status,
  iph.started_at as latest_started_at,
  iph.completed_at as latest_completed_at,
  CASE 
    WHEN ip.install_status = 'installed' THEN 'active'
    WHEN ip.install_status IN ('pending','installing','upgrading') THEN 'in_progress'
    WHEN ip.install_status = 'failed' THEN 'error'
    ELSE 'inactive'
  END as overall_status
FROM installed_packs ip
LEFT JOIN config_packs cp ON ip.pack_id = cp.id
LEFT JOIN pack_install_history iph ON ip.id = iph.installed_pack_id
WHERE iph.id = (
  SELECT MAX(id) 
  FROM pack_install_history 
  WHERE installed_pack_id = ip.id
);

-- Add updated_at trigger
CREATE TRIGGER trg_installed_packs_updated_at
  BEFORE UPDATE ON installed_packs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
