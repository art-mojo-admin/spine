-- 036: Phase B - Relationship Traversal and Path Queries
-- Adds support for graph traversal and relationship path queries

BEGIN;

-- Create recursive CTE helper functions for item traversal
CREATE OR REPLACE FUNCTION traverse_item_links(
  start_item_id uuid,
  direction text DEFAULT 'both', -- 'outbound', 'inbound', 'both'
  link_types text[] DEFAULT NULL,
  max_depth integer DEFAULT 5
)
RETURNS TABLE (
  path_depth integer,
  item_id uuid,
  link_type text,
  source_item_id uuid,
  target_item_id uuid,
  path_item_ids uuid[],
  path_link_types text[]
) AS $$
DECLARE
  current_depth integer := 0;
BEGIN
  RETURN QUERY
  WITH RECURSIVE traversal AS (
    -- Base case: starting item
    SELECT 
      0 as depth,
      start_item_id as current_item,
      NULL::text as link_type_used,
      start_item_id as source_item,
      start_item_id as target_item,
      ARRAY[start_item_id] as item_path,
      ARRAY[]::text[] as link_path
    
    UNION ALL
    
    -- Recursive case: follow links
    SELECT 
      t.depth + 1,
      CASE 
        WHEN direction IN ('outbound', 'both') THEN il.target_item_id
        ELSE il.source_item_id
      END,
      il.link_type,
      il.source_item_id,
      il.target_item_id,
      t.item_path || CASE 
        WHEN direction IN ('outbound', 'both') THEN il.target_item_id
        ELSE il.source_item_id
      END,
      t.link_path || il.link_type
    FROM traversal t
    JOIN item_links il ON (
      (direction = 'outbound' AND il.source_item_id = t.current_item) OR
      (direction = 'inbound' AND il.target_item_id = t.current_item) OR
      (direction = 'both' AND (il.source_item_id = t.current_item OR il.target_item_id = t.current_item))
    )
    WHERE t.depth < max_depth
      AND (link_types IS NULL OR il.link_type = ANY(link_types))
      AND NOT (
        CASE 
          WHEN direction IN ('outbound', 'both') THEN il.target_item_id
          ELSE il.source_item_id
        END = ANY(t.item_path)
      ) -- Prevent cycles
  )
  SELECT 
    depth,
    current_item,
    link_type_used,
    source_item,
    target_item,
    item_path,
    link_path
  FROM traversal
  WHERE depth > 0 OR (depth = 0 AND start_item_id = start_item_id);
END;
$$ LANGUAGE plpgsql;

-- Function to find shortest path between two items
CREATE OR REPLACE FUNCTION find_shortest_path(
  from_item_id uuid,
  to_item_id uuid,
  link_types text[] DEFAULT NULL,
  max_depth integer DEFAULT 10
)
RETURNS TABLE (
  path_length integer,
  item_path uuid[],
  link_path text[]
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE path_search AS (
    -- Base case: start from source
    SELECT 
      0 as depth,
      from_item_id as current_item,
      ARRAY[from_item_id] as item_path,
      ARRAY[]::text[] as link_path
    
    UNION ALL
    
    -- Recursive case: explore connections
    SELECT 
      ps.depth + 1,
      CASE 
        WHEN il.source_item_id = ps.current_item THEN il.target_item_id
        ELSE il.source_item_id
      END,
      ps.item_path || CASE 
        WHEN il.source_item_id = ps.current_item THEN il.target_item_id
        ELSE il.source_item_id
      END,
      ps.link_path || il.link_type
    FROM path_search ps
    JOIN item_links il ON (
      il.source_item_id = ps.current_item OR il.target_item_id = ps.current_item
    )
    WHERE ps.depth < max_depth
      AND (link_types IS NULL OR il.link_type = ANY(link_types))
      AND NOT (
        CASE 
          WHEN il.source_item_id = ps.current_item THEN il.target_item_id
          ELSE il.source_item_id
        END = ANY(ps.item_path)
      ) -- Prevent cycles
  )
  SELECT 
    depth,
    item_path,
    link_path
  FROM path_search
  WHERE current_item = to_item_id
  ORDER BY depth
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get item network (all items within N hops)
CREATE OR REPLACE FUNCTION get_item_network(
  center_item_id uuid,
  radius integer DEFAULT 2,
  link_types text[] DEFAULT NULL
)
RETURNS TABLE (
  item_id uuid,
  distance integer,
  path_from_center uuid[],
  link_types_used text[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM traverse_item_links(center_item_id, 'both', link_types, radius)
  WHERE path_depth <= radius;
END;
$$ LANGUAGE plpgsql;

-- Function to get related items by type and link patterns
CREATE OR REPLACE FUNCTION get_related_items_by_type(
  item_id uuid,
  target_item_type text,
  link_pattern text DEFAULT '%', -- SQL LIKE pattern
  max_depth integer DEFAULT 3
)
RETURNS TABLE (
  related_item_id uuid,
  distance integer,
  path_link_types text[],
  match_type text -- 'direct', 'indirect'
) AS $$
BEGIN
  RETURN QUERY
  WITH related_items AS (
    SELECT *
    FROM traverse_item_links(item_id, 'both', NULL, max_depth)
    WHERE path_depth > 0
  )
  SELECT 
    ri.item_id,
    ri.path_depth as distance,
    ri.path_link_types,
    CASE 
      WHEN ri.path_depth = 1 THEN 'direct'
      ELSE 'indirect'
    END as match_type
  FROM related_items ri
  JOIN items i ON ri.item_id = i.id
  WHERE i.item_type = target_item_type
    AND (link_pattern = '%' OR ri.link_type LIKE link_pattern);
END;
$$ LANGUAGE plpgsql;

-- Create indexes for traversal performance
CREATE INDEX IF NOT EXISTS idx_item_links_composite ON item_links(account_id, source_item_id, link_type);
CREATE INDEX IF NOT EXISTS idx_item_links_target_composite ON item_links(account_id, target_item_id, link_type);

-- Add helper view for common traversal patterns
CREATE OR REPLACE VIEW item_relationships AS
SELECT 
  i.id as item_id,
  i.title as item_title,
  i.item_type,
  i.slug,
  l.id as link_id,
  l.link_type,
  l.sequence as link_sequence,
  l.metadata as link_metadata,
  related.id as related_item_id,
  related.title as related_item_title,
  related.item_type as related_item_type,
  related.slug as related_item_slug,
  CASE 
    WHEN l.source_item_id = i.id THEN 'outbound'
    ELSE 'inbound'
  END as direction,
  l.created_at as linked_at
FROM items i
JOIN item_links l ON (l.source_item_id = i.id OR l.target_item_id = i.id)
JOIN items related ON (
  (l.source_item_id = i.id AND l.target_item_id = related.id) OR
  (l.target_item_id = i.id AND l.source_item_id = related.id)
)
WHERE i.account_id = related.account_id;

COMMIT;
