# Arquitetura — oute.me

Visão arquitetural do projeto, data flows, decisões técnicas e trade-offs. Para o documento formal completo, ver [ADD_v1.0.docx](architecture/ADD_v1.0.docx). Para ADRs individuais, ver [docs/adr/](adr/).

---

## Visão Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│                           BROWSER                                   │
│  SvelteKit 5 Frontend (Svelte 5 Runes)                             │
│  @oute/ui Design System                                             │
│  Firebase Auth (client SDK)                                         │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTPS (oute.pro)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SvelteKit BFF (Cloud Run)                        │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Auth     │  │ Rate Limit   │  │ SSE      │  │ REST API      │  │
│  │ (Firebase│  │              │  │ Proxy    │  │ (interviews,  │  │
│  │  Admin)  │  │              │  │          │  │  estimates,   │  │
│  │          │  │              │  │          │  │  projects)    │  │
│  └──────────┘  └──────────────┘  └──────────┘  └───────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   PostgreSQL Direct Access                    │  │
│  │           (queries SQL diretas, sem ORM)                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└───────────────┬──────────────────────────────┬──────────────────────┘
                │ Internal HTTP                │ SQL (postgres driver)
                ▼                              ▼
┌──────────────────────────┐    ┌──────────────────────────────────┐
│   FastAPI AI Service     │    │   PostgreSQL 16 + pgvector       │
│   (Cloud Run)            │    │   (Cloud SQL)                    │
│                          │    │                                  │
│  ┌────────────────────┐  │    │  Schemas:                        │
│  │ Entrevistador      │  │    │  • public (users, interviews,    │
│  │ (SSE, Vertex AI    │  │    │    estimates, projects)           │
│  │  direto, sem       │  │    │  • ai (knowledge_vectors,        │
│  │  CrewAI)           │  │    │    job_state, document_chunks)    │
│  └────────────────────┘  │    │  • audit (event_log)             │
│                          │    │                                  │
│  ┌────────────────────┐  │    └──────────────────────────────────┘
│  │ Pipeline Estimativa│  │
│  │ (CrewAI 6 agentes, │  │    ┌──────────────────────────────────┐
│  │  batch, Cloud      │  │    │   Redis (Memorystore)            │
│  │  Tasks)            │  │    │   Job state em produção          │
│  └────────────────────┘  │    │   (PG fallback em dev)           │
│                          │    └──────────────────────────────────┘
│  ┌────────────────────┐  │
│  │ Vertex AI          │  │    ┌──────────────────────────────────┐
│  │ • Gemini 2.5 Flash │  │    │   Google Cloud Storage           │
│  │ • Embeddings       │  │    │   Upload de documentos           │
│  │ • Vision           │  │    │   (local fallback em dev)        │
│  │ (ADC, sem API key) │  │    └──────────────────────────────────┘
│  └────────────────────┘  │
└──────────────────────────┘
```

---

## Princípios Arquiteturais

**BFF como único gateway**: SvelteKit é o único ponto de acesso ao PostgreSQL e ao mundo externo. FastAPI é um serviço interno sem endpoints públicos. Isso simplifica auth, rate limiting e auditoria — tudo em um lugar.

**Dois modos de IA**: O serviço AI opera em dois modos distintos. O chat (entrevistador) usa Vertex AI SDK diretamente com SSE turn-by-turn para baixa latência (~1-3s para first token). O pipeline de estimativa usa CrewAI com 6 agentes sequenciais, tolerando ~90-130s de execução assíncrona via Cloud Tasks.

**State no banco, não na sessão**: O state da entrevista vive no PostgreSQL (campo JSONB `interviews.state`), não em memória ou sessão. Cada turno de chat recebe o state atual, produz um novo state, e persiste. Isso permite retomar entrevistas após dias/semanas sem perda.

**Fallbacks graceful em dev**: Cada serviço externo tem um fallback local. Redis → PostgreSQL. Cloud Tasks → asyncio. GCS → filesystem local. Document AI → PyMuPDF/python-docx. Isso permite rodar o projeto inteiro sem custo em dev.

---

## Data Flows

### Flow 1: Entrevista Conversacional

```
User Message
    │
    ▼
BFF: auth → load interview + messages + docs → mount ChatRequest
    │
    ▼
AI: receive ChatRequest → build system prompt + history
    │
    ▼
Vertex AI (Gemini 2.5 Flash): streaming response
    │
    ▼
AI: parse response chunks → emit message_chunk events
    │
    ▼
AI: analyze state (LLM call) → emit state_update event
    │   state_update includes: new domains, maturity, open_questions, suggested_title
    │
    ▼
AI: emit done event → return SSE stream
    │
    ▼
