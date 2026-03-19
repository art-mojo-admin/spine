-- 041: Phase D - Agent Contracts and Helper Utilities
-- Adds agent system with contracts, capabilities, and extension surfaces

BEGIN;

-- Create agent contracts table
CREATE TABLE IF NOT EXISTS agent_contracts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contract_name text NOT NULL,
  contract_version text NOT NULL DEFAULT '1.0.0',
  contract_type text NOT NULL CHECK (contract_type IN ('task','workflow','integration','monitoring','automation')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','suspended','deprecated')),
  principal_id uuid NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  contract_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  capabilities text[] NOT NULL DEFAULT ARRAY[]::text[],
  constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  execution_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  resource_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  security_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, contract_name, contract_version)
);

-- Add indexes for agent contracts
CREATE INDEX IF NOT EXISTS idx_agent_contracts_account ON agent_contracts(account_id);
CREATE INDEX IF NOT EXISTS idx_agent_contracts_principal ON agent_contracts(principal_id);
CREATE INDEX IF NOT EXISTS idx_agent_contracts_status ON agent_contracts(account_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_contracts_type ON agent_contracts(contract_type);

-- Create agent executions table
CREATE TABLE IF NOT EXISTS agent_executions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES agent_contracts(id) ON DELETE CASCADE,
  execution_id text NOT NULL UNIQUE,
  principal_id uuid NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  trigger_type text NOT NULL CHECK (trigger_type IN ('manual','scheduled','event','webhook','api')),
  trigger_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  execution_status text NOT NULL DEFAULT 'pending' CHECK (execution_status IN ('pending','running','completed','failed','cancelled','timeout')),
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  resource_usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for agent executions
CREATE INDEX IF NOT EXISTS idx_agent_executions_account ON agent_executions(account_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_contract ON agent_executions(contract_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(account_id, execution_status);
CREATE INDEX IF NOT EXISTS idx_agent_executions_execution_id ON agent_executions(execution_id);

-- Create agent capabilities registry
CREATE TABLE IF NOT EXISTS agent_capabilities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  capability_name text NOT NULL UNIQUE,
  capability_category text NOT NULL CHECK (capability_category IN ('system','data','integration','automation','monitoring','security')),
  capability_version text NOT NULL DEFAULT '1.0.0',
  description text,
  interface_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  implementation_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  security_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  resource_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for capabilities
CREATE INDEX IF NOT EXISTS idx_agent_capabilities_category ON agent_capabilities(capability_category);
CREATE INDEX IF NOT EXISTS idx_agent_capabilities_active ON agent_capabilities(is_active);

-- Create agent contract capabilities mapping
CREATE TABLE IF NOT EXISTS agent_contract_capabilities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id uuid NOT NULL REFERENCES agent_contracts(id) ON DELETE CASCADE,
  capability_id uuid NOT NULL REFERENCES agent_capabilities(id) ON DELETE CASCADE,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contract_id, capability_id)
);

-- Add indexes for contract capabilities
CREATE INDEX IF NOT EXISTS idx_agent_contract_capabilities_contract ON agent_contract_capabilities(contract_id);
CREATE INDEX IF NOT EXISTS idx_agent_contract_capabilities_capability ON agent_contract_capabilities(capability_id);

-- Create extension surfaces table
CREATE TABLE IF NOT EXISTS extension_surfaces (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  surface_name text NOT NULL,
  surface_type text NOT NULL CHECK (surface_type IN ('hook','endpoint','middleware','filter','transformer')),
  surface_version text NOT NULL DEFAULT '1.0.0',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','disabled','deprecated')),
  principal_id uuid NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  trigger_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  handler_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  execution_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  security_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, surface_name, surface_version)
);

-- Add indexes for extension surfaces
CREATE INDEX IF NOT EXISTS idx_extension_surfaces_account ON extension_surfaces(account_id);
CREATE INDEX IF NOT EXISTS idx_extension_surfaces_type ON extension_surfaces(surface_type);
CREATE INDEX IF NOT EXISTS idx_extension_surfaces_status ON extension_surfaces(account_id, status);

-- Create helper utilities registry
CREATE TABLE IF NOT EXISTS helper_utilities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  utility_name text NOT NULL UNIQUE,
  utility_category text NOT NULL CHECK (utility_category IN ('validation','transformation','calculation','formatting','security','integration')),
  utility_version text NOT NULL DEFAULT '1.0.0',
  description text,
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  implementation_code text,
  dependencies text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for helper utilities
