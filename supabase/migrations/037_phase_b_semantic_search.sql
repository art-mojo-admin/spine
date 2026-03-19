-- 037: Phase B - Semantic and Hybrid Search
-- Adds vector search capabilities and hybrid retrieval combining semantic + filtered search

BEGIN;

-- Ensure pgvector extension is available
CREATE EXTENSION IF NOT EXISTS vector;

-- Update embeddings table to support multiple embedding strategies
ALTER TABLE embeddings
  ADD COLUMN IF NOT EXISTS embedding_strategy text NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS chunk_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chunk_text text,
  ADD COLUMN IF NOT EXISTS context_window integer NOT NULL DEFAULT 8192,
  ADD COLUMN IF NOT EXISTS model_version text NOT NULL DEFAULT 'text-embedding-ada-002',
  ADD COLUMN IF NOT EXISTS relevance_score float,
  ADD COLUMN IF NOT EXISTS search_vector vector(1536);

-- Add indexes for vector search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_search ON embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_embeddings_account_entity ON embeddings(account_id, entity_type, entity_id);

-- Function for semantic search using cosine similarity
CREATE OR REPLACE FUNCTION semantic_search(
  search_account_id uuid,
  search_query_vector vector(1536),
  search_entity_types text[] DEFAULT NULL,
  search_limit integer DEFAULT 20,
  search_threshold float DEFAULT 0.7
)
RETURNS TABLE (
  entity_id uuid,
  entity_type text,
  similarity float,
  entity_data jsonb,
  embedding_metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.entity_id,
    e.entity_type,
    1 - (e.embedding <=> search_query_vector) as similarity,
    jsonb_build_object(
      'account_id', e.account_id,
      'entity_type', e.entity_type,
      'entity_id', e.entity_id,
      'vector_type', e.vector_type,
      'model', e.model,
      'chunk_index', e.chunk_index,
      'chunk_text', e.chunk_text
    ) as entity_data,
    jsonb_build_object(
      'embedding_strategy', e.embedding_strategy,
      'model_version', e.model_version,
      'context_window', e.context_window,
      'created_at', e.created_at
    ) as embedding_metadata
  FROM embeddings e
  WHERE e.account_id = search_account_id
    AND (search_entity_types IS NULL OR e.entity_type = ANY(search_entity_types))
    AND 1 - (e.embedding <=> search_query_vector) >= search_threshold
  ORDER BY similarity DESC
  LIMIT search_limit;
END;
$$ LANGUAGE plpgsql;

-- Function for hybrid search combining semantic + filtered criteria
CREATE OR REPLACE FUNCTION hybrid_search(
  search_account_id uuid,
  search_query_vector vector(1536),
  search_filters jsonb DEFAULT '{}',
  search_entity_types text[] DEFAULT NULL,
  search_limit integer DEFAULT 20,
  search_threshold float DEFAULT 0.5,
  semantic_weight float DEFAULT 0.6
)
RETURNS TABLE (
  entity_id uuid,
  entity_type text,
  semantic_score float,
  filter_score float,
  hybrid_score float,
  entity_data jsonb,
  embedding_metadata jsonb
) AS $$
DECLARE
  semantic_results RECORD;
  filter_results RECORD;
  combined_results jsonb;
BEGIN
  -- Get semantic results
  FOR semantic_results IN 
    SELECT * FROM semantic_search(
      search_account_id, 
      search_query_vector, 
      search_entity_types, 
      search_limit * 2, -- Get more to combine
      search_threshold
    )
  LOOP
    -- Apply filter scoring
    filter_score := 1.0; -- Default perfect match
    
    -- Apply item-specific filters
    IF semantic_results.entity_type = 'item' THEN
      -- Check against item filters
      IF search_filters ? 'item_type' AND search_filters->>'item_type' != '' THEN
        SELECT CASE 
          WHEN i.item_type = search_filters->>'item_type' THEN 1.0
          ELSE 0.0
        END INTO filter_score
        FROM items i
        WHERE i.id = semantic_results.entity_id
        AND i.account_id = search_account_id;
      END IF;
      
      -- Check status filter
      IF search_filters ? 'status' AND search_filters->>'status' != '' THEN
        SELECT CASE 
          WHEN i.status = search_filters->>'status' THEN 1.0
          ELSE 0.0
        END INTO filter_score
        FROM items i
        WHERE i.id = semantic_results.entity_id
        AND i.account_id = search_account_id;
      END IF;
    END IF;
    
    -- Calculate hybrid score
    hybrid_score := (semantic_results.similarity * semantic_weight) + 
                   (filter_score * (1 - semantic_weight));
    
    -- Only return if meets minimum threshold
    IF hybrid_score >= search_threshold THEN
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to generate embeddings for items with chunking
CREATE OR REPLACE FUNCTION generate_item_embeddings(
  target_item_id uuid,
  chunk_size integer DEFAULT 500,
  chunk_overlap integer DEFAULT 50
)
RETURNS TABLE (
  chunk_index integer,
  embedding vector(1536),
  chunk_text text
) AS $$
DECLARE
  item_record RECORD;
  full_text text;
  chunks text[];
  chunk_start integer := 1;
  chunk_end integer;
BEGIN
  -- Get item data
  SELECT i.id, i.title, i.description, i.metadata, i.custom_fields
  INTO item_record
  FROM items i
  WHERE i.id = target_item_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Build full text from item fields
  full_text := COALESCE(item_record.title, '') || ' ' || 
               COALESCE(item_record.description, '') || ' ' ||
               COALESCE(jsonb_extract_path_text(item_record.metadata, 'content'), '') || ' ' ||
               COALESCE(jsonb_extract_path_text(item_record.custom_fields, 'content'), '');
  
  -- Simple chunking by character count
  WHILE chunk_start <= length(full_text) LOOP
    chunk_end := LEAST(chunk_start + chunk_size - 1, length(full_text));
    
    -- Try to break at word boundary
    IF chunk_end < length(full_text) THEN
      WHILE chunk_end > chunk_start AND substring(full_text, chunk_end, 1) != ' ' LOOP
        chunk_end := chunk_end - 1;
      END LOOP;
    END IF;
    
    IF chunk_end >= chunk_start THEN
      chunks := array_append(chunks, substring(full_text, chunk_start, chunk_end - chunk_start + 1));
      chunk_start := chunk_end + chunk_overlap + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  
  -- Return chunks (actual embedding generation would be done via external service)
  FOR i IN 1..array_length(chunks, 1) LOOP
    chunk_index := i - 1;
    chunk_text := chunks[i];
    -- Note: Actual embedding generation would call OpenAI API here
    embedding := '[0:0]'::vector(1536); -- Placeholder
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to update search index for items
CREATE OR REPLACE FUNCTION update_item_search_index(
  target_item_id uuid,
  force_update boolean DEFAULT false
)
RETURNS void AS $$
DECLARE
  existing_embedding RECORD;
  item_text text;
BEGIN
  -- Check if embedding exists and is recent
  SELECT * INTO existing_embedding
  FROM embeddings
  WHERE entity_id = target_item_id
    AND entity_type = 'item'
    AND vector_type = 'search';
  
  IF existing_embedding IS NOT NULL AND NOT force_update THEN
    -- Check if embedding is stale (item updated after embedding)
    SELECT CASE 
      WHEN i.updated_at > existing_embedding.created_at THEN true
      ELSE false
    END INTO force_update
    FROM items i
    WHERE i.id = target_item_id;
  END IF;
  
  IF force_update OR existing_embedding IS NULL THEN
    -- Get item text content
    SELECT COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || 
           COALESCE(jsonb_extract_path_text(metadata, 'content'), '')
    INTO item_text
    FROM items
    WHERE id = target_item_id;
    
    -- Update or insert embedding
    INSERT INTO embeddings (
      account_id, entity_type, entity_id, vector_type, 
      embedding, metadata, model, version
    )
    SELECT 
      account_id, 'item', target_item_id, 'search',
      '[0:0]'::vector(1536), -- Placeholder for actual embedding
      jsonb_build_object(
        'chunk_text', item_text,
        'embedding_strategy', 'openai',
        'chunk_index', 0
      ),
      'text-embedding-ada-002',
      1
    FROM items
    WHERE id = target_item_id
    ON CONFLICT (account_id, entity_type, entity_id, vector_type)
    DO UPDATE SET
      embedding = EXCLUDED.embedding,
      metadata = EXCLUDED.metadata,
      updated_at = now();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update search index
CREATE OR REPLACE FUNCTION trigger_update_item_search_index()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_item_search_index(NEW.id, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_items_update_search_index ON items;
CREATE TRIGGER trg_items_update_search_index
  AFTER INSERT OR UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION trigger_update_item_search_index();

-- Add search configuration to item_type_registry
ALTER TABLE item_type_registry
  ADD COLUMN IF NOT EXISTS search_config jsonb NOT NULL DEFAULT '{
    "enable_semantic": true,
    "enable_full_text": false,
    "chunk_size": 500,
    "chunk_overlap": 50,
    "embedding_fields": ["title", "description", "metadata.content", "custom_fields.content"]
  }'::jsonb;

COMMIT;
