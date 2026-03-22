# oute.me — Contexto para Claude

## Visão Geral
Plataforma SaaS de estimativa de projetos de software com IA.
Fluxo central: **Interview → Estimate → Project** (máquina de estados).
Repositório: `github.com/renatobardi/oute.me` | GCP Project: `oute-488706` | Domínio: `oute.pro`

## Estrutura do Monorepo

```
oute.me/
├── apps/web/           # SvelteKit 5 — BFF + frontend (porta 5173 dev)
├── apps/ai/            # FastAPI — serviço de IA (porta 8000 dev)
├── packages/ui/        # Design System @oute/ui (componentes Svelte)
├── database/
│   ├── migrations/     # SQL migrations numeradas (000–019)
│   ├── migrate.ts      # Runner de migrations
│   └── seeds/          # Seed data
├── docs/
│   ├── API.md          # Referência completa da API
│   ├── ARCHITECTURE.md # Visão geral da arquitetura
│   ├── ONBOARDING.md   # Guia de onboarding
│   ├── adr/            # ADR-11, ADR-12 (.docx)
│   ├── architecture/   # ADD_v1.0.docx e diagramas
│   └── plans/          # Planos de correção (PLAN-architecture-fixes.md)
├── scripts/            # Scripts utilitários (seed, clear-firebase, etc.)
├── tests/load/         # Testes de carga
├── infra/gcp/          # Configs GCP
├── package.json        # pnpm workspaces root (Node >=24, pnpm >=10)
└── turbo.json          # Turborepo pipeline
```

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend + BFF | SvelteKit 5 + TypeScript + Svelte 5.28 |
| Serviço de IA | FastAPI 0.115+ / Python 3.12 / uvicorn |
| LLM | Gemini 2.5 Flash via Vertex AI SDK (ADC — sem API key) |
| Embeddings | Vertex AI text-multilingual-embedding-002 (768 dims) |
| Banco | PostgreSQL 16 + pgvector (Cloud SQL) |
| Cache/State | Redis (prod: Memorystore) / PostgreSQL fallback (dev) |
| Auth | Firebase Auth (cliente) + Firebase Admin SDK (servidor) |
| Storage | GCS (prod) / local fallback (dev) |
| Orquestração IA | CrewAI 1.10.x + LiteLLM (APENAS pipeline batch) |
| Jobs assíncronos | Cloud Tasks (prod) / background asyncio (dev) |
| Monorepo | pnpm workspaces + Turborepo |
| Python pkg | uv |

---

## Regras de Arquitetura (NUNCA violar)

1. **SvelteKit é o ÚNICO gateway para PostgreSQL.** FastAPI acessa o banco somente para vetores (`ai.*`) e resultados de estimativa. Nunca para auth ou sessão.

2. **FastAPI é interno.** Todo acesso externo passa pelo BFF SvelteKit, que autentica via Firebase antes de fazer proxy.

3. **CrewAI SOMENTE no pipeline batch de estimativa.** O chat de entrevista usa Vertex AI SDK direto para manter baixa latência no SSE.

4. **Sem Docker Compose, sem VM.** Dev e prod rodam em Cloud Run (scale-to-zero).

5. **Sem Qdrant.** Busca vetorial via pgvector no PostgreSQL.

6. **Auth exclusivamente via Firebase Admin SDK** no servidor. Nunca ler/escrever sessão de auth diretamente no banco.

7. **oute.pro é o único domínio.** CNAME → `ghs.googlehosted.com`, TLS GCP.

8. **Vertex AI via ADC.** Sem GEMINI_API_KEY. Cloud Run usa Service Account automaticamente.

---

## Convenções de Código

### Geral
- `pnpm` — nunca npm ou yarn
- `turbo run build` / `turbo run lint` / `turbo run test` da raiz
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`
- Branches: `feature/nome-da-feature` → `develop` → `main`

### TypeScript (apps/web + packages/ui)
- SvelteKit 5 Runes (`$state`, `$derived`, `$effect`) — não usar stores legados
- Sem ORM — queries SQL diretas com driver `postgres`
- Tipos explícitos — sem `any`
- Path alias: `$lib` → `apps/web/src/lib`, `@oute/ui` → `packages/ui/src`

### Python (apps/ai)
- `uv` para dependências e venv
- `ruff` para lint e format
- `mypy` para type checking — sem `# type: ignore` sem justificativa
- `pydantic v2` para validação (Settings, request/response models)
- Async nativo — `async def` em todos os handlers