BFF: parse events in real-time → persist message + state + maturity
    │
    ▼
Browser: render chunks progressively → update maturity bar
```

### Flow 2: Pipeline de Estimativa

```
User: "Gerar estimativa" (maturity ≥ 0.70)
    │
    ▼
BFF: create estimate (status=pending_approval) → persist
    │
    ▼
Admin: approve → BFF calls AI /estimate/run
    │
    ▼
AI: create job (status=pending) in state backend
    │
    ├── PROD: enqueue Cloud Tasks → /estimate/execute
    └── DEV:  asyncio background task → run_pipeline()
    │
    ▼
Pipeline (sequencial, ~90-130s):
    │
    ├─ 1. Architecture Interviewer → ConsolidatedRequirements
    │      (consolida requisitos da entrevista)
    │
    ├─ 2. RAG Analyst → SimilarProjectsResult
    │      (busca projetos similares via pgvector)
    │
    ├─ 3. Software Architect → ArchitectureDesign
    │      (propõe arquitetura, milestones, riscos)
    │
    ├─ 4. Cost Specialist → CostEstimate
    │      (3 cenários: conservador, moderado, otimista)
    │
    ├─ 5. Reviewer → ReviewResult
    │      (valida consistência + sumário executivo)
    │
    └─ 6. Knowledge Manager → KnowledgePrep
           (prepara texto para embedding futuro)
    │
    ▼
AI: assemble EstimateResult → update job (status=done)
    │
    ▼
BFF: polling GET /estimate/status → return result to browser
```

### Flow 3: Processamento de Documentos

```
User: upload file
    │
    ▼
BFF: save to GCS/local → call AI /chat/process-document
    │
    ▼
AI: detect MIME type → route to processor:
    ├─ PDF    → Document AI Layout Parser → fallback PyMuPDF
    ├─ DOCX   → Document AI Layout Parser → fallback python-docx
    ├─ XLSX   → openpyxl
    ├─ CSV    → pandas
    ├─ PPTX   → python-pptx
    ├─ Image  → Vertex AI Gemini Vision (multimodal)
    └─ URL    → httpx + BeautifulSoup4
    │
    ▼
BFF: persist extracted text → include in future chat context
```

---

## Database Schema

Três schemas PostgreSQL com separação clara de responsabilidades:

### `public` — Dados de negócio

```
users
  ├── id (uuid, PK)
  ├── firebase_uid (unique)
  ├── email, full_name, display_name
  ├── company, role
  ├── status (pending_verification | active | inactive)
  └── is_admin

interviews
  ├── id (uuid, PK)
  ├── user_id (FK → users)
  ├── title, status (active | completed | archived)
  ├── state (JSONB) ← domínios, respostas, open_questions
  ├── maturity (float)
  └── interview_messages (1:N)

estimates
  ├── id (uuid, PK)
  ├── interview_id (FK → interviews)
  ├── user_id (FK → users)
  ├── status (pending_approval | pending | running | done | failed)
  ├── job_id
  └── result (JSONB)

projects
  ├── id (uuid, PK)
  ├── estimate_id (FK → estimates)
  ├── user_id (FK → users)
  ├── milestones (1:N) → tasks (1:N)
  └── status
```

### `ai` — Dados do serviço de IA

```
knowledge_vectors
  ├── id (uuid, PK)
  ├── embedding (vector(768)) ← pgvector
  ├── content, source_type, source_id
  ├── metadata (JSONB)
  └── IVFFlat index

job_state
  ├── job_id (PK)
  ├── status, result (JSONB)
  └── (fallback para Redis em prod)

document_chunks
  ├── id (uuid, PK)
  ├── document_id, chunk_index
  └── content, embedding
```

### `audit` — Log imutável

```
event_log
  ├── id (bigserial, PK)
  ├── event_type (e.g. 'interview.created', 'estimate.triggered')
  ├── user_id, entity_type, entity_id
  ├── metadata (JSONB)
  └── created_at
