-- 007_knowledge_vectors.sql
-- Tabela de vetores para busca semântica (pgvector)

CREATE TABLE ai.knowledge_vectors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_id   uuid NOT NULL,
  content     text NOT NULL,
  embedding   vector(768),
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_vectors_source ON ai.knowledge_vectors (source_type, source_id);

-- IVFFlat index para busca por similaridade de cosseno
-- Nota: reconstruir com REINDEX após acumular 1000+ vetores
CREATE INDEX idx_knowledge_vectors_embedding
  ON ai.knowledge_vectors
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
