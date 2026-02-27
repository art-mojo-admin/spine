CREATE OR REPLACE FUNCTION match_embeddings(
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
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
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
$$;
