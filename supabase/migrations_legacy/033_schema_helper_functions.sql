-- 033_schema_helper_functions.sql
-- Refresh helper RPC + security-definer helpers for every Spine schema.
-- This is safe to run multiple times. It recreates the functions in-place
-- for both the public install and any namespaced schemas (e.g. spine_v1).

DO $$
DECLARE
  target_schema text;
BEGIN
  -- Find every non-system schema that looks like a Spine install.
  FOR target_schema IN
    SELECT n.nspname
    FROM pg_namespace n
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'extensions')
      AND EXISTS (
        SELECT 1
        FROM pg_class c
        WHERE c.relnamespace = n.oid
          AND c.relkind = 'r'
          AND c.relname = 'persons'
      )
  LOOP
    RAISE NOTICE 'Ensuring helper functions in schema %', target_schema;

    -- match_embeddings RPC (vector search helper)
    EXECUTE format($fn$
      CREATE OR REPLACE FUNCTION %1$I.match_embeddings(
        query_embedding text,
        match_count int DEFAULT 10,
        p_account_id uuid DEFAULT NULL
      )
      RETURNS TABLE (
        id uuid,
        account_id uuid,
        entity_type text,
        entity_id uuid,
        vector_type text,
        metadata jsonb,
        model text,
        created_at timestamptz,
        similarity float
      )
      LANGUAGE plpgsql
      SET search_path = %1$I, extensions
      AS $body$
      BEGIN
        RETURN QUERY
        SELECT e.id,
               e.account_id,
               e.entity_type,
               e.entity_id,
               e.vector_type,
               e.metadata,
               e.model,
               e.created_at,
               1 - (e.embedding <=> query_embedding::vector) AS similarity
        FROM embeddings e
        WHERE (p_account_id IS NULL OR e.account_id = p_account_id)
        ORDER BY e.embedding <=> query_embedding::vector
        LIMIT match_count;
      END;
      $body$;
    $fn$, target_schema);

    -- user_account_ids(): tenant scoping helper used by RLS policies
    EXECUTE format($fn$
      CREATE OR REPLACE FUNCTION %1$I.user_account_ids()
      RETURNS SETOF uuid
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      SET search_path = %1$I, extensions
      AS $body$
        SELECT m.account_id
        FROM memberships m
        JOIN persons p ON p.id = m.person_id
        WHERE p.auth_uid = auth.uid()
          AND m.status = 'active';
      $body$;
    $fn$, target_schema);

    -- user_person_id(): resolves the current person's id
    EXECUTE format($fn$
      CREATE OR REPLACE FUNCTION %1$I.user_person_id()
      RETURNS uuid
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      SET search_path = %1$I, extensions
      AS $body$
        SELECT p.id
        FROM persons p
        WHERE p.auth_uid = auth.uid()
        LIMIT 1;
      $body$;
    $fn$, target_schema);

    -- user_admin_account_ids(): elevated-scope helper used by policies
    EXECUTE format($fn$
      CREATE OR REPLACE FUNCTION %1$I.user_admin_account_ids()
      RETURNS SETOF uuid
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      SET search_path = %1$I, extensions
      AS $body$
        SELECT m.account_id
        FROM memberships m
        JOIN persons p ON p.id = m.person_id
        WHERE p.auth_uid = auth.uid()
          AND m.status = 'active'
          AND m.account_role IN ('admin', 'operator');
      $body$;
    $fn$, target_schema);

  END LOOP;
END
$$;
