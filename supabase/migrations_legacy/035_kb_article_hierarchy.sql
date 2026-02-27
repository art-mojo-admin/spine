-- 035: KB article hierarchy — parent/child for courses, nested docs, handbooks
ALTER TABLE knowledge_base_articles
  ADD COLUMN IF NOT EXISTS parent_article_id uuid REFERENCES knowledge_base_articles(id) ON DELETE SET NULL;

ALTER TABLE knowledge_base_articles
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_kb_articles_parent ON knowledge_base_articles(parent_article_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_position ON knowledge_base_articles(parent_article_id, position);
