-- 040: Phase C - Local Manifest Support
-- Adds local pack manifest handling and validation

BEGIN;

-- Create local pack manifests table
CREATE TABLE IF NOT EXISTS local_pack_manifests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  pack_id uuid REFERENCES config_packs(id) ON DELETE SET NULL,
  manifest_name text NOT NULL,
  manifest_version integer NOT NULL DEFAULT 1,
  manifest_status text NOT NULL DEFAULT 'draft' CHECK (manifest_status IN ('draft','validated','published','deprecated')),
  manifest_type text NOT NULL CHECK (manifest_type IN ('full','delta','patch')),
  manifest_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  manifest_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  checksum text NOT NULL,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  compatibility_matrix jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  install_script text,
  upgrade_script text,
  rollback_script text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_principal_id uuid REFERENCES principals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, manifest_name, manifest_version)
);

-- Add indexes for local manifests
CREATE INDEX IF NOT EXISTS idx_local_pack_manifests_account ON local_pack_manifests(account_id);
CREATE INDEX IF NOT EXISTS idx_local_pack_manifests_pack ON local_pack_manifests(pack_id);
CREATE INDEX IF NOT EXISTS idx_local_pack_manifests_status ON local_pack_manifests(account_id, manifest_status);
CREATE INDEX IF NOT EXISTS idx_local_pack_manifests_checksum ON local_pack_manifests(checksum);

-- Create manifest validation results table
CREATE TABLE IF NOT EXISTS manifest_validation_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  manifest_id uuid NOT NULL REFERENCES local_pack_manifests(id) ON DELETE CASCADE,
  validation_type text NOT NULL CHECK (validation_type IN ('schema','dependencies','compatibility','security','performance')),
  validation_status text NOT NULL CHECK (validation_status IN ('pending','passed','failed','warning')),
  validation_score integer CHECK (validation_score >= 0 AND validation_score <= 100),
  validation_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  validated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for validation results
CREATE INDEX IF NOT EXISTS idx_manifest_validation_manifest ON manifest_validation_results(manifest_id);
CREATE INDEX IF NOT EXISTS idx_manifest_validation_status ON manifest_validation_results(manifest_id, validation_status);

-- Create manifest assets table (for file attachments, images, etc.)
CREATE TABLE IF NOT EXISTS manifest_assets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  manifest_id uuid NOT NULL REFERENCES local_pack_manifests(id) ON DELETE CASCADE,
  asset_name text NOT NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('image','document','script','config','data')),
  asset_path text NOT NULL,
  asset_size bigint NOT NULL,
  asset_checksum text NOT NULL,
  mime_type text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for assets
CREATE INDEX IF NOT EXISTS idx_manifest_assets_manifest ON manifest_assets(manifest_id);
CREATE INDEX IF NOT EXISTS idx_manifest_assets_type ON manifest_assets(manifest_id, asset_type);

-- Create manifest functions

-- Function to calculate manifest checksum
CREATE OR REPLACE FUNCTION calculate_manifest_checksum(
  manifest_content jsonb,
  manifest_schema jsonb,
  dependencies jsonb
)
RETURNS text AS $$
DECLARE
  combined_content text;
