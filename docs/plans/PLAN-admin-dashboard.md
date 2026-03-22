# PLAN — Admin Dashboard & Observability Cockpit

> **Autor:** Claude (co-authored com Bardi)
> **Data:** 2026-03-22
> **Status:** Draft
> **Escopo:** Revisão completa da área /admin com foco em observabilidade do pipeline de agentes

---

## 1. Diagnóstico do Estado Atual

### 1.1 O que existe hoje

| Seção | Rota | Descrição | Linhas |
|-------|------|-----------|--------|
| Cockpit | `/admin/cockpit` | Lista de entrevistas + detail panel com 9 tabs | 1776 |
| Usuários | `/admin/usuarios` | CRUD de usuários | 436 |
| Knowledge | `/admin/knowledge` | Base de conhecimento admin | ~150 |
| Agentes | `/admin/agents` | Edição de prompts dos agentes | ~250 |

### 1.2 Problemas Identificados

| ID | Severidade | Problema | Impacto |
|----|-----------|----------|---------|
| D-01 | CRITICAL | **Zero visão agregada** — Não existe overview/dashboard. Para entender o estado do sistema, é preciso clicar entrevista por entrevista. | Admin não tem situational awareness. Problemas passam despercebidos. |
| D-02 | CRITICAL | **Pipeline é caixa preta** — Output dos agentes renderizado como JSON bruto (`JSON.stringify`). Sem formatação, sem diff entre runs. | Impossível diagnosticar problemas de qualidade dos agentes rapidamente. |
| D-03 | HIGH | **Sem real-time** — Pipeline usa polling manual (refresh da página). Sem SSE/WebSocket para o admin. | Admin não sabe quando pipeline termina sem ficar dando F5. |
| D-04 | HIGH | **Histórico de runs flat** — Cada run é uma linha com status+modelo+duração. Sem comparação entre runs. | Impossível entender evolução/regressão entre re-runs. |
| D-05 | HIGH | **Cockpit monolítico** — 1776 linhas em um único `.svelte`. Lista, detalhe, pipeline, mensagens, vetores, modais, tudo junto. | Manutenção arriscada, impossível evoluir sem refatorar. |
| D-06 | MEDIUM | **Entrevistador invisível** — Maturity evolui por turno, mas admin não visualiza progressão temporal. | Sem entender onde o entrevistador trava ou acelera. |
| D-07 | MEDIUM | **Audit log inexplorado** — `audit.event_log` tem eventos ricos mas nenhuma tela consome. | Dados valiosos para métricas desperdiçados. |
| D-08 | MEDIUM | **Sem métricas de token/custo** — `tokens_used` existe em messages, métricas emitidas para Cloud Monitoring, mas zero visualização no admin. | Sem controle de custos operacionais. |
| D-09 | LOW | **Sem health check visual** — `/health/services` retorna JSON. Admin precisa de curl para ver status dos serviços. | Operação manual para diagnóstico básico. |

---

## 2. Visão do Novo Admin

### 2.1 Arquitetura de Navegação Proposta

```
/admin
├── /dashboard          ← NOVO: Overview com métricas, funil, health
├── /cockpit            ← REFATORADO: Interview drill-down (componentizado)
│   └── /[id]           ← NOVO: Rota dedicada por entrevista
│       ├── /pipeline   ← NOVO: Pipeline view detalhado
│       └── /runs       ← NOVO: Comparação de runs
├── /pipeline           ← NOVO: Visão cross-interview de todos os pipelines
├── /agents             ← EXISTENTE + melhorias
├── /knowledge          ← EXISTENTE (sem mudanças)
├── /usuarios           ← EXISTENTE (sem mudanças)
└── /audit              ← NOVO: Timeline de eventos do sistema
```

### 2.2 Componentes Novos

| Componente | Descrição | Prioridade |
|------------|-----------|------------|
| `AdminDashboard` | KPIs, funil, health, alertas | P0 |
| `PipelineMonitor` | Visão real-time de todos os pipelines ativos | P0 |
| `AgentStepCard` | Output formatado por tipo de agente (não JSON bruto) | P0 |
| `RunComparison` | Side-by-side de duas runs (diff visual) | P1 |
| `MaturityTimeline` | Gráfico de progressão de maturity ao longo dos turnos | P1 |
| `AuditTimeline` | Timeline de eventos do sistema filtráveis | P2 |
| `CostTracker` | Tokens usados × custo estimado por modelo | P2 |
| `ServiceHealth` | Widget de status dos serviços (PG, Redis, Vertex) | P1 |

