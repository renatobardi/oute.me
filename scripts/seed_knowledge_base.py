"""
seed_knowledge_base.py
======================
Script de seed do knowledge base do oute.me.

Lê v4-effort-model.json, gera embeddings via Gemini text-embedding-004
e insere em ai.knowledge_vectors (pgvector).

COMO USAR:
  # 1. Instalar dependências
  uv pip install google-generativeai asyncpg python-dotenv

  # 2. Setar variáveis de ambiente
  export DATABASE_URL=postgresql://...
  export GEMINI_API_KEY=...

  # 3. Rodar
  python seed_knowledge_base.py --dry-run        # valida sem inserir
  python seed_knowledge_base.py                  # insere tudo
  python seed_knowledge_base.py --milestone M6   # insere apenas M6
  python seed_knowledge_base.py --clear          # limpa seeds anteriores e reinsere

ONDE ISSO É USADO NA ARQUITETURA:
  apps/ai/src/crew/agents → RAG Analyst busca ai.knowledge_vectors
  apps/ai/src/services/vector_store.py → cosine similarity search
  Embedding model: Gemini text-embedding-004 (768 dims) — DEVE ser o mesmo do production
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Namespace UUID para geração de source_id determinístico (UUID v5)
_OUTE_SEED_NAMESPACE = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")  # DNS namespace


def _issue_id_to_uuid(issue_id: str) -> uuid.UUID:
    """Converte um issue_id textual em UUID v5 determinístico.
    Garante que o mesmo issue_id sempre gera o mesmo UUID — safe para rerun."""
    return uuid.uuid5(_OUTE_SEED_NAMESPACE, f"oute.effort_model.{issue_id}")

import asyncpg
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
EMBEDDING_MODEL = "models/text-embedding-004"  # 768 dims — igual ao production
EMBEDDING_TASK_TYPE = "RETRIEVAL_DOCUMENT"
SEED_SOURCE_TYPE = "effort_model"   # source_type na tabela ai.knowledge_vectors
EFFORT_MODEL_PATH = Path(__file__).parent / "v4-effort-model.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("seed")

# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class KnowledgeChunk:
    """
    Um chunk do effort model pronto para ser embedded e inserido.
    Corresponde a uma linha em ai.knowledge_vectors.

    Schema real da tabela (migration 007_knowledge_vectors.sql):
      source_type TEXT NOT NULL   → sempre "effort_model" para seeds
      source_id   UUID NOT NULL   → UUID v5 determinístico gerado a partir do issue_id
      content     TEXT NOT NULL   → texto que será embedded
      embedding   vector(768)     → gerado pelo Gemini text-embedding-004
      metadata    JSONB           → milestone, tags, roles, horas, etc.
    """
    issue_id: str      # ex: "M1.E1.I1" — usado para gerar source_id UUID
    content: str       # texto que será embedded
    metadata: dict     # JSONB — milestone, tags, roles, horas, etc.
    source_type: str = SEED_SOURCE_TYPE


# ---------------------------------------------------------------------------
# Chunking strategy
# ---------------------------------------------------------------------------


def build_chunks(model: dict) -> list[KnowledgeChunk]:
    """
    Transforma o effort model em chunks semânticos.

    Estratégia de chunking:
    - 1 chunk por ISSUE (não por milestone, não por sub-item isolado)
    - Cada chunk inclui: contexto do milestone + nome da issue + drivers de variação
    - Isso dá ao RAG Analyst o nível correto de granularidade para busca

    Por que não chunks por milestone?
      → Muito genérico: "M1 leva 96h" não ajuda a calibrar issues específicas

    Por que não chunks por sub-item?
      → Muito fragmentado: perde contexto de dependência entre sub-issues
    """
    chunks: list[KnowledgeChunk] = []

    for milestone in model["milestones"]:
        m_id = milestone["id"]
        m_name = milestone["name"]
        m_objective = milestone.get("objective", "")
        m_tags = milestone.get("tags", [])

        for epic in milestone.get("epics", []):
            e_name = epic["name"]

            for issue in epic.get("issues", []):
                i_id = issue["id"]
                i_name = issue["name"]
                i_tags = issue.get("tags", [])
                i_roles = issue.get("primary_roles", [])
                i_drivers = issue.get("estimation_drivers", [])
                i_effort = issue.get("effort_hours", {})
                i_deps = issue.get("blocked_by", [])
                i_parallel = issue.get("can_parallelize_with", [])

                # Sub-items são incluídos no texto do chunk pai (não chunks separados)
                sub_items_text = ""
                for sub in issue.get("sub_items", []):
                    sub_drivers = sub.get("estimation_drivers", [])
                    sub_effort = sub.get("effort_hours", {})
                    startup_typical = sub_effort.get("startup", {}).get("typical", 0)
                    enterprise_typical = sub_effort.get("enterprise", {}).get("typical", 0)
                    sub_items_text += (
                        f"\n  Sub-task: {sub['name']}"
                        f" (startup: {startup_typical}h típico, enterprise: {enterprise_typical}h típico)"
                    )
                    if sub_drivers:
                        sub_items_text += f"\n  Drivers: {'; '.join(sub_drivers)}"

                # Monta texto do chunk — otimizado para busca semântica
                startup_hours = i_effort.get("startup", {})
                enterprise_hours = i_effort.get("enterprise", {})
                startup_note = startup_hours.get("note", "")

                startup_str = (
                    startup_note if startup_note
                    else f"min {startup_hours.get('min', 0)}h / típico {startup_hours.get('typical', 0)}h / max {startup_hours.get('max', 0)}h"
                )
                enterprise_str = (
                    f"min {enterprise_hours.get('min', 0)}h / típico {enterprise_hours.get('typical', 0)}h / max {enterprise_hours.get('max', 0)}h"
                )

                drivers_str = "\n- ".join(i_drivers) if i_drivers else "Sem drivers específicos documentados"
                roles_str = ", ".join(i_roles) if i_roles else "não especificados"
                deps_str = ", ".join(i_deps) if i_deps else "nenhuma"
                parallel_str = ", ".join(i_parallel) if i_parallel else "nenhuma"

                content = f"""Milestone: {m_id} — {m_name}
