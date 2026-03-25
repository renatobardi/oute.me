# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão Geral

Plataforma SaaS de estimativa de projetos de software com IA.
Fluxo central: **Interview → Estimate → Project** (máquina de estados).
Repositório: `github.com/renatobardi/oute.me` | GCP Project: `oute-488706` | Domínio: `oute.pro`

## Comandos de Desenvolvimento

### Build, lint, test (monorepo inteiro via Turborepo)
```bash
pnpm build              # turbo run build (ui → web)
pnpm lint               # turbo run lint (TS/Svelte)
pnpm test               # turbo run test (vitest nos workspaces)
pnpm check              # turbo run check (svelte-check)
```

### Python (apps/ai) — sempre com `uv`
```bash
pnpm lint:py            # ruff check src/ tests/
pnpm format:py          # ruff format src/ tests/
pnpm test:py            # pytest (asyncio_mode=auto)
pnpm typecheck:py       # mypy src/ (strict)
```

### Executar um único teste
```bash
# TypeScript (vitest) — de dentro do workspace
cd apps/web && pnpm exec vitest run src/lib/server/auth.test.ts
cd packages/ui && pnpm exec vitest run src/lib/Button.test.ts

# Python (pytest)
cd apps/ai && uv run pytest tests/test_chat.py -k "test_name"
```

### Dev servers
```bash
pnpm dev                # inicia web (:5173) + ai (:8000) via turbo
```

### Database
```bash
pnpm migrate            # roda migrations pendentes
pnpm migrate:status     # mostra status das migrations
pnpm migrate:dry        # dry-run de migrations
```

### E2E (Playwright — em tests/e2e/)
```bash
pnpm seed:e2e           # gera seed data via Playwright
cd tests/e2e && pnpm test          # roda todos os testes
cd tests/e2e && pnpm test:headed   # com browser visível
cd tests/e2e && pnpm test:debug    # modo debug
```

### Adicionar dependências
```bash
# Node (workspace-specific)
pnpm --filter @oute/web add <pkg>
pnpm --filter @oute/ui add -D <pkg>

# Python
cd apps/ai && uv add <pkg>
cd apps/ai && uv add --dev <pkg>
```

## Arquitetura

### Monorepo (pnpm workspaces + Turborepo)
- `apps/web/` — SvelteKit 5 BFF + frontend (porta 5173 dev)
- `apps/ai/` — FastAPI serviço de IA (porta 8000 dev)
- `packages/ui/` — Design System `@oute/ui` (componentes Svelte)
- `database/` — Migrations SQL (000–022) + seed data
- `tests/e2e/` — Playwright E2E tests

### Request Flow
1. Browser → SvelteKit (auth via Firebase session cookie / Bearer token)
2. SvelteKit hooks (`hooks.server.ts`) → `sequence(blockRunAppUrl, redirectWww, rateLimit, authenticate, gateUser, cacheControl, securityHeaders)`
3. `+page.server.ts` / `+server.ts` → queries PostgreSQL diretas (`$lib/server/db.ts`, driver `postgres`)
4. Para IA: SvelteKit proxy → FastAPI (`$lib/server/ai-client.ts`) via SSE ou JSON
5. FastAPI acessa apenas schemas `ai.*` no PostgreSQL (via `asyncpg`)

### Auth Flow
- Client: Firebase Auth (JS SDK) → obtém ID token
- Server: `verifyAuthToken()` em `$lib/server/auth.ts` — tenta Bearer header primeiro, depois cookie `__session`
- User sync: `getOrCreateUser()` cria/atualiza registro em `public.users` após validação Firebase
- Admin check: `isAdminEmail()` verifica se email é admin

### BFF ↔ AI Service Communication
- `$lib/server/ai-client.ts` — proxy com auto-auth via GCP metadata token (prod) ou sem auth (dev local)
- SSE: `proxySSEGet()` / `proxySSEPost()` para streaming de chat
- JSON: `proxyPost()` / `proxyGet()` para chamadas síncronas
- AI routers: `chat.py`, `estimate.py`, `knowledge.py`, `admin.py`, `health.py`

