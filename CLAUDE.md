# oute.me — Contexto para Claude Code

## Visão Geral do Projeto
Plataforma SaaS de estimativa de projetos de software com IA.
Fluxo central: **Interview → Estimate → Project** (máquina de estados).
Repositório: `github.com/renatobardi/oute.me` | GCP Project: `oute-488706`

---

## Estrutura do Monorepo

```
oute.me/
├── apps/
│   ├── web/           # SvelteKit 5 — BFF + frontend (porta 5173 dev)
│   └── ai/            # FastAPI — serviço de IA (porta 8000 dev)
├── packages/
│   └── ui/            # Design System @oute/ui (componentes Svelte)
├── database/
│   └── migrations/    # SQL migrations numeradas: 001_extensions.sql, 002_...
├── docs/
│   ├── adr/           # Architecture Decision Records (ADR-01 a ADR-08)
│   └── architecture/  # ADD_v1.0.docx e diagramas
├── infra/
│   └── gcp/           # Scripts de setup e configs GCP
├── package.json       # pnpm workspaces root
└── turbo.json         # Turborepo pipeline
```

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend + BFF | SvelteKit 5 + TypeScript |
| Serviço de IA | FastAPI 0.115.x + Python 3.12 |
| LLM | Gemini 2.5 Flash via Vertex AI SDK (ADC — sem API key) |
| Embeddings | Vertex AI text-multilingual-embedding-002 (768 dims) |
| Banco principal | PostgreSQL 16 + pgvector (Cloud SQL, oute-488706) |
| Vetores | pgvector — tabela `ai.knowledge_vectors` |
| Cache/State | Redis (prod: Memorystore) / PostgreSQL fallback (dev) |
| Auth | Firebase Auth (cliente) + Firebase Admin SDK (servidor) |
| Storage | Google Cloud Storage (prod) / local fallback (dev) |
| Orquestração IA | CrewAI 1.10.1 — APENAS para pipeline batch de estimativa |
| Monorepo | pnpm workspaces + Turborepo |
| Package manager Python | uv |

---

## Regras de Arquitetura (NUNCA violar)

1. **SvelteKit é o ÚNICO ponto de acesso ao PostgreSQL.** O FastAPI não acessa o banco diretamente para autenticação ou sessão — somente para leitura de vetores e escrita de resultados de estimativa.

2. **FastAPI não tem endpoints públicos.** Todo acesso externo passa pelo BFF SvelteKit, que autentica o token Firebase antes de fazer proxy para o AI service.

3. **CrewAI SOMENTE no pipeline batch de estimativa.** O chat de entrevista usa Vertex AI SDK diretamente (sem CrewAI) para manter baixa latência no streaming SSE.

4. **Sem Docker Compose, sem VM.** Ambiente de dev é GCP Cloud Run (scale-to-zero). Optional: Cloud SQL Auth Proxy para quem quiser rodar apps localmente apontando para o banco dev.

5. **Sem Qdrant.** Busca vetorial via pgvector no PostgreSQL existente.

6. **Sem MindsDB.** Estado de jobs via Redis (prod) ou tabela `ai.job_state` (dev fallback).

7. **Auth exclusivamente via Firebase Admin SDK** no servidor. Nunca ler/escrever sessão de auth diretamente no banco.

8. **oute.pro é o único domínio ativo.** Não há redirect de outros domínios.

---

## Convenções de Código

### Geral
- `pnpm` — nunca npm ou yarn
- `turbo run build` / `turbo run lint` / `turbo run test` da raiz
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`
- Branches: `feature/nome-da-feature` → `develop` → `main`

### TypeScript (apps/web + packages/ui)
- SvelteKit 5 Runes (`$state`, `$derived`, `$effect`) — não usar stores legados
- Sem ORM — queries SQL diretas com o driver `postgres` ou `pg`
- Tipos explícitos — sem `any`
- Path alias: `$lib` → `apps/web/src/lib`, `@oute/ui` → `packages/ui/src`

### Python (apps/ai)
- `uv` para gerenciamento de dependências e venv
- `ruff` para lint e format (substitui flake8/black/isort)
- `mypy` para type checking — sem `# type: ignore` sem justificativa
- `pydantic v2` para validação de dados (Settings, request/response models)
- Async nativo — `async def` em todos os handlers FastAPI

---

## Schemas do Banco (referência rápida)

### Schemas PostgreSQL
- `public` — users, interviews, estimates, projects, milestones
- `ai` — knowledge_vectors (pgvector), job_state (Redis fallback), document_chunks
- `audit` — event_log (imutável)