BEGIN
  -- Combine manifest components for checksum calculation
  combined_content := jsonb_build_object(
    'content', manifest_content,
    'schema', manifest_schema,
    'dependencies', dependencies
  )::text;
  
  -- Generate SHA-256 checksum
  RETURN encode(sha256(combined_content::bytea), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to validate manifest schema
CREATE OR REPLACE FUNCTION validate_manifest_schema(
  validate_manifest_id uuid
)
RETURNS TABLE (
  validation_type text,
  validation_status text,
  validation_score integer,
  validation_details jsonb,
  error_messages jsonb
) AS $$
DECLARE
  manifest_record RECORD;
  schema_errors jsonb[] := '{}';
  score integer := 100;
  details jsonb := '{}'::jsonb;
BEGIN
  -- Get manifest record
  SELECT * INTO manifest_record
  FROM local_pack_manifests
  WHERE id = validate_manifest_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manifest not found';
  END IF;
  
  -- Validate required fields
  IF NOT manifest_record.manifest_content ? 'name' THEN
    schema_errors := array_append(schema_errors, jsonb_build_object('field', 'name', 'error', 'Missing required field'));
    score := score - 20;
  END IF;
  
  IF NOT manifest_record.manifest_content ? 'version' THEN
    schema_errors := array_append(schema_errors, jsonb_build_object('field', 'version', 'error', 'Missing required field'));
    score := score - 20;
  END IF;
  
  IF NOT manifest_record.manifest_content ? 'description' THEN
    schema_errors := array_append(schema_errors, jsonb_build_object('field', 'description', 'error', 'Missing required field'));
    score := score - 10;
  END IF;
  
  -- Validate pack structure
  IF manifest_record.manifest_content ? 'items' THEN
    DECLARE
      item_count integer;
    BEGIN
      item_count := jsonb_array_length(manifest_record.manifest_content->'items');
      details := jsonb_set(details, '{item_count}', to_jsonb(item_count));
      
      -- Validate each item
      FOR i IN 0..item_count-1 LOOP
        DECLARE
          item_record jsonb;
        BEGIN
          item_record := manifest_record.manifest_content->'items'->i;
          
          IF NOT item_record ? 'item_type' THEN
            schema_errors := array_append(schema_errors, jsonb_build_object(
              'field', 'items[' || i || '].item_type', 
              'error', 'Missing item_type'
            ));
            score := score - 5;
          END IF;
          
          IF NOT item_record ? 'title' THEN
            schema_errors := array_append(schema_errors, jsonb_build_object(
              'field', 'items[' || i || '].title', 
              'error', 'Missing title'
            ));
            score := score - 3;
          END IF;
        END;
      END LOOP;
    END;
  END IF;
  
  -- Return validation results
  RETURN QUERY SELECT 
    'schema' as validation_type,
    CASE 
      WHEN score >= 80 THEN 'passed'
      WHEN score >= 60 THEN 'warning'
      ELSE 'failed'
    END as validation_status,
    score as validation_score,
    details as validation_details,
    to_jsonb(schema_errors) as error_messages;
END;
$$ LANGUAGE plpgsql;

-- Function to validate manifest dependencies
CREATE OR REPLACE FUNCTION validate_manifest_dependencies(
  validate_manifest_id uuid
)
RETURNS TABLE (
  validation_type text,
  validation_status text,
  validation_score integer,
  validation_details jsonb,
  error_messages jsonb
) AS $$
DECLARE
  manifest_record RECORD;
  dependency_errors jsonb[] := '{}';
  score integer := 100;
  details jsonb := '{}'::jsonb;
  dep_count integer;
BEGIN
  -- Get manifest record
  SELECT * INTO manifest_record
  FROM local_pack_manifests
  WHERE id = validate_manifest_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manifest not found';
  END IF;
  
  dep_count := jsonb_array_length(manifest_record.dependencies);
  details := jsonb_set(details, '{dependency_count}', to_jsonb(dep_count));
  
  -- Validate each dependency
  FOR i IN 0..dep_count-1 LOOP
    DECLARE
      dependency jsonb;
      dep_pack_id uuid;
      dep_version text;
    BEGIN
      dependency := manifest_record.dependencies->i;
      
      IF NOT dependency ? 'pack_id' THEN
        dependency_errors := array_append(dependency_errors, jsonb_build_object(
          'dependency', i,
          'error', 'Missing pack_id'
        ));
        score := score - 15;
      ELSE
        dep_pack_id := (dependency->>'pack_id')::uuid;
        
        -- Check if pack exists
        IF NOT EXISTS (SELECT 1 FROM config_packs WHERE id = dep_pack_id) THEN
          dependency_errors := array_append(dependency_errors, jsonb_build_object(
            'dependency', i,
            'error', 'Referenced pack does not exist'
          ));
          score := score - 20;
        END IF;
      END IF;
      
      IF NOT dependency ? 'version_constraint' THEN
        dependency_errors := array_append(dependency_errors, jsonb_build_object(
          'dependency', i,
          'error', 'Missing version_constraint'
        ));
        score := score - 10;
      END IF;
    END;
  END LOOP;
  
  -- Return validation results
  RETURN QUERY SELECT 
    'dependencies' as validation_type,
    CASE 
      WHEN score >= 80 THEN 'passed'
      WHEN score >= 60 THEN 'warning'
      ELSE 'failed'
    END as validation_status,
    score as validation_score,
    details as validation_details,
    to_jsonb(dependency_errors) as error_messages;
END;
$$ LANGUAGE plpgsql;

-- Function to create or update local manifest
CREATE OR REPLACE FUNCTION create_local_manifest(
  manifest_account_id uuid,
  manifest_pack_id uuid DEFAULT NULL,
  manifest_name text,
  manifest_content jsonb,
  manifest_schema jsonb DEFAULT '{}'::jsonb,
  dependencies jsonb DEFAULT '[]'::jsonb,
  created_by_principal_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  manifest_id uuid;
  new_checksum text;
  new_version integer;
BEGIN
  -- Calculate checksum
  new_checksum := calculate_manifest_checksum(manifest_content, manifest_schema, dependencies);
  
  -- Get next version for this manifest name
  SELECT COALESCE(MAX(manifest_version), 0) + 1 INTO new_version
  FROM local_pack_manifests
  WHERE account_id = manifest_account_id AND manifest_name = manifest_name;
  
  -- Create manifest record
  INSERT INTO local_pack_manifests (
    account_id, pack_id, manifest_name, manifest_version,
    manifest_content, manifest_schema, dependencies,
    checksum, created_by_principal_id
  )
  VALUES (
    manifest_account_id, manifest_pack_id, manifest_name, new_version,
    manifest_content, manifest_schema, dependencies,
    new_checksum, created_by_principal_id
  )
  RETURNING id INTO manifest_id;
  
  RETURN manifest_id;
END;
$$ LANGUAGE plpgsql;

-- Function to publish manifest
CREATE OR REPLACE FUNCTION publish_manifest(
  publish_manifest_id uuid,
  validate_before_publish boolean DEFAULT true
)
RETURNS boolean AS $$
DECLARE
  validation_passed boolean := true;
  validation_result RECORD;
BEGIN
  -- Validate before publishing if requested
  IF validate_before_publish THEN
    -- Run schema validation
    FOR validation_result IN SELECT * FROM validate_manifest_schema(publish_manifest_id) LOOP
      IF validation_result.validation_status = 'failed' THEN
        validation_passed := false;
      END IF;
      
      -- Store validation result
      INSERT INTO manifest_validation_results (
        manifest_id, validation_type, validation_status, 
        validation_score, validation_details, error_messages
      )
      VALUES (
        publish_manifest_id, validation_result.validation_type,
        validation_result.validation_status, validation_result.validation_score,
        validation_result.validation_details, validation_result.error_messages
      );
    END LOOP;
    
    -- Run dependency validation
    FOR validation_result IN SELECT * FROM validate_manifest_dependencies(publish_manifest_id) LOOP
      IF validation_result.validation_status = 'failed' THEN
        validation_passed := false;
      END IF;
      
      -- Store validation result
      INSERT INTO manifest_validation_results (
        manifest_id, validation_type, validation_status, 
        validation_score, validation_details, error_messages
      )
      VALUES (
        publish_manifest_id, validation_result.validation_type,
        validation_result.validation_status, validation_result.validation_score,
        validation_result.validation_details, validation_result.error_messages
      );
    END LOOP;
  END IF;
  
  -- Update manifest status
  IF validation_passed THEN
    UPDATE local_pack_manifests
    SET manifest_status = 'published', updated_at = now()
    WHERE id = publish_manifest_id;
  ELSE
    UPDATE local_pack_manifests
    SET manifest_status = 'draft', updated_at = now()
    WHERE id = publish_manifest_id;
  END IF;
  
  RETURN validation_passed;
END;
$$ LANGUAGE plpgsql;

-- Create view for manifest overview
CREATE OR REPLACE VIEW local_manifest_overview AS
SELECT 
  lpm.*,
  cp.name as pack_name,
  cp.display_name as pack_display_name,
  validation_summary.passed_count,
  validation_summary.failed_count,
  validation_summary.warning_count,
  validation_summary.avg_score,
  CASE 
    WHEN lpm.manifest_status = 'published' AND validation_summary.failed_count = 0 THEN 'ready'
    WHEN lpm.manifest_status = 'draft' THEN 'draft'
    WHEN validation_summary.failed_count > 0 THEN 'validation_failed'
    ELSE 'in_review'
  END as overall_status
FROM local_pack_manifests lpm
LEFT JOIN config_packs cp ON lpm.pack_id = cp.id
LEFT JOIN (
  SELECT 
    manifest_id,
    COUNT(*) FILTER (WHERE validation_status = 'passed') as passed_count,
    COUNT(*) FILTER (WHERE validation_status = 'failed') as failed_count,
    COUNT(*) FILTER (WHERE validation_status = 'warning') as warning_count,
    AVG(validation_score) as avg_score
  FROM manifest_validation_results
  GROUP BY manifest_id
) validation_summary ON lpm.id = validation_summary.manifest_id;

-- Add updated_at trigger
CREATE TRIGGER trg_local_pack_manifests_updated_at
  BEFORE UPDATE ON local_pack_manifests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