---

## 3. Fases de Implementação

### Fase 1 — Fundação & Refatoração (Sprint 1-2)

**Objetivo:** Tornar o cockpit evoluível e criar a estrutura de dashboard.

#### 1.1 Decomposição do Cockpit Monolítico

O arquivo `cockpit/+page.svelte` (1776 linhas) precisa ser decomposto em componentes reutilizáveis:

```
apps/web/src/lib/components/admin/
├── InterviewList.svelte          ← Lista lateral com filtros
├── InterviewDetail.svelte        ← Container do detalhe
├── tabs/
│   ├── UserTab.svelte            ← Info do usuário
│   ├── ProjectTab.svelte         ← Detalhes do projeto
│   ├── DocumentsTab.svelte       ← Lista de documentos
│   ├── MessagesTab.svelte        ← Conversa com paginação
│   ├── VectorsTab.svelte         ← Knowledge vectors
│   ├── EstimateTab.svelte        ← Status da estimativa
│   ├── PipelineTab.svelte        ← Stepper + output dos agentes
│   └── ProjectGeneratedTab.svelte← Projeto gerado
├── pipeline/
│   ├── PipelineStepper.svelte    ← Visual stepper com estados
│   ├── AgentStepCard.svelte      ← Output formatado por agente
│   └── RunHistoryList.svelte     ← Histórico de runs
├── DomainProgress.svelte         ← Barra de progresso dos domínios
├── RerunModal.svelte             ← Modal de re-run
└── StatusBadge.svelte            ← Badge de status reutilizável
```

**Critério de aceite:** Cockpit funciona identicamente ao atual, mas em componentes isolados. Zero regressão visual.

#### 1.2 Rota Dedicada por Entrevista

Migrar de seleção lateral para rota dedicada:
- `/admin/cockpit` → Lista
- `/admin/cockpit/[id]` → Detalhe com tabs
- `/admin/cockpit/[id]/pipeline` → Pipeline view dedicado

**Razão:** Permite deep linking, compartilhar URL de uma entrevista específica, e back/forward do browser.

#### 1.3 Novos Endpoints de Agregação (BFF)

```typescript
// apps/web/src/lib/server/admin-dashboard.ts

// KPIs globais
getAdminDashboardMetrics(): Promise<{
  users: { total, active, onboarded, signups_last_7d }
  interviews: { total, active, mature, avg_maturity, avg_messages }
  estimates: { total, done, failed, pending, avg_duration_s, failure_rate }
  projects: { total, active, avg_cost, avg_hours }
}>

// Funil de conversão
getConversionFunnel(period?: '7d' | '30d' | '90d'): Promise<{
  interviews_created: number
  maturity_reached: number    // maturity >= 0.70
  estimates_triggered: number
  estimates_completed: number
  estimates_approved: number
  projects_created: number
}>

// Pipelines ativos (running ou pending)
getActivePipelines(): Promise<Array<{
  job_id: string
  interview_id: string
  interview_title: string
  user_email: string
  status: string
  agent_steps: AgentStep[]
  started_at: string
  elapsed_s: number
}>>

// Métricas de agentes (agregado)
getAgentPerformanceMetrics(period?: '7d' | '30d'): Promise<Array<{
  agent_key: string
  runs: number
  avg_duration_s: number
  p95_duration_s: number
  failure_rate: number
  avg_output_size: number
}>>
```

**Queries SQL necessárias:**

```sql
-- Funil de conversão (últimos 30 dias)
SELECT
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS interviews_created,
  COUNT(*) FILTER (WHERE maturity >= 0.70 AND created_at >= NOW() - INTERVAL '30 days') AS maturity_reached
FROM interviews;

SELECT
  COUNT(*) FILTER (WHERE status IN ('done','pending_approval','approved')) AS estimates_completed,
  COUNT(*) FILTER (WHERE status = 'failed') AS estimates_failed
FROM estimates WHERE created_at >= NOW() - INTERVAL '30 days';

-- Performance dos agentes (via estimate_runs.agent_steps JSONB)
SELECT
  step->>'agent_key' AS agent_key,
  COUNT(*) AS runs,
  AVG((step->>'duration_s')::float) AS avg_duration_s,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (step->>'duration_s')::float) AS p95_duration_s,
  COUNT(*) FILTER (WHERE step->>'status' = 'failed')::float / COUNT(*) AS failure_rate
FROM estimate_runs, jsonb_array_elements(agent_steps) AS step
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY step->>'agent_key';
```