### interviews.state (JSONB)
```json
{
  "project_type": "new",
  "setup_confirmed": false,
  "domains": {
    "scope":        { "answered": 3, "total": 8, "vital_answered": true },
    "timeline":     { "answered": 2, "total": 5, "vital_answered": false },
    "budget":       { "answered": 1, "total": 4, "vital_answered": false },
    "integrations": { "answered": 0, "total": 6, "vital_answered": false },
    "tech_stack":   { "answered": 2, "total": 5, "vital_answered": true }
  },
  "responses": {
    "q_scope_001": { "value": "...", "source": "user", "confirmed": true }
  },
  "open_questions": ["q_budget_001"],
  "documents_processed": ["doc-uuid-1"],
  "conversation_summary": "...",
  "last_questions_asked": ["q_scope_003"]
}
```

### Maturity Score (pesos por domínio)
| Domínio | Peso | Vital obrigatório |
|---|---|---|
| scope | 30% | Sim |
| timeline | 20% | Sim |
| budget | 20% | Sim |
| integrations | 15% | Não |
| tech_stack | 15% | Sim |

**Threshold para iniciar estimativa: maturity ≥ 0.70 + aprovação explícita do usuário.**

---

## API — Endpoints Principais

### SvelteKit BFF (`apps/web`)
```
POST   /api/interviews              → cria entrevista
GET    /api/interviews/[id]         → detalhe + state
POST   /api/chat/[id]/message       → SSE streaming (Entrevistador)
POST   /api/chat/[id]/upload        → upload de documento
POST   /api/estimates               → inicia pipeline CrewAI
GET    /api/estimates/[id]          → status do job
POST   /api/estimates/[id]/approve  → aprova → cria project
```

### FastAPI AI Service (`apps/ai`) — interno, não exposto
```
POST   /chat/message                → SSE com resposta + novo state
POST   /chat/process-document       → extrai dados do documento
POST   /estimate/run                → enfileira job (Cloud Tasks prod / background task dev)
POST   /estimate/execute            → handler Cloud Tasks — executa pipeline CrewAI
GET    /estimate/status/[job_id]    → pending | running | done | failed
GET    /health/services             → { postgres, redis, vertex_ai }
```

### Formato SSE do chat
```
event: message_chunk
data: {"text": "...", "interview_id": "uuid"}

event: state_update
data: {"maturity": 0.45, "domains": {...}, "open_questions": [...]}

event: done
data: {"message_id": "uuid", "tokens_used": 312}
```

---

## Agentes IA

### Entrevistador (conversacional — NÃO usa CrewAI)
- Vertex AI SDK direto, SSE turn-by-turn (autenticação via ADC)
- State mantido no banco (`interviews.state`), não na sessão
- A cada turno: recebe state atual + histórico resumido + nova mensagem
- A cada turno: atualiza domains, responses, maturity, open_questions

### Pipeline de Estimativa (batch — CrewAI v1.10.1 + Cloud Tasks)
Sequencial, ~90–130s, orquestrado via Cloud Tasks em produção:
1. **Entrevistador de Arquitetura** — consolida requisitos técnicos
2. **Analista RAG** — busca estimativas similares via pgvector
3. **Arquiteto de Software** — propõe arquitetura e cronograma
4. **Especialista em Custos** — 3 cenários financeiros
5. **Revisor e Apresentador** — valida e gera sumário executivo
6. **Gestor de Conhecimento** — embeda resultado no pgvector

LLM dos agentes: `vertex_ai/gemini-2.5-flash-lite` (via LiteLLM + ADC)

Dev (sem `CLOUD_TASKS_QUEUE`): fallback para background asyncio task.

### Processamento de Documentos
| Tipo | Biblioteca |
|---|---|
| PDF | Document AI Layout Parser (se `DOCUMENT_AI_PROCESSOR_ID`) → fallback PyMuPDF |
| DOCX | Document AI Layout Parser (se `DOCUMENT_AI_PROCESSOR_ID`) → fallback python-docx |
| XLSX/CSV | openpyxl / pandas |
| PPTX | python-pptx |
| Imagem | Vertex AI Gemini Vision (multimodal) |
| URL | httpx + BeautifulSoup4 |

---

## Infraestrutura GCP

### Ambientes
| Recurso | DEV | PROD |
|---|---|---|
| Cloud Run web | 256Mi, min=0 | 512Mi, min=0 |
| Cloud Run ai | 1Gi, min=0 | 2Gi, min=0 |
| Cloud SQL | db-f1-micro, db=oute_develop | db-g1-small, db=oute_production |
| Redis | PG fallback (sem custo) | Memorystore BASIC 1GB |
| GCS | oute-dev-uploads | oute-prod-uploads |
| Custo estimado | ~$0/mês | ~$10–15/mês |

### Domínios
- `oute.pro` — domínio único, CNAME no provedor externo → `ghs.googlehosted.com`, TLS GCP

---

