-- 040: Enrollments + lesson completions — course progress tracking
CREATE TABLE IF NOT EXISTS enrollments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  course_id     uuid NOT NULL REFERENCES knowledge_base_articles(id) ON DELETE CASCADE,
  person_id     uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  enrolled_at   timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  metadata      jsonb NOT NULL DEFAULT '{}',
  UNIQUE(account_id, course_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_account ON enrollments(account_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_person ON enrollments(person_id);

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lesson_completions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  enrollment_id   uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  article_id      uuid NOT NULL REFERENCES knowledge_base_articles(id) ON DELETE CASCADE,
  person_id       uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  completed_at    timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb NOT NULL DEFAULT '{}',
  UNIQUE(enrollment_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_completions_enrollment ON lesson_completions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_article ON lesson_completions(article_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_person ON lesson_completions(person_id);

ALTER TABLE lesson_completions ENABLE ROW LEVEL SECURITY;