### Database Access Pattern
- `$lib/server/db.ts` — singleton `postgres` connection, `withTransaction()` helper
- Sem ORM — queries SQL tagged template literals: `` sql`SELECT * FROM users WHERE id = ${id}` ``
- Server modules em `$lib/server/` (interviews.ts, estimates.ts, projects.ts, etc.) encapsulam queries por domínio

## Regras de Arquitetura (NUNCA violar)

1. **SvelteKit é o ÚNICO gateway para PostgreSQL.** FastAPI acessa o banco somente para vetores (`ai.*`) e resultados de estimativa.
2. **FastAPI é interno.** Todo acesso externo passa pelo BFF SvelteKit, que autentica via Firebase antes de proxy.
3. **CrewAI SOMENTE no pipeline batch de estimativa.** Chat de entrevista usa Vertex AI SDK direto (baixa latência SSE).
4. **Sem Docker Compose, sem VM.** Dev e prod rodam em Cloud Run (scale-to-zero).
5. **Sem Qdrant.** Busca vetorial via pgvector no PostgreSQL.
6. **Auth exclusivamente via Firebase Admin SDK** no servidor. Nunca ler/escrever sessão de auth diretamente no banco.
7. **oute.pro é o único domínio.** CNAME → `ghs.googlehosted.com`, TLS GCP.
8. **Vertex AI via ADC.** Sem GEMINI_API_KEY. Cloud Run usa Service Account automaticamente.

## Convenções de Código

### Geral
- `pnpm` — nunca npm ou yarn
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
- `mypy` strict — sem `# type: ignore` sem justificativa
- `pydantic v2` para validação (Settings, request/response models)
- Async nativo — `async def` em todos os handlers
- pytest com `asyncio_mode = "auto"`

## Schemas do Banco

- `public` — users, interviews, interview_messages, documents, estimates, estimate_runs, projects, milestones, tasks, conversation_tones, user_activation, rate_limits
- `ai` — knowledge_vectors (pgvector), job_state, document_chunks, agent_instructions, agent_config
- `audit` — event_log (imutável)

### Maturity Score (gate para estimativa)
| Domínio | Peso | Vital |
|---|---|---|
| scope | 30% | Sim |
| timeline | 20% | Sim |
| budget | 20% | Sim |
| integrations | 15% | Não |
| tech_stack | 15% | Sim |

Threshold: maturity ≥ 0.70 + aprovação explícita do usuário.

## Agentes IA

### Entrevistador (conversacional — NÃO usa CrewAI)
- Vertex AI SDK direto, SSE turn-by-turn
- State em `interviews.state` (JSONB), não na sessão
- A cada turno: recebe state + histórico resumido + mensagem → atualiza domains, responses, maturity

### Pipeline de Estimativa (batch — CrewAI + Cloud Tasks)
Sequencial (~90–130s): architecture_interviewer → rag_analyst → software_architect → cost_specialist → reviewer → knowledge_manager
LLM: `vertex_ai/gemini-2.5-flash-lite` (via LiteLLM + ADC)

## Findings Críticos (ADR-12)

- **F-01 CRITICAL**: RAG self-contamination — knowledge_manager embeda sem validação de qualidade
- **F-02 CRITICAL**: State analysis sem ground truth — maturity scoring via LLM sem baseline determinístico
- **F-03 CRITICAL**: Redis race condition — estado de jobs sem lock distribuído

## Referências Rápidas

- **API completa**: `docs/API.md`
- **Arquitetura**: `docs/ARCHITECTURE.md`
- **Onboarding**: `docs/ONBOARDING.md`
- **Config/env vars**: `apps/ai/src/config.py` (classe `Settings`)
- **Agents YAML**: `apps/ai/src/crew/agents.yaml`
- **Tasks YAML**: `apps/ai/src/crew/tasks.yaml`
- **Theme tokens**: `packages/ui/src/theme/theme.css`
- **ADRs**: `docs/adr/` (ADR-11: CrewAI pipeline, ADR-12: revisão arquitetural)