```

---

## Decisões Arquiteturais (ADRs)

| ADR | Decisão | Motivação |
|---|---|---|
| ADR-01 | SvelteKit como BFF único | Centralizar auth + DB + proxy. Simplificar infra. |
| ADR-02 | FastAPI com dois modos (SSE + batch) | SSE para latência no chat, batch para pipeline pesado. |
| ADR-03 | pgvector (sem Qdrant) | Reduzir complexidade operacional. Um banco para tudo. |
| ADR-04 | Redis com fallback PG (sem MindsDB) | Redis para performance em prod, PG para custo zero em dev. |
| ADR-05 | Firebase Auth (sem Auth.js/Supabase) | Ecossistema Google integrado. Google One-Tap. |
| ADR-06 | GCP-only, sem VM, sem Docker Compose | Scale-to-zero com Cloud Run. Custo proporcional ao uso. |
| ADR-07 | pnpm + Turborepo | Monorepo eficiente com cache de build. |
| ADR-08 | Domínio único: oute.pro | Simplificar DNS, TLS e configuração. |
| ADR-09 | Vertex AI SDK + ADC (sem GEMINI_API_KEY) | Segurança via IAM, sem segredos em env vars. |
| ADR-10 | Cloud Tasks para jobs assíncronos | Retry automático, dead letter, observabilidade. |
| ADR-11 | Revisão do pipeline CrewAI | Findings e melhorias na orquestração dos agentes. |
| ADR-12 | Revisão arquitetural completa | 14 findings: 3 CRITICAL, 7 WARNING, 4 INFO. |

Para detalhes completos dos ADRs 11 e 12, ver os documentos `.docx` em `docs/adr/`.

---

## Infraestrutura GCP

```
┌─────────────────────────────────────────────┐
│                  Cloud Run                   │
│                                             │
│  oute-web-[env]     oute-ai-[env]           │
│  (256Mi–512Mi)      (1Gi–2Gi)               │
│  min=0 (scale       min=0 (scale            │
│   to zero)           to zero)               │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  Cloud SQL (PostgreSQL 16 + pgvector)       │
│  ├── dev: db-f1-micro / oute_develop        │
│  └── prod: db-g1-small / oute_production    │
│                                             │
│  Memorystore Redis (prod only)              │
│  └── BASIC 1GB                              │
│                                             │
│  Cloud Storage                              │
│  ├── oute-dev-uploads                       │
│  └── oute-prod-uploads                      │
│                                             │
│  Cloud Tasks (prod only)                    │
│  └── estimate-pipeline queue                │
│                                             │
│  Vertex AI                                  │
│  ├── gemini-2.5-flash (chat)                │
│  ├── gemini-2.5-flash-lite (batch/CrewAI)   │
│  └── text-multilingual-embedding-002        │
│                                             │
│  Firebase Auth                              │
│  └── Identity Platform                      │
│                                             │
│  Secret Manager                             │
│  └── Firebase keys, DB credentials          │
│                                             │
└─────────────────────────────────────────────┘
```

### Custos estimados

| Ambiente | Custo/mês |
|---|---|
| DEV | ~$0 (tudo scale-to-zero, sem Redis/Cloud Tasks) |
| PROD | ~$10–15 (Cloud SQL db-g1-small + Memorystore 1GB) |

### CI/CD

7 GitHub Actions workflows:

| Workflow | Trigger | Ação |
|---|---|---|
| `1-pull-request.yml` | PR aberto | Lint + type check + test |
| `deploy-dev.yml` | Push `develop` | Build + deploy Cloud Run dev |
| `deploy-prod.yml` | Push `main` | Build + deploy Cloud Run prod |
| `migrate-db-dev.yml` | Manual/push | Migrations no banco dev |
| `migrate-db-prod.yml` | Manual/push | Migrations no banco prod |
| `5-security-scan.yml` | Scheduled | Scan de segurança |
| `6-dependency-check.yml` | Scheduled | Check de deps desatualizadas |

---

## Segurança

**Autenticação**: Firebase Auth no client → Firebase Admin SDK no BFF. Tokens validados em cada request via `hooks.server.ts`.

**Autorização**: Role-based. `users.is_admin` para endpoints admin. Cada recurso (interview, estimate, project) tem `user_id` — queries sempre filtram por owner.

**Rate limiting**: Por endpoint e por usuário. Implementado em `rate-limit.ts`.

**Auditoria**: Eventos de negócio logados em `audit.event_log` (imutável).

**Secrets**: Firebase keys e DB credentials em GCP Secret Manager. Vertex AI usa ADC (IAM), sem API keys.

**Headers de segurança**: CSP, X-Frame-Options, X-Content-Type-Options via middleware.

**Cloud Tasks auth**: Endpoints `/estimate/execute` e `/health/reindex` protegidos por header `X-CloudTasks-QueueName` + OIDC token validation em produção.

---

## Known Issues e Dívida Técnica

Documentados no ADR-12 (14 findings):

| Severidade | Finding | Status |
|---|---|---|
| CRITICAL | F-01: RAG self-contamination | Plano em `PLAN-architecture-fixes.md` |
| CRITICAL | F-02: State analysis sem ground truth | Plano em `PLAN-architecture-fixes.md` |
| CRITICAL | F-03: Redis race condition | Plano em `PLAN-architecture-fixes.md` |
| WARNING | 7 findings | Ver ADR-12 |
| INFO | 4 findings | Ver ADR-12 |

Planos de correção detalhados em `docs/plans/`.