## Redis / State Backend (`apps/ai/src/services/state.py`)
```python
if settings.REDIS_URL:
    backend = RedisStateBackend(settings.REDIS_URL)   # prod
else:
    backend = PostgresStateBackend(settings.DATABASE_URL)  # dev fallback
```

---

## Storage Backend (`apps/ai/src/services/storage.py`)
```python
class StorageBackend(Protocol):
    async def upload(self, file: UploadFile) -> str: ...
    async def download(self, path: str) -> bytes: ...

# prod: GCSBackend      (env: GOOGLE_CLOUD_STORAGE_BUCKET=oute-prod-uploads)
# dev:  LocalBackend    (env: STORAGE_LOCAL_PATH=./data/uploads)
```

---

## Variáveis de Ambiente

### apps/web
```
DATABASE_URL=postgresql://...
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
AI_SERVICE_URL=https://oute-ai-[env]-[hash].run.app
PUBLIC_FIREBASE_API_KEY=...
PUBLIC_FIREBASE_AUTH_DOMAIN=...
```

### apps/ai
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...                    # opcional — fallback para PG se ausente
GOOGLE_CLOUD_STORAGE_BUCKET=oute-[env]-uploads
STORAGE_LOCAL_PATH=./data/uploads        # apenas se não usar GCS
ENVIRONMENT=development|production

# Vertex AI — autenticação via ADC (Application Default Credentials)
# Sem GEMINI_API_KEY. Cloud Run usa o Service Account do serviço automaticamente.
GCP_PROJECT=oute-488706
GCP_LOCATION=us-central1

# Cloud Tasks — pipeline de estimativa (prod)
# Se ausente: fallback para background asyncio task (dev)
CLOUD_TASKS_QUEUE=estimate-pipeline
AI_SERVICE_URL=https://oute-ai-[env]-[hash].run.app

# Document AI Layout Parser — processamento avançado de PDF/DOCX (opcional)
# Se ausente: fallback para PyMuPDF / python-docx
DOCUMENT_AI_PROCESSOR_ID=...
```

---

## Fases de Implementação

| Fase | Escopo | Critério de conclusão |
|---|---|---|
| 1 | Fundação: monorepo, GCP setup, auth, CI/CD | deploy-dev OK + auth no browser |
| 2 | Interview Engine: Entrevistador SSE, docs, maturity | entrevista end-to-end com maturity ≥ 0.70 |
| 3 | Estimate Pipeline: CrewAI 6 agentes, pgvector, jobs | pipeline completo < 150s |
| 4 | Project Management: aprovação → projeto, oute.pro | fluxo completo + redirect 301 ativo |
| 5 | Produção: security audit, load test, monitoring | deploy prod sem regressões |

---

## Design System (@oute/ui)

Componentes exportados: `Button`, `SectionHeader`, `StatusBadge`, `Tag`, `ProgressBar`, `MetricDisplay`, `ChatBubble`, `DocumentCard`, `MaturityBar`

Tokens CSS em `packages/ui/src/theme/theme.css`:
```css
--color-dark-bg:      #0f1117;
--color-dark-surface: #1a1d27;
--color-primary-500:  #6366f1;
--color-primary-600:  #4f46e5;
--color-error:        #ef4444;
--color-warning:      #f59e0b;
--color-success:      #10b981;
```

---

## Migrations (ordem de criação)

```
001_extensions.sql      — pgvector, uuid-ossp
002_schemas.sql         — schemas public, ai, audit
003_users.sql           — public.users
004_interviews.sql      — public.interviews, interview_messages, documents
005_interview_state.sql — indexes JSONB em interviews.state
006_estimates.sql       — public.estimates
007_knowledge_vectors.sql — ai.knowledge_vectors + IVFFlat index
008_projects.sql        — public.projects, milestones, tasks
009_job_state.sql       — ai.job_state (Redis fallback)
```

---

## ADRs Aceitos (resumo)

| ADR | Decisão |
|---|---|
| ADR-01 | SvelteKit como BFF único (auth + DB + proxy SSE) |
| ADR-02 | FastAPI com dois modos: SSE conversacional + batch CrewAI |
| ADR-03 | pgvector + Vertex AI text-multilingual-embedding-002 — sem Qdrant |
| ADR-04 | Redis com fallback PostgreSQL — sem MindsDB |
| ADR-05 | Firebase Auth — sem Auth.js ou Supabase |
| ADR-06 | GCP-only, sem VM, sem Docker Compose |
| ADR-07 | pnpm workspaces + Turborepo |
| ADR-08 | Domínio único: oute.pro (GCP Cloud Run) |
| ADR-09 | Vertex AI SDK como cliente LLM padrão (ADC — sem GEMINI_API_KEY) |
| ADR-10 | Cloud Tasks como orquestrador de jobs assíncronos de estimativa |

Documento completo: `docs/architecture/ADD_v1.0.docx`
