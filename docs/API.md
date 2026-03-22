# API Reference — oute.me

Toda comunicação externa passa pelo BFF SvelteKit (`apps/web`). O serviço FastAPI (`apps/ai`) é interno e nunca exposto diretamente. Todos os endpoints BFF requerem autenticação Firebase (token Bearer no header `Authorization`).

---

## Autenticação

```
Authorization: Bearer <firebase_id_token>
```

O hook `hooks.server.ts` valida o token Firebase Admin SDK, resolve o `dbUser` e injeta em `locals`. Endpoints sem token válido retornam `401`.

Rate limiting por endpoint (configurado em `rate-limit.ts`):

- Chat: 1 request por vez por usuário
- APIs gerais: limites configuráveis por rota

---

## BFF — SvelteKit (`apps/web`)

### Interviews

#### `POST /api/interviews`

Cria uma nova entrevista.

**Request body:**
```json
{
  "title": "Meu projeto mobile"  // opcional
}
```

**Response (201):**
```json
{
  "interview": {
    "id": "uuid",
    "title": "Meu projeto mobile",
    "status": "active",
    "state": {},
    "maturity": 0
  }
}
```

#### `GET /api/interviews`

Lista entrevistas do usuário autenticado.

**Response:**
```json
{
  "interviews": [
    { "id": "uuid", "title": "...", "status": "active", "maturity": 0.45, "created_at": "..." }
  ]
}
```

#### `GET /api/interviews/[id]`

Retorna detalhes de uma entrevista, incluindo `state` completo e `maturity`.

---

### Chat (SSE Streaming)

#### `POST /api/chat/[id]/message`

Envia mensagem ao entrevistador IA e retorna resposta via SSE.

**Request body:**
```json
{
  "message": "Preciso de um app mobile para delivery",
  "tone_instruction": "formal",           // opcional
  "llm_model": "gemini-2.5-flash"         // opcional, default
}
```

**Response**: `Content-Type: text/event-stream`

Eventos SSE:

```
event: message_chunk
data: {"text": "Entendi! Vamos explorar...", "interview_id": "uuid"}

event: state_update
data: {
  "state": { "domains": {...}, "responses": {...} },
  "maturity": 0.45,
  "suggested_title": "App Delivery Mobile"
}

event: title_update
data: {"title": "App Delivery Mobile"}

event: done
data: {"full_response": "...", "tokens_used": 312, "message_id": "uuid"}

event: error
data: {"error": "Stream timeout"}
```

**Fluxo interno**: BFF autentica → carrega interview + mensagens recentes + documentos → monta `ChatRequest` → proxy SSE para FastAPI `/chat/message` → parseia eventos em tempo real → persiste mensagem + state atualizado no banco → repassa stream ao cliente.

**Timeout**: 5 minutos (SSE_TIMEOUT_MS).

#### `POST /api/chat/[id]/upload`

Upload de documento para extração de texto.

**Request**: `multipart/form-data` com campo `file`.

Tipos suportados: PDF, DOCX, XLSX, CSV, PPTX, imagens (PNG/JPG), URLs.

**Response:**
```json
{
  "document": {
    "id": "uuid",
    "filename": "requisitos.pdf",
    "status": "completed",
    "extracted_text": "..."
  }
}
```

#### `GET /api/chat/[id]/documents/[docId]`

Retorna detalhes de um documento processado.

---

### Estimates

#### `POST /api/estimates`

Solicita estimativa para uma entrevista. Requer `maturity ≥ 0.70`.

**Request body:**
```json
{
  "interview_id": "uuid"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "status": "pending_approval"
}
```

Fluxo: cria estimate em `pending_approval` → admin aprova → pipeline CrewAI inicia → status evolui para `pending` → `running` → `done` | `failed`.

#### `GET /api/estimates/[id]`

Retorna status e resultado da estimativa. Polling recomendado a cada 5s durante `running`.

