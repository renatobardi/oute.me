-- Bootstrap: tabela de controle de migrations
-- Executada automaticamente pelo runner antes de qualquer migration.
-- Idempotente: pode ser aplicada múltiplas vezes sem efeito colateral.

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version    TEXT        PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum   TEXT        NOT NULL
);
