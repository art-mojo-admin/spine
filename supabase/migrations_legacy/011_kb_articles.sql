CREATE TABLE knowledge_base_articles (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title         text NOT NULL,
  slug          text NOT NULL,
  body          text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  category      text,
  author_person_id uuid REFERENCES persons(id),
  metadata      jsonb NOT NULL DEFAULT '{}',
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, slug)
);

CREATE INDEX idx_kb_articles_account_id ON knowledge_base_articles(account_id);
CREATE INDEX idx_kb_articles_status ON knowledge_base_articles(account_id, status);
CREATE INDEX idx_kb_articles_slug ON knowledge_base_articles(account_id, slug);

CREATE TRIGGER trg_kb_articles_updated_at
  BEFORE UPDATE ON knowledge_base_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