**Response (running):**
```json
{
  "id": "uuid",
  "status": "running",
  "agent_steps": [
    { "agent_key": "architecture_interviewer", "status": "done", "duration_s": 18.5 },
    { "agent_key": "rag_analyst", "status": "running" },
    { "agent_key": "software_architect", "status": "pending" },
    { "agent_key": "cost_specialist", "status": "pending" },
    { "agent_key": "reviewer", "status": "pending" },
    { "agent_key": "knowledge_manager", "status": "pending" }
  ]
}
```

**Response (done):**
```json
{
  "id": "uuid",
  "status": "done",
  "result": {
    "summary": "Complexidade: high. 12 requisitos funcionais identificados",
    "architecture_overview": "...",
    "milestones": [
      { "name": "MVP", "duration_weeks": 4, "deliverables": [...], "dependencies": [] }
    ],
    "cost_scenarios": [
      { "name": "conservador", "total_hours": 800, "hourly_rate": 150, "total_cost": 120000, "duration_weeks": 16, "team_size": 4, "confidence": 0.85 },
      { "name": "moderado", "total_hours": 600, "hourly_rate": 150, "total_cost": 90000, "duration_weeks": 12, "team_size": 3, "confidence": 0.75 },
      { "name": "otimista", "total_hours": 450, "hourly_rate": 150, "total_cost": 67500, "duration_weeks": 10, "team_size": 3, "confidence": 0.60 }
    ],
    "tech_recommendations": [...],
    "risks": [...],
    "similar_projects": [...],
    "executive_summary": "...",
    "validation": { "is_consistent": true, "issues_found": [], "adjustments_made": [] }
  },
  "agent_steps": [...]
}
```

#### `POST /api/estimates/[id]/approve`

Admin aprova e dispara o pipeline.

#### `POST /api/estimates/[id]/rerun`

Re-executa pipeline, opcionalmente a partir de um agente específico (reutiliza outputs anteriores).

**Request body:**
```json
{
  "from_agent": "cost_specialist"  // opcional — re-roda a partir deste agente
}
```

---

### Projects

#### `POST /api/projects`

Cria projeto a partir de uma estimativa aprovada.

#### `GET /api/projects`

Lista projetos do usuário.

#### `GET /api/projects/[id]`

Retorna projeto com milestones e tasks.

#### `PUT /api/projects/[id]`

Atualiza projeto.

#### `PUT /api/projects/[id]/milestones/[milestoneId]`

Atualiza milestone (status, datas).

#### `POST /api/projects/[id]/milestones/[milestoneId]/tasks`

Adiciona/gerencia tasks de um milestone.

---

### Tones

#### `GET /api/tones`

Lista tons de conversação disponíveis.

#### `GET /api/tones/active`

Retorna o tom ativo do usuário.

---

### Users

#### `GET /api/users/me`

Retorna perfil do usuário autenticado.

#### `POST /api/auth/session`

Gerencia sessão Firebase.

---

### Admin

Endpoints administrativos (requerem role `admin`):

- `GET/POST /api/admin/users` — Gerenciar usuários
- `GET/POST /api/admin/agents` — CRUD de configuração de agentes
- `/api/admin/knowledge/*` — Gerenciar base de conhecimento
- `/api/admin/cockpit/*` — Dashboards administrativos

---

## AI Service — FastAPI (`apps/ai`) — Interno

Estes endpoints são chamados exclusivamente pelo BFF via `proxySSE()` e `ai-client.ts`. Nunca expostos publicamente.

### `POST /chat/message`

Processa mensagem do entrevistador. Retorna SSE.

**Request body** (`ChatRequest`):
```json
{
  "interview_id": "uuid",
  "state": {
    "project_type": "new",
    "setup_confirmed": true,
    "domains": {
      "scope": { "answered": 3, "total": 8, "vital_answered": true }
    },
    "responses": {},
    "open_questions": [],
    "documents_processed": [],
    "conversation_summary": "",
    "last_questions_asked": []
  },
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "user_message": "Preciso de um app mobile",
  "documents_context": "[requisitos.pdf]: ...",
  "tone_instruction": "formal",
  "is_resumption": false,
  "llm_model": "gemini-2.5-flash",
  "current_title": null,
  "user_name": "Bardi"
}
```