CREATE INDEX IF NOT EXISTS idx_helper_utilities_category ON helper_utilities(utility_category);
CREATE INDEX IF NOT EXISTS idx_helper_utilities_active ON helper_utilities(is_active);

-- Agent system functions

-- Function to validate agent contract
CREATE OR REPLACE FUNCTION validate_agent_contract(
  contract_id uuid
)
RETURNS TABLE (
  validation_type text,
  validation_status text,
  validation_score integer,
  validation_details jsonb,
  error_messages jsonb
) AS $$
DECLARE
  contract_record RECORD;
  validation_errors jsonb[] := '{}';
  score integer := 100;
  details jsonb := '{}'::jsonb;
BEGIN
  -- Get contract record
  SELECT * INTO contract_record
  FROM agent_contracts
  WHERE id = contract_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent contract not found';
  END IF;
  
  -- Validate contract definition
  IF NOT contract_record.contract_definition ? 'name' THEN
    validation_errors := array_append(validation_errors, jsonb_build_object('field', 'name', 'error', 'Missing contract name'));
    score := score - 15;
  END IF;
  
  IF NOT contract_record.contract_definition ? 'description' THEN
    validation_errors := array_append(validation_errors, jsonb_build_object('field', 'description', 'error', 'Missing contract description'));
    score := score - 10;
  END IF;
  
  -- Validate capabilities
  IF array_length(contract_record.capabilities, 1) IS NULL OR array_length(contract_record.capabilities, 1) = 0 THEN
    validation_errors := array_append(validation_errors, jsonb_build_object('field', 'capabilities', 'error', 'No capabilities specified'));
    score := score - 20;
  ELSE
    -- Check if all capabilities exist and are active
    FOR i IN 1..array_length(contract_record.capabilities, 1) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM agent_capabilities 
        WHERE capability_name = contract_record.capabilities[i] AND is_active = true
      ) THEN
        validation_errors := array_append(validation_errors, jsonb_build_object(
          'capability', contract_record.capabilities[i],
          'error', 'Capability does not exist or is not active'
        ));
        score := score - 10;
      END IF;
    END LOOP;
  END IF;
  
  -- Validate security policy
  IF NOT contract_record.security_policy ? 'permissions' THEN
    validation_errors := array_append(validation_errors, jsonb_build_object('field', 'security_policy.permissions', 'error', 'Missing permissions definition'));
    score := score - 15;
  END IF;
  
  details := jsonb_set(details, '{capability_count}', to_jsonb(array_length(contract_record.capabilities, 1)));
  
  -- Return validation results
  RETURN QUERY SELECT 
    'contract' as validation_type,
    CASE 
      WHEN score >= 80 THEN 'passed'
      WHEN score >= 60 THEN 'warning'
      ELSE 'failed'
    END as validation_status,
    score as validation_score,
    details as validation_details,
    to_jsonb(validation_errors) as error_messages;
END;
$$ LANGUAGE plpgsql;