Objetivo: {m_objective}
Epic: {e_name}
Issue: {i_id} — {i_name}
Tags de aplicabilidade: {', '.join(i_tags)}
Roles responsáveis: {roles_str}

Esforço estimado:
  Startup: {startup_str}
  Enterprise: {enterprise_str}

Multiplicador de senioridade:
  Junior: ×1.6 | Mid: ×1.0 | Senior: ×0.65

Depende de: {deps_str}
Pode paralelizar com: {parallel_str}

Principais drivers de variação de esforço:
- {drivers_str}{sub_items_text}
"""

                metadata = {
                    "milestone_id": m_id,
                    "milestone_name": m_name,
                    "epic_name": e_name,
                    "issue_id": i_id,
                    "issue_name": i_name,
                    "tags": i_tags,
                    "milestone_tags": m_tags,
                    "roles": i_roles,
                    "effort_startup_typical": startup_hours.get("typical"),
                    "effort_enterprise_typical": enterprise_hours.get("typical"),
                    "blocked_by": i_deps,
                    "can_parallelize_with": i_parallel,
                    "seed_source": SEED_SOURCE_TYPE,
                }

                chunks.append(KnowledgeChunk(
                    issue_id=i_id,
                    content=content.strip(),
                    metadata=metadata,
                ))

    return chunks


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------


def generate_embeddings(chunks: list[KnowledgeChunk]) -> list[tuple[KnowledgeChunk, list[float]]]:
    """
    Gera embeddings para todos os chunks usando Gemini text-embedding-004.

    IMPORTANTE: usa RETRIEVAL_DOCUMENT como task_type (não SEMANTIC_SIMILARITY).
    Isso otimiza para busca RAG — os queries de busca devem usar RETRIEVAL_QUERY.
    """
    genai.configure(api_key=GEMINI_API_KEY)

    results: list[tuple[KnowledgeChunk, list[float]]] = []
    total = len(chunks)

    for i, chunk in enumerate(chunks):
        log.info(f"[{i+1}/{total}] Gerando embedding para {chunk.chunk_id}...")
        try:
            response = genai.embed_content(
                model=EMBEDDING_MODEL,
                content=chunk.content,
                task_type=EMBEDDING_TASK_TYPE,
            )
            embedding: list[float] = response["embedding"]
            assert len(embedding) == 768, f"Esperado 768 dims, got {len(embedding)}"
            results.append((chunk, embedding))
        except Exception as e:
            log.error(f"Falha ao gerar embedding para {chunk.chunk_id}: {e}")
            raise

    return results


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------


async def insert_chunks(
    conn: asyncpg.Connection,
    embedded_chunks: list[tuple[KnowledgeChunk, list[float]]],
    dry_run: bool = False,
) -> int:
    """
    Insere os chunks em ai.knowledge_vectors.

    Schema esperado (migration 007_knowledge_vectors.sql):
      CREATE TABLE ai.knowledge_vectors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chunk_id TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding vector(768) NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        source_tag TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX ON ai.knowledge_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

    Usa UPSERT por chunk_id — safe para rerun.
    """
    if dry_run:
        log.info(f"[DRY RUN] Seriam inseridos {len(embedded_chunks)} chunks. Nenhuma escrita feita.")
        return 0

    inserted = 0
    for chunk, embedding in embedded_chunks:
        source_id = _issue_id_to_uuid(chunk.issue_id)
        embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
        metadata_json = json.dumps(chunk.metadata, ensure_ascii=False)

        # Schema real: source_type, source_id, content, embedding, metadata
        # Sem UNIQUE constraint na tabela — usamos DELETE + INSERT para idempotência
        await conn.execute(
            """
            DELETE FROM ai.knowledge_vectors
            WHERE source_type = $1 AND source_id = $2
            """,
            chunk.source_type,
            source_id,
        )
        await conn.execute(
            """
            INSERT INTO ai.knowledge_vectors (source_type, source_id, content, embedding, metadata)
            VALUES ($1, $2, $3, $4::vector, $5::jsonb)
            """,
            chunk.source_type,
            source_id,
            chunk.content,
            embedding_str,
            metadata_json,
        )
        inserted += 1
        log.info(f"  ✓ {chunk.issue_id} → source_id={source_id} inserido")

    return inserted


async def clear_seed_data(conn: asyncpg.Connection) -> int:
    """Remove todos os registros com source_type = SEED_SOURCE_TYPE."""
    result = await conn.execute(
        "DELETE FROM ai.knowledge_vectors WHERE source_type = $1",
        SEED_SOURCE_TYPE,
    )
    count = int(result.split()[-1])
    log.info(f"Removidos {count} registros com source_type='{SEED_SOURCE_TYPE}'")
    return count


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def validate_env() -> list[str]:
    errors = []
    if not GEMINI_API_KEY:
        errors.append("GEMINI_API_KEY não definida")
    if not DATABASE_URL:
        errors.append("DATABASE_URL não definida")
    if not EFFORT_MODEL_PATH.exists():
        errors.append(f"Arquivo não encontrado: {EFFORT_MODEL_PATH}")
    return errors


def validate_model(model: dict) -> list[str]:
    """Validações básicas de integridade do effort model."""
    warnings = []
    for milestone in model["milestones"]:
        for epic in milestone.get("epics", []):
            for issue in epic.get("issues", []):
                effort = issue.get("effort_hours", {})
                startup = effort.get("startup", {})
                if not startup.get("note") and startup.get("typical", -1) == 0 and startup.get("max", -1) == 0:
                    warnings.append(
                        f"Issue {issue['id']} tem esforço startup=0 mas sem 'note' explicando. "
                        "Verifique se é intencional (skip) ou dado faltando."
                    )
    return warnings


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed do knowledge base do oute.me (ai.knowledge_vectors)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Valida e gera embeddings mas não escreve no banco",
    )
    parser.add_argument(
        "--milestone",
        type=str,
        default=None,
        help="Inserir apenas issues de um milestone específico (ex: M6)",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Remove seeds anteriores antes de reinserir",
    )
    parser.add_argument(
        "--model-path",
        type=str,
        default=str(EFFORT_MODEL_PATH),
        help=f"Caminho para v4-effort-model.json (default: {EFFORT_MODEL_PATH})",
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def main(args: argparse.Namespace) -> None:
    # --- Validação de ambiente ---
    errors = validate_env()
    if errors:
        for e in errors:
            log.error(f"Config error: {e}")
        sys.exit(1)

    # --- Carregar modelo ---
    model_path = Path(args.model_path)
    log.info(f"Carregando effort model: {model_path}")
    with open(model_path, encoding="utf-8") as f:
        model: dict[str, Any] = json.load(f)
    log.info(f"Modelo carregado: {len(model['milestones'])} milestones")

    # --- Validar modelo ---
    warnings = validate_model(model)
    for w in warnings:
        log.warning(w)

    # --- Build chunks ---
    all_chunks = build_chunks(model)
    log.info(f"Chunks gerados: {len(all_chunks)}")

    # --- Filtrar por milestone se especificado ---
    if args.milestone:
        chunks = [c for c in all_chunks if c.metadata["milestone_id"] == args.milestone]
        log.info(f"Filtrado para milestone {args.milestone}: {len(chunks)} chunks")
        if not chunks:
            log.error(f"Nenhum chunk encontrado para milestone '{args.milestone}'")
            log.info(f"Milestones disponíveis: {sorted(set(c.metadata['milestone_id'] for c in all_chunks))}")
            sys.exit(1)
    else:
        chunks = all_chunks

    # --- Preview no dry-run ---
    if args.dry_run:
        log.info("=== DRY RUN — preview dos primeiros 3 chunks ===")
        for chunk in chunks[:3]:
            print(f"\n--- {chunk.issue_id} ---")
            print(chunk.content[:400] + "...")
            print(f"Metadata keys: {list(chunk.metadata.keys())}")
        log.info(f"Total que seria inserido: {len(chunks)} chunks")

    # --- Gerar embeddings ---
    log.info(f"Gerando embeddings (modelo: {EMBEDDING_MODEL})...")
    embedded = generate_embeddings(chunks)
    log.info(f"Embeddings gerados: {len(embedded)}")

    if args.dry_run:
        log.info("[DRY RUN] Embeddings gerados com sucesso. Nenhum dado escrito no banco.")
        return

    # --- Conectar ao banco e inserir ---
    log.info("Conectando ao banco...")
    conn = await asyncpg.connect(DATABASE_URL)

    try:
        if args.clear:
            log.info("--clear ativado: removendo seeds anteriores...")
            await clear_seed_data(conn)

        log.info("Inserindo chunks em ai.knowledge_vectors...")
        inserted = await insert_chunks(conn, embedded, dry_run=False)
        log.info(f"✅ Seed concluído: {inserted} chunks inseridos/atualizados")

        # --- Verificar count final ---
        total_in_db = await conn.fetchval(
            "SELECT COUNT(*) FROM ai.knowledge_vectors WHERE source_type = $1",
            SEED_SOURCE_TYPE,
        )
        log.info(f"Total com source_type='{SEED_SOURCE_TYPE}' no banco: {total_in_db}")

    finally:
        await conn.close()


if __name__ == "__main__":
    args = parse_args()
    asyncio.run(main(args))