---

### Fase 2 — Dashboard & Real-Time (Sprint 3-4)

**Objetivo:** Visão agregada e atualizações em tempo real.

#### 2.1 Página Dashboard (`/admin/dashboard`)

**Layout:** Grid de 3 colunas no topo (KPIs), funil no meio, pipelines ativos + alertas na metade inferior.

**Seção 1 — KPI Cards (topo)**
- Usuários ativos (com sparkline 7d)
- Entrevistas maduras (≥70%) / total
- Taxa de sucesso do pipeline (done / total)
- Custo médio estimado (média do cenário moderado)

**Seção 2 — Funil de Conversão**
- Barras horizontais: Entrevistas → Maduras → Estimativas → Aprovadas → Projetos
- Taxas de conversão entre cada etapa
- Filtro por período (7d / 30d / 90d)

**Seção 3 — Pipelines Ativos**
- Lista de pipelines em running/pending com stepper inline
- Auto-refresh via polling 5s (fase 2) ou SSE (fase 3)
- Tempo decorrido em real-time (client-side timer)
- Botão para drill-down na entrevista

**Seção 4 — Alertas / Atenção**
- Pipelines falhados nas últimas 24h
- Entrevistas paradas >48h sem atividade
- Jobs em estado "running" >5min (possível stale)

#### 2.2 SSE Admin Channel

**Backend (FastAPI):**

```python
# apps/ai/src/routers/admin.py (NOVO)

@router.get("/admin/pipeline-events")
async def pipeline_events(request: Request):
    """SSE stream com eventos de pipeline para o admin dashboard."""
    async def event_generator():
        pubsub = redis.pubsub()
        await pubsub.subscribe("admin:pipeline_events")
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    yield {"event": "pipeline_update", "data": message["data"]}
        finally:
            await pubsub.unsubscribe("admin:pipeline_events")

    return EventSourceResponse(event_generator())
```

**Publisher (no estimate_runner.py):**

```python
# Após cada update_agent_steps:
await redis.publish("admin:pipeline_events", json.dumps({
    "type": "agent_step_complete",
    "job_id": job_id,
    "interview_id": interview_id,
    "agent_key": agent_key,
    "status": "done",
    "duration_s": duration,
    "timestamp": datetime.utcnow().isoformat()
}))
```

**Frontend:**
- EventSource no dashboard conectando via BFF proxy
- Atualiza cards de pipeline ativo em real-time
- Toast/notification quando pipeline completa ou falha

#### 2.3 Service Health Widget

- Polling a cada 30s de `GET /health/services` via BFF
- Indicadores: PostgreSQL ●, Redis ●, Vertex AI ●
- Verde = ok, Amarelo = degraded, Vermelho = error
- Fixo no header do admin (visível em todas as páginas)

---

### Fase 3 — Pipeline Intelligence (Sprint 5-6)

**Objetivo:** Visibilidade profunda nos agentes e seus outputs.

#### 3.1 Agent Output Formatado

Substituir `JSON.stringify` por renderers específicos por tipo de agente:

| Agent Key | Renderer | O que mostra |
|-----------|----------|--------------|
| `architecture_interviewer` | `RequirementsView` | Lista de requisitos agrupados por tipo (funcional, não-funcional, integração) com badges de complexidade |
| `rag_analyst` | `SimilarProjectsView` | Cards com nome, relevance_score (barra), benchmarks de mercado |
| `software_architect` | `ArchitectureView` | Overview em prosa + tabela de milestones + tech stack badges + risk matrix |
| `cost_specialist` | `CostScenariosView` | 3 cenários side-by-side com destaque do moderado, gráfico de barras comparativo |
| `reviewer` | `ReviewView` | Checklist de validação (✓/✗), issues encontradas, executive summary em callout |
| `knowledge_manager` | `KnowledgeView` | Preview do texto gerado para embedding + metadata tags |

**Componente base:**

