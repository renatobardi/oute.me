# Guia de Onboarding — oute.me

Guia para setup do ambiente de desenvolvimento e referência de tarefas comuns. Foco em voltar a contribuir rapidamente após um período afastado.

---

## 1. Pré-requisitos

| Ferramenta | Versão mínima | Instalação |
|---|---|---|
| Node.js | ≥ 24.0.0 | [nodejs.org](https://nodejs.org) ou `nvm install 24` |
| pnpm | ≥ 10.0.0 | `corepack enable && corepack prepare pnpm@latest --activate` |
| Python | ≥ 3.12 | [python.org](https://python.org) ou `pyenv install 3.12` |
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| gcloud CLI | latest | [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install) |
| Cloud SQL Auth Proxy | latest | `gcloud components install cloud-sql-proxy` |

---

## 2. Setup Inicial

### 2.1 Clone e dependências

```bash
git clone git@github.com:renatobardi/oute.me.git
cd oute.me

# TypeScript (web + ui)
pnpm install

# Python (ai service)
cd apps/ai
uv sync          # cria venv + instala deps
uv sync --dev    # inclui ferramentas de dev (pytest, ruff, mypy)
cd ../..
```

### 2.2 Autenticação GCP

O projeto usa Application Default Credentials (ADC) — sem API keys para Vertex AI.

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project oute-488706
```

### 2.3 Banco de dados (Cloud SQL Auth Proxy)

Para apontar para o banco Cloud SQL do ambiente dev:

```bash
# Terminal separado — manter rodando
cloud-sql-proxy oute-488706:us-central1:oute-develop --port=5432
```

Ou usar uma instância PostgreSQL local (16+) com pgvector:

```bash
# Instalar pgvector (macOS)
brew install pgvector

# Criar banco
createdb oute_develop
psql oute_develop -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql oute_develop -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

### 2.4 Variáveis de ambiente

Copiar os templates e ajustar:

```bash
# apps/web/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/oute_develop
FIREBASE_PROJECT_ID=<do Firebase Console>
FIREBASE_PRIVATE_KEY=<do Firebase Console>
FIREBASE_CLIENT_EMAIL=<do Firebase Console>
AI_SERVICE_URL=http://localhost:8000
PUBLIC_FIREBASE_API_KEY=<do Firebase Console>
PUBLIC_FIREBASE_AUTH_DOMAIN=<do Firebase Console>

# apps/ai/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/oute_develop
GCP_PROJECT=oute-488706
GCP_LOCATION=us-central1
ENVIRONMENT=development
```

Variáveis opcionais em dev (fallbacks automáticos se ausentes):

- `REDIS_URL` → fallback para tabela `ai.job_state` no PostgreSQL
- `CLOUD_TASKS_QUEUE` → fallback para `asyncio` background task
- `GOOGLE_CLOUD_STORAGE_BUCKET` → fallback para `./data/uploads` local
- `DOCUMENT_AI_PROCESSOR_ID` → fallback para PyMuPDF/python-docx

### 2.5 Migrations

```bash
pnpm migrate          # aplica todas as pendentes
pnpm migrate:status   # ver quais já rodaram
pnpm migrate:dry      # simula sem aplicar
```

São 20 migrations (000–019) em `database/migrations/`. O runner (`database/migrate.ts`) usa checksums SHA256 para detectar alterações em migrations já aplicadas.

### 2.6 Iniciar serviços

```bash
pnpm dev    # Turborepo inicia web (5173) + ai (8000) em paralelo
```

Ou individualmente:

```bash
# Terminal 1 — web
cd apps/web && pnpm dev

# Terminal 2 — ai
cd apps/ai && uv run uvicorn src.main:app --reload --port 8000
```

---

## 3. Como os Sistemas se Conectam

```
Browser → SvelteKit BFF (5173) → [Auth Firebase] → PostgreSQL
                                                  → FastAPI AI (8000) → Vertex AI
                                                                      → pgvector
                                                                      → Redis/PG state
```

O SvelteKit é o único ponto de entrada. O FastAPI nunca é acessado diretamente pelo browser.

Fluxo de uma mensagem de chat:
1. Browser envia POST `/api/chat/[id]/message` com token Firebase
2. BFF valida auth, carrega interview + mensagens + documentos do PostgreSQL
3. BFF monta `ChatRequest` e faz proxy SSE para FastAPI `/chat/message`
4. FastAPI chama Vertex AI (Gemini) via streaming, analisa state, retorna SSE events
5. BFF parseia events em tempo real, persiste mensagem + state no banco, repassa stream

Fluxo de uma estimativa:
1. Usuário solicita (maturity ≥ 0.70) → `POST /api/estimates` → status `pending_approval`
2. Admin aprova → `POST /api/estimates/[id]/approve` → BFF chama FastAPI `/estimate/run`
3. FastAPI cria job no state backend, enfileira Cloud Tasks (prod) / asyncio (dev)
4. Cloud Tasks chama `/estimate/execute` → CrewAI roda 6 agentes sequencialmente
5. Frontend faz polling em `GET /api/estimates/[id]` a cada 5s até `done`

---

## 4. Tarefas Comuns

### Adicionar uma nova migration

```bash
# Criar arquivo SQL numerado
touch database/migrations/020_descricao.sql
# Editar com DDL
# Aplicar
pnpm migrate
```

### Adicionar novo componente ao Design System

1. Criar `packages/ui/src/lib/components/MeuComponente.svelte`
2. Exportar em `packages/ui/src/lib/index.ts`
3. Usar em `apps/web`: `import { MeuComponente } from '@oute/ui'`

### Adicionar novo endpoint BFF

1. Criar `apps/web/src/routes/api/meu-endpoint/+server.ts`
2. Usar `requireAuth(locals)` para proteger
3. Usar funções de `$lib/server/` para lógica de banco

### Adicionar novo router no FastAPI

1. Criar `apps/ai/src/routers/meu_router.py` com `router = APIRouter()`
2. Registrar em `apps/ai/src/main.py`: `app.include_router(router, prefix="/meu-router")`
3. Adicionar proxy no BFF se necessário

### Rodar linters e type checkers

```bash
# Tudo de uma vez
pnpm lint && pnpm lint:py && pnpm check && pnpm typecheck:py

# Python individual
cd apps/ai
uv run ruff check src/ tests/    # lint
uv run ruff format src/ tests/   # format
uv run mypy src/                 # type check
uv run pytest                    # testes
```

### Seed da base de conhecimento

```bash
cd scripts
python seed_knowledge_base.py
```

### Deploy

Automático via GitHub Actions:
- Push para `develop` → deploy dev
- Push para `main` → deploy prod

Manual (se necessário):
```bash
# Web
cd apps/web && pnpm build
gcloud run deploy oute-web-dev --source=.

# AI
cd apps/ai
gcloud run deploy oute-ai-dev --source=.
```

---

## 5. Estrutura de Arquivos-Chave

### apps/web

| Arquivo | Função |
|---|---|
| `src/hooks.server.ts` | Middleware chain: redirect, rate limit, auth, gates, headers |
| `src/lib/server/auth.ts` | Validação Firebase Admin SDK |
| `src/lib/server/db.ts` | Pool de conexão PostgreSQL |
| `src/lib/server/ai-client.ts` | Proxy HTTP/SSE para FastAPI |
| `src/lib/server/interviews.ts` | CRUD de entrevistas |
| `src/lib/server/estimates.ts` | CRUD de estimativas |
| `src/lib/server/projects.ts` | CRUD de projetos + milestones + tasks |
| `src/lib/stores/chat.svelte.ts` | State reativo do chat (SSE + maturity + docs) |
| `src/lib/types/` | Tipos TypeScript (interview, estimate, project) |

### apps/ai

| Arquivo | Função |
|---|---|
| `src/main.py` | App FastAPI + middleware + lifespan |
| `src/config.py` | Pydantic Settings (env vars) |
| `src/services/interviewer.py` | Lógica do entrevistador (SSE streaming) |
| `src/services/state_analyzer.py` | Maturity scoring via LLM |
| `src/services/estimate_runner.py` | Execução do pipeline + Cloud Tasks |
| `src/services/state.py` | State backend (Redis / PostgreSQL) |
| `src/services/vector_store.py` | pgvector store + search |
| `src/services/prompts.py` | System prompts |
| `src/crew/estimate_crew.py` | Orquestração CrewAI 6 agentes |
| `src/crew/tools.py` | VectorSearchTool, WebSearchTool |
| `src/models/interview.py` | ChatRequest, InterviewState, maturity calc |
| `src/models/estimate.py` | EstimateResult + per-agent models + auto-correção |

---

## 6. Troubleshooting

**"Vertex AI health check failed"**: Rodar `gcloud auth application-default login`. Verificar que `GCP_PROJECT` e `GCP_LOCATION` estão setados.

**"PostgreSQL health check failed"**: Verificar `DATABASE_URL`. Se usando Cloud SQL Proxy, garantir que está rodando.

**"Interview maturity must be at least 0.70"**: A entrevista precisa de mais respostas. Verificar `state.domains` — todos os vitals precisam de `vital_answered: true`.

**Migration checksum mismatch**: Alguém editou uma migration já aplicada. Verificar `database/schema_migrations` no banco.

**"No response from AI service"**: FastAPI não está rodando ou `AI_SERVICE_URL` está errado.

**Rate limit (429)**: Aguardar. Em dev, pode ajustar limites em `rate-limit.ts`.
