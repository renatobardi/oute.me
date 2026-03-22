# oute.me

Plataforma SaaS de estimativa de projetos de software com IA. O fluxo central segue a máquina de estados **Interview → Estimate → Project**: uma entrevista conversacional coleta requisitos, um pipeline de 6 agentes IA gera a estimativa, e o resultado vira um projeto estruturado com milestones e tarefas.

**Domínio**: [oute.pro](https://oute.pro) | **GCP Project**: `oute-488706`

---

## Quick Start (dev)

### Pré-requisitos

- Node.js ≥ 24.0.0
- pnpm ≥ 10.0.0
- Python ≥ 3.12 + [uv](https://docs.astral.sh/uv/)
- PostgreSQL 16 com pgvector (via Cloud SQL Auth Proxy ou local)
- GCP CLI autenticado (`gcloud auth application-default login`)

### 1. Clonar e instalar dependências

```bash
git clone git@github.com:renatobardi/oute.me.git
cd oute.me

# TypeScript (monorepo)
pnpm install

# Python (AI service)
cd apps/ai && uv sync && cd ../..
```

### 2. Configurar variáveis de ambiente

```bash
# apps/web/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/oute_develop
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
AI_SERVICE_URL=http://localhost:8000
PUBLIC_FIREBASE_API_KEY=...
PUBLIC_FIREBASE_AUTH_DOMAIN=...

# apps/ai/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/oute_develop
GCP_PROJECT=oute-488706
GCP_LOCATION=us-central1
ENVIRONMENT=development
# REDIS_URL omitido → fallback para PostgreSQL
# CLOUD_TASKS_QUEUE omitido → fallback para asyncio background task
```

### 3. Rodar migrations e iniciar dev

```bash
pnpm migrate          # aplica migrations no banco
pnpm dev              # inicia web (5173) + ai (8000) via Turborepo
```

---

## Estrutura do Monorepo

```
oute.me/
├── apps/
│   ├── web/           # SvelteKit 5 — BFF + frontend (porta 5173)
│   └── ai/            # FastAPI — serviço de IA (porta 8000)
├── packages/
│   └── ui/            # Design System @oute/ui (Svelte 5)
├── database/
│   └── migrations/    # 20 SQL migrations numeradas (000–019)
├── docs/
│   ├── adr/           # Architecture Decision Records
│   ├── architecture/  # ADD + diagramas
│   └── plans/         # Planos de implementação
├── infra/
│   └── gcp/           # Scripts de setup GCP
├── tests/
│   └── load/          # Testes de carga k6
├── scripts/           # Utilitários (seed, cleanup)
├── .github/workflows/ # CI/CD (7 workflows)
├── package.json       # pnpm workspaces root
└── turbo.json         # Turborepo pipeline
```

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend + BFF | SvelteKit 5 + TypeScript (Svelte 5 Runes) |
| Serviço de IA | FastAPI 0.115 + Python 3.12 |
| LLM | Gemini 2.5 Flash via Vertex AI SDK (ADC) |
| Embeddings | text-multilingual-embedding-002 (768 dims) |
| Banco | PostgreSQL 16 + pgvector (Cloud SQL) |
| Cache/State | Redis (prod) / PostgreSQL fallback (dev) |
| Auth | Firebase Auth + Firebase Admin SDK |
| Storage | Google Cloud Storage / local fallback |
| Orquestração IA | CrewAI 1.10.1 (somente pipeline batch) |
| Monorepo | pnpm 10 + Turborepo |
| Python pkg | uv |

---

## Scripts Principais

```bash
pnpm dev              # Inicia todos os serviços em dev
pnpm build            # Build de produção
pnpm lint             # Lint TypeScript + Svelte
pnpm lint:py          # Lint Python (ruff)
pnpm format           # Format TypeScript
pnpm format:py        # Format Python (ruff)
pnpm test             # Testes TypeScript (vitest)
pnpm test:py          # Testes Python (pytest)
pnpm check            # Type check Svelte
pnpm typecheck:py     # Type check Python (mypy)
pnpm migrate          # Rodar migrations
pnpm migrate:status   # Ver status das migrations
pnpm migrate:dry      # Dry-run de migrations
```

---

## Documentação

| Documento | Descrição |
|---|---|
| [docs/API.md](docs/API.md) | Referência completa de endpoints (BFF + AI service) |
| [docs/ONBOARDING.md](docs/ONBOARDING.md) | Guia de setup do ambiente e tarefas comuns |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Visão arquitetural, data flows e decisões |
| [docs/architecture/ADD_v1.0.docx](docs/architecture/ADD_v1.0.docx) | Architecture Design Document formal |
| [docs/adr/](docs/adr/) | Architecture Decision Records (ADR-01 a ADR-12) |
| [docs/plans/](docs/plans/) | Planos de implementação e correções |

---

## Convenções

**Git**: Conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`). Branches: `feature/nome` → `develop` → `main`.

**TypeScript**: SvelteKit 5 Runes (`$state`, `$derived`, `$effect`). Sem ORM — SQL direto. Sem `any`. Path aliases: `$lib`, `@oute/ui`.

**Python**: `uv` para deps. `ruff` para lint/format. `mypy` strict. `pydantic v2` para validação. `async def` em todos os handlers.

---

## CI/CD

GitHub Actions com 7 workflows: PR checks, deploy dev (push `develop`), deploy prod (push `main`), migrations dev/prod, security scan, dependency check. Deploy targets: GCP Cloud Run (scale-to-zero).

---

## Licença

Proprietário. Todos os direitos reservados.