**SSE events**: `message_chunk`, `state_update`, `done`, `error`.

### `POST /chat/process-document`

Extrai texto de arquivo uploaded. `multipart/form-data`.

### `POST /chat/extract-url`

Extrai texto de uma URL.

**Request:** `{ "url": "https://..." }`

**Response:** `{ "extracted_text": "...", "url": "...", "status": "completed" }`

### `POST /estimate/run`

Inicia pipeline de estimativa. Cria job no state backend, enfileira Cloud Tasks (prod) ou background task (dev).

**Request** (`EstimateRequest`):
```json
{
  "interview_id": "uuid",
  "state": {},
  "conversation_summary": "...",
  "documents_context": "...",
  "llm_model": "gemini-2.5-flash",
  "agent_instructions": {},
  "agent_config": {}
}
```

**Response:** `{ "job_id": "uuid", "status": "pending" }`

### `POST /estimate/execute`

Handler exclusivo do Cloud Tasks. Executa o pipeline CrewAI sincronamente. Protegido por header `X-CloudTasks-QueueName` + OIDC token em produção.

### `GET /estimate/status/{job_id}`

Retorna status do job + agent steps + resultado parcial/final.

### `GET /estimate/status/{job_id}/agent/{agent_key}`

Retorna output completo de um agente específico (para admin cockpit).

### `POST /estimate/rerun`

Re-executa pipeline, opcionalmente reutilizando outputs de agentes anteriores.

### `POST /knowledge/embed`

Embeda conteúdo da base de conhecimento admin no pgvector.

**Request:** `{ "id": "...", "content": "...", "metadata": {} }`

### `GET /health/services`

Health check de PostgreSQL, Redis e Vertex AI.

**Response:**
```json
{
  "postgres": "ok",
  "redis": "not_configured",
  "vertex_ai": "ok (project=oute-488706, location=us-central1)"
}
```

### `POST /health/reindex`

Dispara `REINDEX CONCURRENTLY` no índice IVFFlat de vetores. Protegido por header Cloud Tasks.

---

## Pipeline de Estimativa — Agentes CrewAI

Execução sequencial, ~90–130s:

| # | Agente | Output Model | Função |
|---|---|---|---|
| 1 | `architecture_interviewer` | `ConsolidatedRequirements` | Consolida requisitos técnicos da entrevista |
| 2 | `rag_analyst` | `SimilarProjectsResult` | Busca projetos similares via pgvector |
| 3 | `software_architect` | `ArchitectureDesign` | Propõe arquitetura, milestones, riscos |
| 4 | `cost_specialist` | `CostEstimate` | Gera 3 cenários de custo (conservador/moderado/otimista) |
| 5 | `reviewer` | `ReviewResult` | Valida consistência + sumário executivo |
| 6 | `knowledge_manager` | `KnowledgePrep` | Prepara dados para embedding no pgvector |

LLM dos agentes: `vertex_ai/gemini-2.5-flash-lite` (via LiteLLM + ADC).

---

## Maturity Score

Calculado por domínio com pesos:

| Domínio | Peso | Vital |
|---|---|---|
| scope | 30% | Sim |
| timeline | 20% | Sim |
| budget | 20% | Sim |
| integrations | 15% | Não |
| tech_stack | 15% | Sim |

Fórmula: `Σ(weight × min(answered/total, 1.0))`. Se algum domínio vital não tem `vital_answered`, aplica penalidade de 15% (`score × 0.85`).

Threshold para estimativa: **maturity ≥ 0.70** + aprovação explícita do usuário.

---

## Códigos de Erro Comuns

| Status | Contexto | Significado |
|---|---|---|
| 401 | Qualquer endpoint | Token Firebase inválido/expirado |
| 403 | Admin endpoints | Usuário não tem role admin |
| 404 | Interview/Estimate/Project | Recurso não encontrado ou não pertence ao usuário |
| 400 | `POST /api/estimates` | Maturity < 0.70 ou entrevista não ativa |
| 429 | Chat | Rate limit excedido |
| 502 | Chat SSE | AI service indisponível |
