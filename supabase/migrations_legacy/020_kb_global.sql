-- Add is_global flag to knowledge_base_articles
-- Global articles are visible to all users regardless of account
ALTER TABLE knowledge_base_articles
  ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_kb_articles_is_global ON knowledge_base_articles (is_global) WHERE is_global = true;
