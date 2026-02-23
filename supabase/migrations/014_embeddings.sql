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