```svelte
<!-- AgentStepCard.svelte -->
<script lang="ts">
  import RequirementsView from './renderers/RequirementsView.svelte';
  import SimilarProjectsView from './renderers/SimilarProjectsView.svelte';
  // ... demais renderers

  const RENDERERS: Record<string, Component> = {
    architecture_interviewer: RequirementsView,
    rag_analyst: SimilarProjectsView,
    software_architect: ArchitectureView,
    cost_specialist: CostScenariosView,
    reviewer: ReviewView,
    knowledge_manager: KnowledgeView,
  };

  let { agentKey, output, step } = $props();
  const Renderer = $derived(RENDERERS[agentKey]);
</script>

{#if Renderer}
  <svelte:component this={Renderer} data={output} {step} />
{:else}
  <pre>{JSON.stringify(output, null, 2)}</pre>
{/if}
```

#### 3.2 Run Comparison (Diff View)

Quando existem múltiplas runs para uma estimativa:

- Selector de "Run A" vs "Run B" (por data/modelo)
- Para cada agente, mostra diff lado a lado:
  - Campos que mudaram highlighted
  - Delta de duração (mais rápido/lento)
  - Delta de custo nos cenários
- Summary no topo: "3 agentes com diferenças, custo total variou X%"

**Endpoint necessário:**

```typescript
// GET /api/admin/cockpit/interviews/[id]/runs/compare?a={runId}&b={runId}
compareRuns(interviewId: string, runA: string, runB: string): Promise<{
  run_a: EstimateRun
  run_b: EstimateRun
  diffs: Record<string, { changed: boolean, fields: string[] }>
}>
```

#### 3.3 Pipeline Cross-Interview (`/admin/pipeline`)

Visão de todos os pipelines (não filtrado por entrevista):

- Tabela: Interview | Status | Modelo | Duração | Agente Atual | Criado em
- Filtros: status (running/done/failed), modelo LLM, período
- Heatmap de duração por agente (cores de verde a vermelho)
- Gráfico de tendência: duração média do pipeline nos últimos 30 dias
- Taxa de falha por agente (bar chart horizontal)

---

### Fase 4 — Entrevistador & Audit (Sprint 7-8)

**Objetivo:** Observabilidade do chat e trail de auditoria.

#### 4.1 Maturity Timeline

Para cada entrevista, gráfico de linha mostrando:
- Eixo X: turnos da conversa (mensagens)
- Eixo Y: maturity score (0-100%)
- Linhas secundárias: progresso por domínio
- Marcadores: documentos enviados, domínios vitais atingidos

**Dados necessários:** Hoje o `state` é sobrescrito a cada turno. Para ter timeline, precisamos de uma das seguintes estratégias:

**Opção A — Snapshot por turno (preferida):**
Criar tabela `public.interview_state_snapshots`:

```sql
CREATE TABLE public.interview_state_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id uuid REFERENCES interviews(id) ON DELETE CASCADE,
  message_id uuid REFERENCES interview_messages(id),
  turn_number int NOT NULL,
  maturity numeric(4,3) NOT NULL,
  domains jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_state_snapshots_interview ON interview_state_snapshots(interview_id, turn_number);
```

Alteração no `interviewer.py`: após `analyze_and_update_state()`, inserir snapshot via BFF callback.

**Opção B — Derivar do audit.event_log:**
Se o audit log já registra maturity a cada turno (verificar), podemos derivar sem nova tabela.

#### 4.2 Audit Timeline (`/admin/audit`)

- Timeline cronológica reversa de eventos do sistema
- Filtros: event_type, actor (usuário), resource_type, período
- Agrupamento por sessão de trabalho (cluster de eventos próximos)
- Eventos suportados:
  - `interview.created` / `interview.maturity_reached` / `interview.document_uploaded`
  - `estimate.triggered` / `estimate.completed` / `estimate.failed` / `estimate.approved`
  - `project.created`
  - `user.activated`

#### 4.3 Token/Cost Tracking

Dados já disponíveis:
- `interview_messages.tokens_used` — tokens por mensagem do chat
- Métricas `llm/tokens_used` emitidas no Cloud Monitoring

Dados a coletar:
- Tokens consumidos por agente no pipeline (hoje não é capturado — precisa de callback do LiteLLM)
- Custo estimado por modelo (tabela de preços Vertex AI)