-- Function to create agent execution
CREATE OR REPLACE FUNCTION create_agent_execution(
  execution_account_id uuid,
  execution_contract_id uuid,
  execution_principal_id uuid,
  trigger_type text,
  trigger_data jsonb DEFAULT '{}'::jsonb,
  input_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  execution_id uuid;
  execution_uuid text;
  contract_record RECORD;
BEGIN
  -- Get contract record
  SELECT * INTO contract_record
  FROM agent_contracts
  WHERE id = execution_contract_id AND status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active agent contract not found';
  END IF;
  
  -- Generate execution ID
  execution_uuid := replace(gen_random_uuid()::text, '-', '');
  
  -- Create execution record
  INSERT INTO agent_executions (
    account_id, contract_id, execution_id, principal_id,
    trigger_type, trigger_data, input_data, execution_status, started_at
  )
  VALUES (
    execution_account_id, execution_contract_id, execution_uuid, execution_principal_id,
    trigger_type, trigger_data, input_data, 'pending', now()
  )
  RETURNING id INTO execution_id;
  
  RETURN execution_id;
END;
$$ LANGUAGE plpgsql;

-- Function to complete agent execution
CREATE OR REPLACE FUNCTION complete_agent_execution(
  execution_id_param uuid,
  execution_status text,
  output_data jsonb DEFAULT '{}'::jsonb,
  error_message text DEFAULT NULL,
  logs jsonb DEFAULT '[]'::jsonb,
  metrics jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
DECLARE
  execution_record RECORD;
  duration_ms integer;
BEGIN
  -- Get execution record
  SELECT * INTO execution_record
  FROM agent_executions
  WHERE id = execution_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent execution not found';
  END IF;
  
  -- Calculate duration
  IF execution_record.started_at IS NOT NULL THEN
    duration_ms := EXTRACT(EPOCH FROM (now() - execution_record.started_at)) * 1000;
  END IF;
  
  -- Update execution record
  UPDATE agent_executions
  SET 
    execution_status = execution_status,
    completed_at = now(),
    duration_ms = duration_ms,
    output_data = output_data,
    error_message = error_message,
    logs = logs,
    metrics = metrics
  WHERE id = execution_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to register system capability
CREATE OR REPLACE FUNCTION register_system_capability(
  capability_name text,
  capability_category text,
  description text DEFAULT NULL,
  interface_definition jsonb DEFAULT '{}'::jsonb,
  implementation_requirements jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  capability_id uuid;
BEGIN
  INSERT INTO agent_capabilities (
    capability_name, capability_category, description,
    interface_definition, implementation_requirements, is_system, is_active
  )
  VALUES (
    capability_name, capability_category, description,
    interface_definition, implementation_requirements, true, true
  )
  RETURNING id INTO capability_id;
  
  RETURN capability_id;
END;
$$ LANGUAGE plpgsql;

-- Function to register helper utility
CREATE OR REPLACE FUNCTION register_helper_utility(
  utility_name text,
  utility_category text,
  description text DEFAULT NULL,
  input_schema jsonb DEFAULT '{}'::jsonb,
  output_schema jsonb DEFAULT '{}'::jsonb,
  implementation_code text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  utility_id uuid;
BEGIN
  INSERT INTO helper_utilities (
    utility_name, utility_category, description,
    input_schema, output_schema, implementation_code, is_system, is_active
  )
  VALUES (
    utility_name, utility_category, description,
    input_schema, output_schema, implementation_code, true, true
  )
  RETURNING id INTO utility_id;
  
  RETURN utility_id;
END;
$$ LANGUAGE plpgsql;

-- Create views for agent system overview
CREATE OR REPLACE VIEW agent_contracts_overview AS
SELECT 
  ac.*,
  p.principal_type,
  p.display_name as principal_display_name,
  capability_count,
  execution_count,
  last_execution_at,
  success_rate
FROM agent_contracts ac
LEFT JOIN principals p ON ac.principal_id = p.id
LEFT JOIN (
  SELECT 
    contract_id,
    COUNT(*) as capability_count
  FROM agent_contract_capabilities
  GROUP BY contract_id
) cap_count ON ac.id = cap_count.contract_id
LEFT JOIN (
  SELECT 
    contract_id,
    COUNT(*) as execution_count,
    MAX(started_at) as last_execution_at,
    ROUND(
      COUNT(*) FILTER (WHERE execution_status = 'completed') * 100.0 / 
      NULLIF(COUNT(*), 0), 2
    ) as success_rate
  FROM agent_executions
  GROUP BY contract_id
) exec_stats ON ac.id = exec_stats.contract_id;

CREATE OR REPLACE VIEW agent_executions_overview AS
SELECT 
  ae.*,
  ac.contract_name,
  ac.contract_type,
  p.principal_type,
  p.display_name as principal_display_name,
  CASE 
    WHEN ae.execution_status = 'completed' THEN 'success'
    WHEN ae.execution_status = 'failed' THEN 'error'
    WHEN ae.execution_status = 'running' THEN 'in_progress'
    ELSE 'pending'
  END as overall_status
FROM agent_executions ae
LEFT JOIN agent_contracts ac ON ae.contract_id = ac.id
LEFT JOIN principals p ON ae.principal_id = p.id;

-- Add updated_at triggers
CREATE TRIGGER trg_agent_contracts_updated_at
  BEFORE UPDATE ON agent_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_extension_surfaces_updated_at
  BEFORE UPDATE ON extension_surfaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_helper_utilities_updated_at
  BEFORE UPDATE ON helper_utilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
