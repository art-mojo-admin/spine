-- 008: Knowledge — KB articles, embeddings, enrollments, lesson completions

-- ── knowledge_base_articles ────────────────────────────────────────────
CREATE TABLE knowledge_base_articles (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id        uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title             text NOT NULL,
  slug              text NOT NULL,
  body              text NOT NULL DEFAULT '',
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  category          text,
  author_person_id  uuid REFERENCES persons(id),
  parent_article_id uuid REFERENCES knowledge_base_articles(id) ON DELETE SET NULL,
  position          integer NOT NULL DEFAULT 0,
  is_global         boolean NOT NULL DEFAULT false,
  metadata          jsonb NOT NULL DEFAULT '{}',
  published_at      timestamptz,
  is_active         boolean NOT NULL DEFAULT true,
  is_test_data      boolean NOT NULL DEFAULT false,
  pack_id           uuid,
  ownership         text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, slug)
);

CREATE INDEX idx_kb_articles_account_id ON knowledge_base_articles(account_id);
CREATE INDEX idx_kb_articles_status ON knowledge_base_articles(account_id, status);
CREATE INDEX idx_kb_articles_slug ON knowledge_base_articles(account_id, slug);
CREATE INDEX idx_kb_articles_parent ON knowledge_base_articles(parent_article_id);
CREATE INDEX idx_kb_articles_position ON knowledge_base_articles(parent_article_id, position);
CREATE INDEX idx_kb_articles_is_global ON knowledge_base_articles(is_global) WHERE is_global = true;

CREATE TRIGGER trg_kb_articles_updated_at
  BEFORE UPDATE ON knowledge_base_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── embeddings ─────────────────────────────────────────────────────────
CREATE TABLE embeddings (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity_type   text NOT NULL,
  entity_id     uuid NOT NULL,
  vector_type   text NOT NULL,
  embedding     vector(1536) NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}',
  model         text NOT NULL DEFAULT 'text-embedding-ada-002',
  version       integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, entity_type, entity_id, vector_type)
);

CREATE INDEX idx_embeddings_account_id ON embeddings(account_id);
CREATE INDEX idx_embeddings_entity ON embeddings(entity_type, entity_id);
CREATE INDEX idx_embeddings_vector_type ON embeddings(account_id, entity_type, vector_type);
CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ── enrollments ────────────────────────────────────────────────────────
CREATE TABLE enrollments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  course_id     uuid NOT NULL REFERENCES knowledge_base_articles(id) ON DELETE CASCADE,
  person_id     uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  enrolled_at   timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  metadata      jsonb NOT NULL DEFAULT '{}',
  is_active     boolean NOT NULL DEFAULT true,
  is_test_data  boolean NOT NULL DEFAULT false,
  pack_id       uuid,
  ownership     text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  UNIQUE(account_id, course_id, person_id)
);

CREATE INDEX idx_enrollments_account ON enrollments(account_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_enrollments_person ON enrollments(person_id);

-- ── lesson_completions ─────────────────────────────────────────────────
CREATE TABLE lesson_completions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  enrollment_id   uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  article_id      uuid NOT NULL REFERENCES knowledge_base_articles(id) ON DELETE CASCADE,
  person_id       uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  completed_at    timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb NOT NULL DEFAULT '{}',
  is_active       boolean NOT NULL DEFAULT true,
  is_test_data    boolean NOT NULL DEFAULT false,
  pack_id         uuid,
  ownership       text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  UNIQUE(enrollment_id, article_id)
);

CREATE INDEX idx_lesson_completions_enrollment ON lesson_completions(enrollment_id);
CREATE INDEX idx_lesson_completions_article ON lesson_completions(article_id);
CREATE INDEX idx_lesson_completions_person ON lesson_completions(person_id);