**Widget de custo:**
- Total de tokens consumidos (chat + pipeline) por período
- Custo estimado em USD baseado em pricing do modelo
- Breakdown: chat vs pipeline, por agente
- Trend line últimos 30 dias

---

## 4. Priorização e Dependências

```
Fase 1 (Fundação)          Fase 2 (Dashboard)         Fase 3 (Intelligence)     Fase 4 (Audit)
─────────────────          ──────────────────          ─────────────────────     ──────────────
[1.1 Decomposição] ──────→ [2.1 Dashboard Page] ────→ [3.1 Agent Renderers]     [4.1 Maturity Timeline]
[1.2 Rotas dedicadas] ──→ [2.2 SSE Admin] ──────────→ [3.2 Run Comparison]      [4.2 Audit Timeline]
[1.3 Endpoints agreg.] ─→ [2.3 Health Widget]         [3.3 Pipeline X-interview] [4.3 Token Tracking]
                                                                                        │
                                                                                        ↓
                                                                    Requer: LiteLLM callback para tokens
```

### Estimativa de Esforço

| Fase | Escopo | Esforço | Risco |
|------|--------|---------|-------|
| Fase 1 | Refatoração + rotas + endpoints | 3-5 dias | Baixo (sem features novas, só reestruturação) |
| Fase 2 | Dashboard + SSE + health | 5-8 dias | Médio (SSE requer Redis pub/sub no admin) |
| Fase 3 | Renderers + diff + pipeline view | 5-8 dias | Médio (renderers dependem de output estável dos agentes) |
| Fase 4 | Timeline + audit + tokens | 4-6 dias | Alto (maturity timeline requer nova tabela + alteração no interviewer) |

**Total estimado: 17-27 dias úteis** (considerando 1 dev full-stack)

---

## 5. Decisões de Arquitetura

### 5.1 SSE vs Polling para Admin

| Critério | Polling (5s) | SSE (Redis Pub/Sub) |
|----------|-------------|---------------------|
| Complexidade | Baixa | Média |
| Latência | 0-5s | ~100ms |
| Carga no servidor | N requests/5s × pipelines ativos | 1 conexão persistente |
| Confiabilidade | Alta (stateless) | Média (reconexão necessária) |
| Recomendação | **Fase 2 starter** | **Fase 2 evolução** |

**Decisão:** Começar com polling inteligente (5s quando há pipelines ativos, 30s idle). Migrar para SSE quando Redis pub/sub estiver validado. Nunca WebSocket — SSE é suficiente e mais simples.

### 5.2 Dados no BFF vs FastAPI

Toda query de dashboard DEVE passar pelo BFF SvelteKit (regra de arquitetura). FastAPI só é consultado para:
- Status de pipeline em execução (job_state via state backend)
- SSE de eventos de pipeline
- Health check dos serviços

Agregações históricas (funil, métricas de agentes, audit) são queries diretas no PostgreSQL via BFF.

### 5.3 Componentes vs Novo Framework

Não introduzir nenhum framework de dashboarding (Grafana embeddado, Metabase, etc.). Razões:
- Admin é interno, baixo tráfego — complexidade não justifica
- Precisa de ações (re-run, editar agente) — ferramentas read-only não servem
- Stack já definida: SvelteKit 5 + CSS custom

Para gráficos, usar uma lib leve: `Chart.js` via CDN ou `layerchart` (lib Svelte nativa). Nada pesado.

---

## 6. Migrations Necessárias

### Migration 020: interview_state_snapshots

```sql
-- 020_interview_state_snapshots.sql
CREATE TABLE IF NOT EXISTS public.interview_state_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.interview_messages(id) ON DELETE SET NULL,
  turn_number int NOT NULL,
  maturity numeric(4,3) NOT NULL,
  domains jsonb NOT NULL DEFAULT '{}',
  open_questions jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_state_snapshots_interview_turn
  ON public.interview_state_snapshots(interview_id, turn_number);

COMMENT ON TABLE public.interview_state_snapshots IS
  'Snapshot do estado da entrevista após cada turno de conversa, para timeline de maturity no admin.';
```

### Migration 021: pipeline_token_usage (Fase 4)