---

## Schemas do Banco

### Schemas PostgreSQL
- `public` — users, interviews, interview_messages, documents, estimates, estimate_runs, projects, milestones, tasks, conversation_tones, user_activation, rate_limits
- `ai` — knowledge_vectors (pgvector), job_state (Redis fallback), document_chunks, agent_instructions, agent_config
- `audit` — event_log (imutável)

### Maturity Score (gate para estimativa)
| Domínio | Peso | Vital |
|---|---|---|
| scope | 30% | Sim |
| timeline | 20% | Sim |
| budget | 20% | Sim |
| integrations | 15% | Não |
| tech_stack | 15% | Sim |

**Threshold: maturity ≥ 0.70 + aprovação explícita do usuário.**

---

## Agentes IA

### Entrevistador (conversacional — NÃO usa CrewAI)
- Vertex AI SDK direto, SSE turn-by-turn
- State em `interviews.state` (JSONB), não na sessão
- A cada turno: recebe state + histórico resumido + mensagem → atualiza domains, responses, maturity

### Pipeline de Estimativa (batch — CrewAI + Cloud Tasks)
Sequencial, ~90–130s:
1. **architecture_interviewer** — consolida requisitos técnicos
2. **rag_analyst** — busca similares via pgvector + web
3. **software_architect** — propõe arquitetura e milestones
4. **cost_specialist** — 3 cenários (conservador/moderado/otimista)
5. **reviewer** — valida consistência + sumário executivo
6. **knowledge_manager** — prepara texto para embedding no pgvector

LLM: `vertex_ai/gemini-2.5-flash-lite` (via LiteLLM + ADC)

---

## ADRs Aceitos

| ADR | Decisão |
|---|---|
| 01 | SvelteKit como BFF único |
| 02 | FastAPI: SSE conversacional + batch CrewAI |
| 03 | pgvector + Vertex AI embeddings — sem Qdrant |
| 04 | Redis com fallback PostgreSQL — sem MindsDB |
| 05 | Firebase Auth |
| 06 | GCP-only, sem VM, sem Docker Compose |
| 07 | pnpm workspaces + Turborepo |
| 08 | Domínio único: oute.pro |
| 09 | Vertex AI SDK com ADC |
| 10 | Cloud Tasks para jobs assíncronos |
| 11 | Revisão do pipeline CrewAI (ver `docs/adr/ADR-11-crewai-pipeline-review.docx`) |
| 12 | Revisão arquitetural completa — 14 findings, 3 CRITICAL (ver `docs/adr/ADR-12-revisao-arquitetural.docx`) |

---

## Findings Críticos (ADR-12)

Plano de correções: `docs/plans/PLAN-architecture-fixes.md`

- **F-01 CRITICAL**: RAG self-contamination — knowledge_manager embeda sem validação de qualidade
- **F-02 CRITICAL**: State analysis sem ground truth — maturity scoring via LLM sem baseline determinístico
- **F-03 CRITICAL**: Redis race condition — estado de jobs sem lock distribuído

---

## Referências Rápidas

- **API completa**: `docs/API.md`
- **Arquitetura**: `docs/ARCHITECTURE.md`
- **Onboarding**: `docs/ONBOARDING.md`
- **Config/env vars**: `apps/ai/src/config.py` (classe `Settings`)
- **Agents YAML**: `apps/ai/src/crew/agents.yaml`
- **Tasks YAML**: `apps/ai/src/crew/tasks.yaml`
- **Theme tokens**: `packages/ui/src/theme/theme.css`

## Design System (@oute/ui)

Componentes: `Button`, `SectionHeader`, `StatusBadge`, `ProgressBar`, `MetricDisplay`, `ChatBubble`, `DocumentCard`, `MaturityBar`

## Migrations

20 migrations (000–019): extensions, schemas, users, interviews, interview_state, estimates, knowledge_vectors, projects, job_state, audit_log, conversation_tones, user_activation, admin_knowledge, agent_instructions, estimate_agent_steps, estimate_runs, agent_config, document_file_hash, rate_limits.
