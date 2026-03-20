# oute.me — DeepWiki

> Documentação técnica completa do repositório. Leitura recomendada para onboarding, revisão de arquitetura e desenvolvimento de novas features.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Estrutura do Repositório](#2-estrutura-do-repositório)
3. [Stack Técnica](#3-stack-técnica)
4. [Arquitetura do Sistema](#4-arquitetura-do-sistema)
5. [Fluxo de Autenticação](#5-fluxo-de-autenticação)
6. [Interview Engine (SSE Conversacional)](#6-interview-engine-sse-conversacional)
7. [Pipeline de Estimativa (CrewAI Batch)](#7-pipeline-de-estimativa-crewai-batch)
8. [Processamento de Documentos](#8-processamento-de-documentos)
9. [Projetos (Aprovação → Execução)](#9-projetos-aprovação--execução)
10. [Tones de Conversa](#10-tones-de-conversa)
11. [API Reference — SvelteKit BFF](#11-api-reference--sveltekit-bff)
12. [API Reference — FastAPI AI Service](#12-api-reference--fastapi-ai-service)
13. [Schema do Banco de Dados](#13-schema-do-banco-de-dados)
14. [Migrations](#14-migrations)
15. [Design System (@oute/ui)](#15-design-system-outeui)
16. [Stores Svelte 5 (Runes)](#16-stores-svelte-5-runes)
17. [Serviços Python (apps/ai)](#17-serviços-python-appsai)
18. [Agentes CrewAI](#18-agentes-crewai)
19. [State Backend (Redis / PostgreSQL Fallback)](#19-state-backend-redis--postgresql-fallback)
20. [Infraestrutura GCP](#20-infraestrutura-gcp)
21. [Segurança e Middleware](#21-segurança-e-middleware)
22. [Configuração e Build](#22-configuração-e-build)
23. [Variáveis de Ambiente](#23-variáveis-de-ambiente)
24. [Regras de Arquitetura (Nunca Violar)](#24-regras-de-arquitetura-nunca-violar)
25. [ADRs Aceitos](#25-adrs-aceitos)
26. [Fases de Implementação](#26-fases-de-implementação)

---

## 1. Visão Geral

**oute.me** é uma plataforma SaaS de estimativa de projetos de software com IA. O produto conduz o usuário por uma entrevista conversacional para descobrir o escopo do projeto, depois executa um pipeline de IA em background que gera uma estimativa técnica e financeira detalhada. Ao aprovar a estimativa, é criado um plano de projeto com milestones e tarefas.

**Fluxo central:**

```
Interview (entrevista SSE) → Estimate (pipeline CrewAI batch) → Project (plano aprovado)
```

**Domínios:**
- `oute.me` — domínio primário, DNS GCP, Cloud Run prod
- `oute.pro` — CNAME externo → GCP, faz redirect 301 permanente para `oute.me`

---

## 2. Estrutura do Repositório

```
oute.me/
├── apps/
│   ├── web/                        # SvelteKit 5 — BFF + Frontend (porta 5173)
│   │   ├── src/
│   │   │   ├── app.d.ts            # tipos globais (Locals, PageData, etc.)
│   │   │   ├── hooks.server.ts     # middleware chain: domain redirect → auth → gates → headers
│   │   │   ├── lib/
│   │   │   │   ├── components/     # componentes locais (SettingsMenu.svelte)
│   │   │   │   ├── firebase.ts     # Firebase client-side init
│   │   │   │   ├── security.ts     # rateLimit, securityHeaders
│   │   │   │   ├── stores/
│   │   │   │   │   ├── chat.svelte.ts   # estado de chat (SSE, maturity, docs)
│   │   │   │   │   └── tone.svelte.ts   # tone ativo do usuário
│   │   │   │   ├── types/
│   │   │   │   │   ├── interview.ts
│   │   │   │   │   ├── estimate.ts
│   │   │   │   │   └── project.ts
│   │   │   │   └── server/
│   │   │   │       ├── auth.ts         # Firebase Admin SDK — validação de token
│   │   │   │       ├── db.ts           # pool postgres
│   │   │   │       ├── ai-client.ts    # proxy SSE + JSON para FastAPI
│   │   │   │       ├── users.ts        # getOrCreateUser, admin check
│   │   │   │       ├── interviews.ts   # CRUD entrevistas
│   │   │   │       ├── estimates.ts    # CRUD estimativas
│   │   │   │       ├── projects.ts     # CRUD projetos + milestones + tasks
│   │   │   │       └── tones.ts        # listagem e preferência de tone
│   │   │   └── routes/
│   │   │       ├── +layout.svelte      # navbar, carrega user data
│   │   │       ├── +layout.server.ts   # passa user para layout
│   │   │       ├── +layout.ts          # Firebase client auth listener
│   │   │       ├── +page.svelte        # homepage (hero + features)
│   │   │       ├── login/              # página de login
│   │   │       ├── onboarding/         # coleta nome, empresa, papel
│   │   │       ├── pending/            # email não verificado ou conta inativa
│   │   │       ├── interviews/         # listagem e página de chat da entrevista
│   │   │       ├── estimates/          # detalhe da estimativa e aprovação
│   │   │       ├── projects/           # detalhe e gestão de milestones/tasks
│   │   │       ├── admin/              # painel admin — gestão de usuários
│   │   │       └── api/                # 10 endpoints REST/SSE
│   │   │           ├── interviews/
│   │   │           ├── chat/[id]/message/     # SSE proxy
│   │   │           ├── chat/[id]/upload/
│   │   │           ├── estimates/
│   │   │           ├── projects/
│   │   │           ├── tones/
│   │   │           └── admin/users/
│   │   ├── package.json
│   │   ├── svelte.config.js            # adapter-node
│   │   ├── vite.config.ts              # porta 5173
│   │   └── tsconfig.json               # strict mode
│   │
│   └── ai/                         # FastAPI 0.115 — serviço de IA (porta 8000)
│       ├── src/
│       │   ├── main.py             # app FastAPI + middleware + lifespan
│       │   ├── config.py           # Pydantic Settings
│       │   ├── middleware.py       # RateLimit, RequestLogging, SecurityHeaders
│       │   ├── models/
│       │   │   ├── interview.py    # ChatRequest, InterviewState, DomainState
│       │   │   └── estimate.py     # EstimateRequest, EstimateResult, CostScenario
│       │   ├── routers/
│       │   │   ├── chat.py         # POST /message, POST /process-document
│       │   │   ├── estimate.py     # POST /run, GET /status/{job_id}
│       │   │   └── health.py       # GET /services
│       │   ├── services/
│       │   │   ├── database.py     # asyncpg connection pool
│       │   │   ├── embeddings.py   # Gemini text-embedding-004 (768 dims)
│       │   │   ├── gemini.py       # stream_chat, analyze_json
│       │   │   ├── interviewer.py  # process_message → SSE generator
│       │   │   ├── prompts.py      # build_system_prompt, STATE_ANALYSIS_PROMPT
│       │   │   ├── state_analyzer.py  # analyze_and_update_state
│       │   │   ├── state.py        # StateBackend protocol (Redis / Postgres)
│       │   │   ├── estimate_runner.py  # start_estimate, background job executor
│       │   │   ├── document_processor.py  # PDF/DOCX/XLSX/CSV/PPTX/Imagem
│       │   │   └── vector_store.py  # store_vector → pgvector
│       │   └── crew/
│       │       ├── estimate_crew.py  # build_estimate_crew() — 6 agentes
│       │       ├── agents.yaml
│       │       ├── tasks.yaml
│       │       └── tools.py          # VectorSearchTool
│       ├── tests/                  # pytest + asyncio
│       ├── pyproject.toml
│       └── ruff.toml
│
├── packages/
│   └── ui/                         # Design System @oute/ui
│       └── src/lib/
│           ├── components/         # 9 componentes Svelte
│           ├── theme/theme.css     # tokens CSS dark mode
│           └── index.ts            # re-exports
│
├── database/
│   ├── migrations/                 # 13 arquivos SQL numerados (000–012)
│   └── migrate.ts                  # runner com checksum SHA256
│
├── docs/
│   ├── adr/                        # Architecture Decision Records (ADR-01 a ADR-08)
│   └── architecture/               # ADD_v1.0.docx
│
├── infra/gcp/
│   ├── setup.sh                    # 3 fases: APIs, VPC, domains
│   └── monitoring.sh
│
├── .github/workflows/              # CI/CD
├── package.json                    # root pnpm workspace
├── pnpm-workspace.yaml
├── turbo.json
└── eslint.config.js                # flat config TypeScript + Svelte
```

---

## 3. Stack Técnica

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend + BFF | SvelteKit 5 + TypeScript | 5.x, strict |
| Serviço de IA | FastAPI + Python | 0.115.x, 3.12 |
| LLM (chat) | Gemini 2.5 Flash | google-genai ≥ 1.0 |
| LLM (análise) | Gemini 2.5 Flash-Lite | google-genai ≥ 1.0 |
| Embeddings | Gemini text-embedding-004 | 768 dimensões |
| Banco principal | PostgreSQL 16 + pgvector | Cloud SQL (GCP) |
| Busca vetorial | pgvector (IVFFlat) | tabela `ai.knowledge_vectors` |
| Cache / Jobs | Redis | Memorystore BASIC (prod) / Postgres fallback (dev) |
| Auth | Firebase Auth + Admin SDK | client + server |
| Storage | Google Cloud Storage | GCS (prod) / local (dev) |
| Orquestração IA | CrewAI | 1.10.1 — SOMENTE pipeline batch |
| Monorepo | pnpm workspaces + Turborepo | pnpm 10.30.3 |
| Package Python | uv | – |
| Lint Python | ruff | substitui flake8 + black + isort |
| Type check Python | mypy | strict |
| Runtime Node | Node.js | ≥ 24.0.0 |

---

## 4. Arquitetura do Sistema

```
Browser
  │
  │  HTTPS
  ▼
oute.me (Cloud Run — SvelteKit)
  │ ├── Serve frontend (SSR/SPA)
  │ ├── Firebase Admin SDK (validação de token)
  │ ├── Queries diretas ao PostgreSQL (driver `postgres`)
  │ └── Proxy HTTP/SSE para FastAPI (internal only)
  │
  │  HTTP interno (Cloud Run → Cloud Run)
  ▼
oute-ai (Cloud Run — FastAPI)
  │ ├── Sem autenticação própria (confia no BFF)
  │ ├── Gemini SDK (stream + JSON + embeddings)
  │ ├── asyncpg (somente pgvector e job_state)
  │ └── CrewAI (pipeline batch em ThreadPoolExecutor)
  │
  ▼
PostgreSQL 16 (Cloud SQL)
  ├── public.*     — dados de negócio
  ├── ai.*         — knowledge_vectors, job_state
  └── audit.*      — event_log imutável
```

**Princípios fundamentais:**
- SvelteKit é o único ponto de acesso externo ao PostgreSQL
- FastAPI é stateless e sem endpoint público
- CrewAI é usado APENAS no pipeline batch (nunca no chat)
- Streaming SSE é proxy: Browser → SvelteKit → FastAPI → Gemini

---

## 5. Fluxo de Autenticação

### Middleware Chain (`hooks.server.ts`)

A sequência executada em cada request é:

```
redirectDomain → rateLimit → authenticate → gateUser → securityHeaders
```

### 1. redirectDomain
Remove `www.` do host. Não afeta rotas.

### 2. rateLimit
60 req/min por IP. Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`.

### 3. authenticate
Aceita token Firebase via:
- Header `Authorization: Bearer <token>`
- Cookie `__session`

Chama `verifyIdToken()` do Firebase Admin SDK. Injeta `event.locals.user` se válido.

### 4. gateUser (gates sequenciais)

```
1. Rota pública (/  /login)?  → passa
2. Sem token?                 → redirect /login 302
3. User existe no DB?         → getOrCreateUser() (cria se novo)
4. É admin?                   → redireciona para /interviews se veio de /admin sem ser admin
5. Rota /onboarding ou /pending? → passa sempre
6. Onboarding incompleto?     → redirect /onboarding
7. Email não verificado?      → redirect /pending
8. Admin marcou como inativo? → redirect /pending
9. Passou tudo?               → resolve normalmente
```

### 5. securityHeaders
Injeta: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Permissions-Policy`.

### Admin Auto-Grant
Emails listados em `ADMIN_EMAILS` (env var, separados por vírgula) recebem automaticamente `is_admin=true` e `active=true` ao primeiro login.

---

## 6. Interview Engine (SSE Conversacional)

### Visão Geral

O chat de entrevista usa Gemini SDK diretamente (sem CrewAI) para manter baixa latência. O estado da entrevista é persistido em JSONB no banco a cada turno — não há sessão em memória.

### Fluxo turn-by-turn

```
[Browser]
  sendMessage(text)
    │
    ▼
[SvelteKit — /api/chat/[id]/message]
  1. Verifica rate limit por user (2s mínimo entre mensagens)
  2. Carrega interview + últimas 20 mensagens + documentos extraídos
  3. Carrega tone ativo do usuário
  4. Proxy SSE → FastAPI /chat/message
  5. Para cada evento SSE recebido:
     - message_chunk → repassa ao browser
     - state_update  → persiste state + maturity no DB, repassa ao browser
     - done          → persiste mensagem AI no DB, repassa ao browser
    │
    ▼
[FastAPI — /chat/message]
  process_message(request: ChatRequest)
    │
    ├── build_system_prompt(state, documents_context, tone_instruction)
    ├── stream_chat(system_prompt, history, user_message)  ← Gemini SDK
    │     └── emite chunks de texto
    ├── analyze_and_update_state(state, user_message, full_response) ← Gemini JSON
    │     └── retorna updated_state + maturity (0.0–1.0)
    └── emite SSE:
          event: message_chunk  → {"text": "...", "interview_id": "..."}
          event: state_update   → {"maturity": 0.45, "domains": {...}}
          event: done           → {"message_id": "...", "tokens_used": 312}
```

### Estado da Entrevista (JSONB)

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

### Maturity Score

| Domínio | Peso | Vital obrigatório |
|---|---|---|
| scope | 30% | Sim |
| timeline | 20% | Sim |
| budget | 20% | Sim |
| integrations | 15% | Não |
| tech_stack | 15% | Sim |

**Fórmula:**
```
maturity = sum(domain_progress * peso_domínio)
# Se algum vital não está answered: resultado * 0.85
```

**Threshold para estimativa:** `maturity ≥ 0.70` + aprovação explícita do usuário.

### System Prompt (`prompts.py`)

`build_system_prompt()` monta um prompt com:
- Objetivo da entrevista (atingir maturity 70%)
- Status atual de cada domínio (answered/total, vital_answered)
- Regras de conduta: 1–2 perguntas por vez, português BR, markdown
- Perguntas vitais que precisam ser cobertas
- Instrução de tom (Zelo ou Curador)
- Contexto de documentos anexados pelo usuário

---

## 7. Pipeline de Estimativa (CrewAI Batch)

### Visão Geral

Após atingir `maturity ≥ 0.70` e o usuário aprovar, inicia-se um job assíncrono que roda 6 agentes CrewAI em sequência. Duração esperada: **90–130s**.

### Fluxo completo

```
[Browser] POST /api/estimates
    │
    ▼
[SvelteKit]
  1. Cria registro em public.estimates (status=pending, job_id=uuid)
  2. POST /estimate/run → FastAPI (passa state + summary + docs)
  3. Retorna { estimate_id, job_id } imediatamente
    │
    ▼
[FastAPI — /estimate/run]
  start_estimate(...)
    └── Inicia background task → retorna job_id imediatamente
    │
    ▼ (background, ~90-130s)
[estimate_runner.py]
  _run_crew_sync() em ThreadPoolExecutor(max_workers=2)
    │
    ├── [Agente 1] Entrevistador de Arquitetura
    │     consolida requisitos técnicos do state
    ├── [Agente 2] Analista RAG
    │     busca projetos similares via pgvector (VectorSearchTool)
    ├── [Agente 3] Arquiteto de Software
    │     propõe arquitetura, stack, cronograma
    ├── [Agente 4] Especialista em Custos
    │     gera 3 cenários financeiros
    ├── [Agente 5] Revisor e Apresentador
    │     valida, consolida, gera sumário executivo
    └── [Agente 6] Gestor de Conhecimento
          embeda resultado no pgvector para RAG futuro
    │
    ▼
  update_job(status="done", result={EstimateResult})
  store_vector(source_type="estimate", content=summary)

[Browser] polling GET /api/estimates/[id]
  → SvelteKit GET /estimate/status/{job_id}
  → retorna { status, result }
```

### Resultado (EstimateResult)

```typescript
interface EstimateResult {
  summary: string;
  architecture_overview: string;
  milestones: Milestone[];
  cost_scenarios: CostScenario[];    // sempre 3 cenários
  tech_recommendations: TechRecommendation[];
  risks: RiskItem[];
  similar_projects: Record<string, unknown>[];
  executive_summary: string;
}

interface CostScenario {
  name: string;           // ex: "conservador", "moderado", "agressivo"
  description: string;
  total_hours: number;
  hourly_rate: number;
  total_cost: number;
  duration_weeks: number;
  team_size: number;
  confidence: number;     // 0.0–1.0
}
```

---

## 8. Processamento de Documentos

### Upload flow

```
[Browser] POST /api/chat/[id]/upload (multipart)
    │
    ▼
[SvelteKit]
  1. Salva arquivo em GCS (prod) ou local (dev)
  2. Cria registro em public.documents (status=pending)
  3. POST /chat/process-document → FastAPI
    │
    ▼
[FastAPI — /chat/process-document]
  extract_text(file_bytes, mime_type, filename)
    ├── PDF     → PyMuPDF
    ├── DOCX    → python-docx
    ├── XLSX    → openpyxl
    ├── CSV     → pandas
    ├── PPTX    → python-pptx
    └── Imagem  → Gemini Vision (multimodal)
  retorna extracted_text (máx 10.000 chars)
    │
    ▼
[SvelteKit]
  UPDATE documents SET extracted_text=..., status='completed'
  retorna { document, extracted_text } ao browser
```

### Uso nos turnos de chat

O `extracted_text` de documentos processados é concatenado em `documents_context` e passado ao `build_system_prompt()` de cada turno seguinte.

---

## 9. Projetos (Aprovação → Execução)

### Aprovação de estimativa

```
POST /api/estimates/[id]/approve
    │
    ▼
[SvelteKit]
  1. Valida que estimate.status = 'done' e pertence ao usuário
  2. Lê estimate.result (milestones, cenário moderado por padrão)
  3. BEGIN TRANSACTION:
     INSERT public.projects
     INSERT public.milestones (loop por milestone do result)
     INSERT public.tasks      (loop por task de cada milestone)
     UPDATE public.estimates SET status='approved', approved_at=now()
  4. Retorna { project_id }
```

### Status de tasks e milestones

- `tasks.status`: `todo` | `in_progress` | `done`
- `milestones.status`: `pending` | `in_progress` | `completed`
- `projects.status`: `active` | `completed` | `archived`

---

## 10. Tones de Conversa

Dois tons pré-definidos (seed em `011_conversation_tones.sql`):

| Slug | Nome | Instrução |
|---|---|---|
| `zelo` | Zelo | "Seja parceiro dedicado que cuida com carinho e rigor" |
| `curador` | Curador | "Sócio estratégico com Extreme Ownership" |

**Preferência:** armazenada em `public.user_tone_preferences` (UNIQUE por `user_id`). O `activeTone.action` é passado como `tone_instruction` ao `build_system_prompt()` de cada turno.

**API:**
- `GET /api/tones` — lista todos
- `GET /api/tones/active` — tone ativo do usuário autenticado

**Store:**
```typescript
// apps/web/src/lib/stores/tone.svelte.ts
export let activeTone = $state({ name: "Zelo", action: "..." });
```

---

## 11. API Reference — SvelteKit BFF

Todos os endpoints exigem autenticação Firebase (exceto `/` e `/login`).

### Entrevistas

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/interviews` | Cria entrevista, retorna `Interview` |
| `GET` | `/api/interviews` | Lista entrevistas do usuário autenticado |
| `GET` | `/api/interviews/[id]` | Detalhe + state + mensagens |

### Chat

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/chat/[id]/message` | SSE stream — emite `message_chunk`, `state_update`, `done` |
| `POST` | `/api/chat/[id]/upload` | Upload de documento, retorna `{ document, extracted_text }` |

**Rate limit de chat:** 2s mínimo entre mensagens por usuário.

### Estimativas

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/estimates` | Cria estimate + inicia job CrewAI |
| `GET` | `/api/estimates/[id]` | Detalhe + resultado (polling) |
| `POST` | `/api/estimates/[id]/approve` | Aprova estimate → cria `Project` |

### Projetos

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/projects` | Cria projeto manual |
| `GET` | `/api/projects` | Lista projetos do usuário |
| `GET` | `/api/projects/[id]` | Detalhe + milestones + tasks |
| `POST` | `/api/projects/[id]/milestones/[milestoneId]` | Atualiza milestone |
| `POST` | `/api/projects/[id]/milestones/[milestoneId]/tasks` | Adiciona task |

### Tones

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/tones` | Lista todos os tones |
| `GET` | `/api/tones/active` | Tone ativo do usuário |

### Admin

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/admin/users` | Lista usuários (admin only) |
| `POST` | `/api/admin/users/[id]` | Atualiza usuário (ativação, flag admin) |

---

## 12. API Reference — FastAPI AI Service

> Serviço interno. Não exposto publicamente. Todo acesso passa pelo BFF SvelteKit.

**Base URL (dev):** `http://localhost:8000`
**Base URL (prod):** URL interna do Cloud Run (env `AI_SERVICE_URL` no web)

### Chat

```
POST /chat/message
Content-Type: application/json

{
  "interview_id": "uuid",
  "state": InterviewState,
  "history": [{ "role": "user|assistant", "content": "..." }],
  "user_message": "texto da mensagem",
  "documents_context": "texto extraído de docs (opcional)",
  "tone_instruction": "instrução do tom (opcional)"
}

→ SSE stream:
  event: message_chunk
  data: {"text": "...", "interview_id": "uuid"}

  event: state_update
  data: {"maturity": 0.45, "domains": {...}, "open_questions": [...]}

  event: done
  data: {"message_id": "uuid", "tokens_used": 312}
```

```
POST /chat/process-document
Content-Type: multipart/form-data

→ { "extracted_text": "..." }
```

### Estimate

```
POST /estimate/run
Content-Type: application/json

{
  "interview_id": "uuid",
  "state": dict,
  "conversation_summary": "...",
  "documents_context": ""
}

→ { "job_id": "uuid" }
```

```
GET /estimate/status/{job_id}

→ {
    "status": "pending|running|done|failed",
    "result": EstimateResult | null
  }
```

### Health

```
GET /health/services

→ {
    "postgres": "ok|error",
    "redis": "ok|unavailable",
    "gemini": "ok|error"
  }
```

---

## 13. Schema do Banco de Dados

### Schemas PostgreSQL

| Schema | Conteúdo |
|---|---|
| `public` | users, interviews, interview_messages, documents, estimates, projects, milestones, tasks, conversation_tones, user_tone_preferences |
| `ai` | knowledge_vectors (pgvector), job_state (Redis fallback), document_chunks |
| `audit` | event_log (imutável) |

### public.users

```sql
id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4()
firebase_uid       text UNIQUE NOT NULL
email              text UNIQUE NOT NULL
display_name       text
full_name          text
company            text
role               text
plan               text DEFAULT 'free'
active             boolean DEFAULT false
is_admin           boolean DEFAULT false
onboarding_complete boolean DEFAULT false
email_verified     boolean DEFAULT false
created_at         timestamptz DEFAULT now()
updated_at         timestamptz DEFAULT now()
```

### public.interviews

```sql
id         uuid PK
user_id    uuid FK → users
title      text
status     text DEFAULT 'active'
state      jsonb                -- InterviewState completo
maturity   numeric(4,3)         -- 0.000–1.000
created_at timestamptz
updated_at timestamptz
```

### public.interview_messages

```sql
id             uuid PK
interview_id   uuid FK → interviews
role           text  -- 'user' | 'assistant'
content        text
tokens_used    int
created_at     timestamptz
```

### public.documents

```sql
id             uuid PK
interview_id   uuid FK → interviews
filename       text
mime_type      text
storage_path   text         -- GCS path ou local path
extracted_text text
status         text         -- 'pending' | 'completed' | 'failed'
created_at     timestamptz
```

### public.estimates

```sql
id           uuid PK
interview_id uuid FK → interviews
user_id      uuid FK → users
status       text   -- 'pending' | 'running' | 'done' | 'failed' | 'approved'
job_id       text UNIQUE  -- UUID do job CrewAI
result       jsonb        -- EstimateResult serializado
approved_at  timestamptz
created_at   timestamptz
updated_at   timestamptz
```

### public.projects

```sql
id                uuid PK
estimate_id       uuid FK → estimates
user_id           uuid FK → users
name              text
description       text
status            text DEFAULT 'active'
selected_scenario text DEFAULT 'moderado'
total_cost        numeric
total_hours       numeric
duration_weeks    int
team_size         int
created_at        timestamptz
updated_at        timestamptz
```

### public.milestones

```sql
id             uuid PK
project_id     uuid FK → projects
name           text
description    text
duration_weeks int
sort_order     int
status         text  -- 'pending' | 'in_progress' | 'completed'
deliverables   jsonb -- string[]
dependencies   jsonb -- string[]
started_at     timestamptz
completed_at   timestamptz
created_at     timestamptz
updated_at     timestamptz
```

### public.tasks

```sql
id              uuid PK
milestone_id    uuid FK → milestones
project_id      uuid FK → projects
title           text
description     text
status          text  -- 'todo' | 'in_progress' | 'done'
priority        text  -- 'low' | 'medium' | 'high'
estimated_hours numeric(6,1)
sort_order      int
created_at      timestamptz
updated_at      timestamptz
```

### public.conversation_tones

```sql
id         uuid PK
name       text          -- "Zelo", "Curador"
slug       text UNIQUE   -- "zelo", "curador"
action     text          -- instrução de tom para o prompt
is_default boolean
created_at timestamptz
```

### public.user_tone_preferences

```sql
id         uuid PK
user_id    uuid FK → users (UNIQUE)
tone_id    uuid FK → conversation_tones
created_at timestamptz
updated_at timestamptz
```

### ai.knowledge_vectors

```sql
id           uuid PK
source_type  text   -- 'estimate' | 'project'
source_id    uuid
content      text
embedding    vector(768)  -- Gemini text-embedding-004
metadata     jsonb
created_at   timestamptz

INDEX: IVFFlat (embedding vector_cosine_ops)
```

### ai.job_state (fallback Redis)

```sql
job_id     text PK
status     text   -- 'pending' | 'running' | 'done' | 'failed'
payload    jsonb
result     jsonb
expires_at timestamptz
created_at timestamptz
updated_at timestamptz
```

### audit.event_log

Tabela imutável (sem UPDATE/DELETE por convenção) para auditoria de ações críticas.

---

## 14. Migrations

O runner `database/migrate.ts` aplica migrations em ordem numérica e rastreia checksums SHA256 para idempotência. Não reaplica uma migration já executada.

```bash
pnpm migrate              # aplica todas pendentes
pnpm migrate:status       # mostra quais foram aplicadas
pnpm migrate:dry          # dry-run sem executar
```

| Arquivo | Conteúdo |
|---|---|
| `000_schema_migrations.sql` | Bootstrap — tabela de controle de migrations |
| `001_extensions.sql` | Extensions: `uuid-ossp`, `vector` |
| `002_schemas.sql` | Schemas: `public`, `ai`, `audit` |
| `003_users.sql` | Tabela users + trigger `updated_at` |
| `004_interviews.sql` | interviews, interview_messages, documents |
| `005_interview_state.sql` | Índices JSONB em `interviews.state` |
| `006_estimates.sql` | Tabela estimates |
| `007_knowledge_vectors.sql` | `ai.knowledge_vectors` + IVFFlat index (768 dims) |
| `008_projects.sql` | projects, milestones, tasks |
| `009_job_state.sql` | `ai.job_state` (fallback Redis) |
| `010_audit_log.sql` | `audit.event_log` |
| `011_conversation_tones.sql` | Tabelas de tone + seed (Zelo, Curador) |
| `012_user_activation.sql` | Campos de ativação em users |

---

## 15. Design System (@oute/ui)

Pacote interno `packages/ui`. Importado em `apps/web` como `@oute/ui`.

### Componentes

| Componente | Props principais |
|---|---|
| `Button` | `size: sm\|md\|lg`, `variant: primary\|secondary` |
| `SectionHeader` | `title`, `subtitle` |
| `StatusBadge` | `status`, `label` |
| `Tag` | `label`, `color` |
| `ProgressBar` | `value: 0–100` |
| `MetricDisplay` | `label`, `value`, `unit` |
| `ChatBubble` | `role: user\|assistant`, `content` |
| `DocumentCard` | `filename`, `status`, `mime_type` |
| `MaturityBar` | `maturity: 0–1` — barra de progresso da entrevista |

### Tokens CSS (`theme/theme.css`)

```css
--color-dark-bg:        #0f1117;   /* fundo principal */
--color-dark-surface:   #1a1d27;   /* cards, sidebars */
--color-primary-500:    #6366f1;   /* indigo — ação primária */
--color-primary-600:    #4f46e5;   /* hover */
--color-error:          #ef4444;
--color-warning:        #f59e0b;
--color-success:        #10b981;
```

---

## 16. Stores Svelte 5 (Runes)

### chat.svelte.ts

```typescript
function createChatState(
  interviewId: string,
  initialMessages: InterviewMessage[],
  initialMaturity: number,
  initialDomains: Record<string, DomainState>,
  initialDocuments: ChatDocument[]
)
```

**Estado reativo:**
- `messages` — histórico de mensagens (user + assistant)
- `isStreaming` — true durante SSE ativo
- `maturity` — número 0–1, atualizado em tempo real via `state_update`
- `domains` — progresso por domínio
- `currentStreamText` — texto acumulado durante streaming
- `error` — string | null

**Derivado:**
- `totalTokensUsed` — soma de todos os `tokens_used` das mensagens

**Métodos:**
- `sendMessage(text)` — POST + parse SSE
- `uploadDocument(file)` — POST multipart

### tone.svelte.ts

```typescript
export let activeTone = $state({ name: "Zelo", action: "..." });
```

State global do tone ativo. Atualizado no `+layout.server.ts` ao carregar o tone do usuário.

---

## 17. Serviços Python (apps/ai)

### gemini.py

```python
async def stream_chat(
    system_prompt: str,
    history: list[dict[str, str]],
    user_message: str,
    max_seconds: float = 120.0
) -> AsyncGenerator[str, None]
# Gemini 2.5 Flash, streaming com timeout de 120s

async def analyze_json(
    prompt: str,
    max_seconds: float = 30.0
) -> dict[str, object]
# Gemini JSON response mode, timeout 30s
```

### interviewer.py

```python
async def process_message(
    request: ChatRequest
) -> AsyncGenerator[dict[str, str], None]
# 1. stream_chat() → acumula full_response + emite message_chunk
# 2. analyze_and_update_state() → retorna updated_state, maturity
# 3. emite state_update
# 4. emite done
```

### prompts.py

Monta prompt com contexto completo da entrevista:
- Estado atual de cada domínio
- Regras de conduta do entrevistador
- Perguntas vitais ainda abertas
- Instrução de tom
- Documentos anexados

`STATE_ANALYSIS_PROMPT` — template para análise JSON da resposta do Gemini. Retorna `domains_update`, `conversation_summary`, `open_questions`, `last_questions_asked`.

### state_analyzer.py

```python
async def analyze_and_update_state(
    current_state: InterviewState,
    user_message: str,
    ai_response: str,
) -> tuple[InterviewState, float]
# Chama analyze_json() com STATE_ANALYSIS_PROMPT
# Aplica domains_update ao state atual (incrementa answered_delta)
# Calcula e retorna maturity (0.0–1.0)
```

### estimate_runner.py

```python
async def start_estimate(
    interview_id: str,
    interview_state: dict,
    conversation_summary: str,
    documents_context: str,
    backend: StateBackend,
) -> str  # job_id

# Background: _run_crew_sync() em ThreadPoolExecutor(max_workers=2)
# crew.kickoff() é síncrono — por isso precisa do executor
# Após conclusão: update_job(status="done", result=...) + store_vector()
```

### document_processor.py

```python
async def extract_text(
    file_bytes: bytes,
    mime_type: str,
    filename: str
) -> str  # máx 10.000 chars
```

| Tipo | Biblioteca |
|---|---|
| `application/pdf` | PyMuPDF |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | python-docx |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | openpyxl |
| `text/csv` | pandas |
| `application/vnd.openxmlformats-officedocument.presentationml.presentation` | python-pptx |
| `image/*` | Gemini Vision (multimodal) |

### vector_store.py

```python
async def store_vector(
    source_type: str,  # 'estimate' | 'project'
    source_id: str,
    content: str,
    metadata: dict
) -> None
# Embeda content com Gemini text-embedding-004 (768 dims)
# INSERT INTO ai.knowledge_vectors
```

---

## 18. Agentes CrewAI

Arquivo: `apps/ai/src/crew/estimate_crew.py`

```python
def build_estimate_crew(
    interview_state: dict,
    conversation_summary: str,
    documents_context: str,
) -> Crew
```

**Processo:** `Process.sequential` — cada agente recebe o output do anterior.
**Modelo:** `gemini-2.5-flash-lite` em todos os agentes (mais econômico para batch).

| # | Agente | Responsabilidade |
|---|---|---|
| 1 | `architecture_interviewer` | Consolida requisitos técnicos a partir do state da entrevista |
| 2 | `rag_analyst` | Busca estimativas similares via `VectorSearchTool` (pgvector cosine) |
| 3 | `software_architect` | Propõe arquitetura, stack tecnológica e cronograma de milestones |
| 4 | `cost_specialist` | Calcula 3 cenários financeiros (conservador / moderado / agressivo) |
| 5 | `reviewer` | Valida consistência, consolida e gera sumário executivo |
| 6 | `knowledge_manager` | Prepara conteúdo para embedding e persistência no pgvector |

---

## 19. State Backend (Redis / PostgreSQL Fallback)

```python
class StateBackend(Protocol):
    async def create_job(self, job_id: str, payload: dict) -> None
    async def get_job(self, job_id: str) -> dict | None
    async def update_job(self, job_id: str, status: str, result: dict | None) -> None
```

**Seleção automática:**
```python
# apps/ai/src/services/state.py
def create_state_backend() -> StateBackend:
    if settings.REDIS_URL:
        return RedisStateBackend(settings.REDIS_URL)   # prod
    return PostgresStateBackend(settings.DATABASE_URL) # dev fallback
```

**Redis:** `SETEX job:{job_id}` com TTL 24h, valor = JSON serializado.
**Postgres:** `INSERT INTO ai.job_state` + `UPDATE status, result`.

---

## 20. Infraestrutura GCP

### Projeto GCP

`oute-488706`

### Ambientes

| Recurso | DEV | PROD |
|---|---|---|
| Cloud Run web | 256Mi RAM, min-instances=0 | 512Mi RAM, min-instances=0 |
| Cloud Run ai | 1Gi RAM, min-instances=0 | 2Gi RAM, min-instances=0 |
| Cloud SQL | db-f1-micro, DB: `oute_develop` | db-g1-small, DB: `oute_production` |
| Redis | Postgres fallback (sem custo) | Memorystore BASIC 1GB |
| GCS | `oute-dev-uploads` | `oute-prod-uploads` |
| Custo estimado | ~$0/mês | ~$10–15/mês |

### Domínios

| Domínio | Configuração |
|---|---|
| `oute.me` | DNS GCP, domain mapping Cloud Run prod |
| `oute.pro` | CNAME externo → `ghs.googlehosted.com`, TLS GCP, redirect 301 |

### Redirect oute.pro → oute.me

```typescript
// apps/web/src/hooks.server.ts
function redirectDomain(event) {
  const host = event.request.headers.get('host') ?? '';
  if (host.includes('oute.pro')) {
    const url = new URL(event.request.url);
    url.hostname = 'oute.me';
    return Response.redirect(url.toString(), 301);
  }
}
```

### setup.sh (3 fases)

- **Phase 1:** Enable APIs, Artifact Registry, Service Account (`oute-deployer`), Cloud SQL, GCS buckets
- **Phase 2:** VPC Connector, Memorystore Redis (prod), Workload Identity Federation para GitHub Actions
- **Phase 3:** Domain mappings para `oute.pro` e `oute.me`

---

## 21. Segurança e Middleware

### SvelteKit (`hooks.server.ts` + `security.ts`)

- Rate limit: 60 req/min por IP, sliding window
- Auth: token Firebase (Bearer ou cookie)
- Gates: sequência de verificações antes de cada request autenticado
- Headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `HSTS`, `Permissions-Policy`

### FastAPI (`middleware.py`)

- `RequestLoggingMiddleware` — loga method, path, status, duration_ms, IP
- `RateLimitMiddleware` — 100 req/min por IP, sliding window
- `SecurityHeadersMiddleware` — mesmos headers do SvelteKit
- `CORSMiddleware` — `allow_origins: ["https://oute.pro", "http://localhost:5173"]`

### FastAPI sem auth própria

O AI service não valida tokens Firebase. Ele confia que todo request veio do BFF SvelteKit, que já autenticou o usuário. **Nunca expor o AI service publicamente.**

---

## 22. Configuração e Build

### pnpm-workspace.yaml

```yaml
packages:
  - apps/web
  - packages/*
```

### turbo.json

```json
{
  "tasks": {
    "build":  { "dependsOn": ["^build"], "outputs": [".svelte-kit/**", "dist/**"] },
    "dev":    { "cache": false, "persistent": true },
    "lint":   { "dependsOn": ["^build"] },
    "format": { "cache": false },
    "test":   { "dependsOn": ["^build"] },
    "check":  { "dependsOn": ["^build"] }
  }
}
```

### Scripts raiz (package.json)

```bash
pnpm dev               # turbo run dev (web + ui em paralelo)
pnpm build             # turbo run build
pnpm lint              # turbo run lint (TypeScript + Svelte)
pnpm test              # turbo run test
pnpm typecheck:py      # mypy apps/ai/src/
pnpm lint:py           # ruff check apps/ai/src/ tests/
pnpm format:py         # ruff format apps/ai/src/ tests/
pnpm test:py           # pytest apps/ai/
pnpm migrate           # aplica migrations SQL pendentes
pnpm migrate:status    # status das migrations
pnpm migrate:dry       # dry-run migrations
```

### apps/ai/ruff.toml

```toml
target-version = "py312"
line-length = 100
[lint]
select = ["E", "W", "F", "I", "N", "UP", "B", "A", "ASYNC", "S", "T20", "RUF"]
ignore = ["S101"]  # assert em tests
[lint.per-file-ignores]
"src/services/prompts.py" = ["E501"]  # linhas longas ok em prompts
[format]
quote-style = "double"
```

---

## 23. Variáveis de Ambiente

### apps/web

```bash
DATABASE_URL=postgresql://user:pass@host:5432/oute_develop
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@oute-488706.iam.gserviceaccount.com
AI_SERVICE_URL=https://oute-ai-dev-xxxx.run.app
ADMIN_EMAILS=admin@example.com,outro@example.com
PUBLIC_FIREBASE_API_KEY=...
PUBLIC_FIREBASE_AUTH_DOMAIN=oute-488706.firebaseapp.com
```

### apps/ai

```bash
DATABASE_URL=postgresql://user:pass@host:5432/oute_develop
REDIS_URL=redis://...              # opcional — fallback para PG se ausente
GEMINI_API_KEY=AIzaSy...
GOOGLE_CLOUD_STORAGE_BUCKET=oute-dev-uploads
STORAGE_LOCAL_PATH=./data/uploads  # apenas se não usar GCS
ENVIRONMENT=development            # ou: production
```

---

## 24. Regras de Arquitetura (Nunca Violar)

1. **SvelteKit é o ÚNICO ponto de acesso externo ao PostgreSQL.** FastAPI não acessa o banco para auth — somente para pgvector e job_state.

2. **FastAPI não tem endpoints públicos.** Todo acesso externo passa pelo BFF SvelteKit, que autentica o token Firebase antes de proxiar.

3. **CrewAI SOMENTE no pipeline batch.** Chat usa Gemini SDK direto (sem CrewAI) para manter baixa latência no SSE.

4. **Sem Docker Compose, sem VM.** Dev aponta para Cloud SQL (dev) via Cloud SQL Auth Proxy se necessário. Não existe ambiente local com containers.

5. **Sem Qdrant.** Busca vetorial via pgvector no PostgreSQL existente.

6. **Sem MindsDB.** Estado de jobs via Redis (prod) ou tabela `ai.job_state` (dev fallback).

7. **Auth exclusivamente via Firebase Admin SDK no servidor.** Nunca ler/escrever sessão de auth diretamente no banco.

8. **oute.pro faz redirect 301 para oute.me** via `hooks.server.ts`. Nunca servir conteúdo diferente nos dois domínios.

---

## 25. ADRs Aceitos

| ADR | Decisão |
|---|---|
| ADR-01 | SvelteKit como BFF único (auth + DB + proxy SSE) |
| ADR-02 | FastAPI com dois modos: SSE conversacional + batch CrewAI |
| ADR-03 | pgvector + Gemini text-embedding-004 — sem Qdrant |
| ADR-04 | Redis com fallback PostgreSQL — sem MindsDB |
| ADR-05 | Firebase Auth — sem Auth.js ou Supabase |
| ADR-06 | GCP-only, sem VM, sem Docker Compose |
| ADR-07 | pnpm workspaces + Turborepo |
| ADR-08 | Dual domain: oute.me (GCP) + oute.pro (externo, 301 redirect) |

Documento completo: `docs/architecture/ADD_v1.0.docx`

---

## 26. Fases de Implementação

| Fase | Escopo | Critério de conclusão |
|---|---|---|
| 1 | Fundação: monorepo, GCP setup, auth, CI/CD | deploy-dev OK + auth no browser |
| 2 | Interview Engine: Entrevistador SSE, docs, maturity | entrevista end-to-end com maturity ≥ 0.70 |
| 3 | Estimate Pipeline: CrewAI 6 agentes, pgvector, jobs | pipeline completo < 150s |
| 4 | Project Management: aprovação → projeto, oute.pro | fluxo completo + redirect 301 ativo |
| 5 | Produção: security audit, load test, monitoring | deploy prod sem regressões |

---

*Gerado em 2026-03-17 a partir da leitura direta do código-fonte.*