```sql
-- 021_pipeline_token_usage.sql
CREATE TABLE IF NOT EXISTS public.pipeline_token_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_run_id uuid REFERENCES public.estimate_runs(id) ON DELETE CASCADE,
  agent_key text NOT NULL,
  llm_model text NOT NULL,
  input_tokens int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  total_tokens int GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  estimated_cost_usd numeric(10,6),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_token_usage_run ON public.pipeline_token_usage(estimate_run_id);
CREATE INDEX idx_token_usage_agent ON public.pipeline_token_usage(agent_key, created_at);

COMMENT ON TABLE public.pipeline_token_usage IS
  'Consumo de tokens por agente em cada run do pipeline de estimativa.';
```

---

## 7. Critérios de Aceite por Fase

### Fase 1
- [ ] Cockpit funciona identicamente ao atual, mas em componentes isolados (≤200 linhas cada)
- [ ] Rotas `/admin/cockpit/[id]` funcionam com deep linking
- [ ] Endpoints de agregação retornam dados corretos (validar com seeds)
- [ ] Zero regressão visual

### Fase 2
- [ ] Dashboard carrega em <2s com métricas reais
- [ ] Funil mostra conversão correta por período
- [ ] Pipelines ativos atualizam automaticamente (polling 5s)
- [ ] Health widget mostra status correto dos 3 serviços
- [ ] Admin recebe feedback visual quando pipeline completa/falha

### Fase 3
- [ ] Output de cada agente renderizado com componente específico (não JSON)
- [ ] Comparação de runs mostra diferenças claras
- [ ] Pipeline cross-interview filtra e ordena corretamente
- [ ] Heatmap de duração dos agentes legível e útil

### Fase 4
- [ ] Maturity timeline mostra evolução turno a turno
- [ ] Audit timeline filtra por tipo de evento e período
- [ ] Token usage mostra breakdown por agente e modelo
- [ ] Custo estimado calculado com pricing correto do Vertex AI

---

## 8. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Refatoração do cockpit quebra funcionalidade existente | Média | Alto | Testes E2E antes e depois; feature flag para rollback |
| Output dos agentes muda de estrutura, quebrando renderers | Média | Médio | Renderers com fallback para JSON bruto; validação via Pydantic |
| SSE no admin adiciona carga ao Redis | Baixa | Baixo | Canal dedicado com TTL curto; admin é 1-2 usuários |
| Migration de snapshots impacta performance do entrevistador | Baixa | Médio | Insert assíncrono (não bloqueia SSE do chat); batch se necessário |
| Custo de tokens difícil de calcular com precisão | Alta | Baixo | Usar tabela de preços fixa, atualizar manualmente; disclaimer "estimado" |

---

## 9. Referências de Arquivos

### Arquivos a Modificar

| Arquivo | Fase | Ação |
|---------|------|------|
| `apps/web/src/routes/admin/+layout.svelte` | 1 | Adicionar novas tabs (Dashboard, Pipeline, Audit) |
| `apps/web/src/routes/admin/cockpit/+page.svelte` | 1 | Decompor em componentes |
| `apps/web/src/lib/server/admin-cockpit.ts` | 1-2 | Novos endpoints de agregação |
| `apps/ai/src/services/estimate_runner.py` | 2 | Publicar eventos no Redis |
| `apps/ai/src/services/interviewer.py` | 4 | Inserir snapshots de estado |
| `apps/ai/src/routers/estimate.py` | 2 | SSE endpoint admin |

### Arquivos Novos

| Arquivo | Fase |
|---------|------|
| `apps/web/src/routes/admin/dashboard/+page.svelte` | 2 |
| `apps/web/src/routes/admin/dashboard/+page.server.ts` | 2 |
| `apps/web/src/routes/admin/cockpit/[id]/+page.svelte` | 1 |
| `apps/web/src/routes/admin/cockpit/[id]/+page.server.ts` | 1 |
| `apps/web/src/routes/admin/pipeline/+page.svelte` | 3 |
| `apps/web/src/routes/admin/audit/+page.svelte` | 4 |
| `apps/web/src/lib/server/admin-dashboard.ts` | 2 |
| `apps/web/src/lib/components/admin/*.svelte` | 1 |
| `apps/web/src/lib/components/admin/pipeline/*.svelte` | 1-3 |
| `apps/web/src/lib/components/admin/renderers/*.svelte` | 3 |
| `database/migrations/020_interview_state_snapshots.sql` | 4 |
| `database/migrations/021_pipeline_token_usage.sql` | 4 |
