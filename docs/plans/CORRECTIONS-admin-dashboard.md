# CORRECTIONS — Admin Dashboard & Observability Cockpit

> **Auditoria:** 2026-03-22 | ~55 arquivos revisados
> **Legenda:** 🔴 CRITICAL (quebra em prod) | 🟠 HIGH (bug funcional) | 🟡 MEDIUM (robustez) | 🔵 LOW (qualidade)

---

## 🔴 CRITICAL — Corrigir antes de deploy

### C-01: `$derived(() => {...})` deveria ser `$derived.by(() => {...})`

**Arquivos:**
- `components/admin/MaturityTimeline.svelte` → `domainKeys` (linha 33)
- `components/admin/dashboard/TokenCostWidget.svelte` → `sparkPath` (linha 50)

**Problema:** `$derived(() => { ... })` em Svelte 5 retorna a **função em si**, não o resultado da execução. O pattern correto para computations com corpo de bloco é `$derived.by(() => { ... })`. Sem `.by()`, o componente recebe uma função ao invés de um valor, e o template falha silenciosamente ou renderiza `[Function]`.

**Fix:**
```diff
- const domainKeys = $derived((): string[] => {
+ const domainKeys = $derived.by((): string[] => {
```

```diff
- const sparkPath = $derived(() => {
+ const sparkPath = $derived.by(() => {
```

**Escopo:** Verificar TODOS os `$derived` com arrow function no body — se tem `{`, precisa de `.by()`. `$derived(expression)` (sem bloco) está OK.

---

### C-02: Token tracker thread-local não é resetado dentro do executor

**Arquivo:** `apps/ai/src/crew/estimate_crew.py` (linhas 110-113)

**Problema:** `_init_token_tracking()` é chamado antes do `run_in_executor`, mas `threading.local()` é **por thread**. Se o pool reusa a thread, `_tls.token_store` retém dados do pipeline anterior. O init precisa ocorrer **dentro** da função executada pelo ThreadPoolExecutor.

**Fix:** Garantir que `_init_token_tracking(first_agent_key)` é chamado como primeira instrução dentro da callable passada ao executor, não antes.

---

### C-03: Status filter incorreto em `getActivePipelines()`

**Arquivo:** `apps/web/src/lib/server/admin-dashboard.ts` (linha 210)

**Problema:**
```sql
WHERE e.status IN ('estimating', 'running', 'pending')
```

O status `'pending'` não existe no schema de `estimates`. O correto é `'pending_approval'`. Se os status reais são `pending_approval | estimating | running | done | failed | approved`, o dashboard de pipelines ativos mostra **zero resultados** para jobs em `pending_approval`.

**Fix:**
```diff
- WHERE e.status IN ('estimating', 'running', 'pending')
+ WHERE e.status IN ('pending_approval', 'estimating', 'running')
```

---

### C-04: Auth check inconsistente entre endpoints admin

**Arquivos:** Todos os `routes/api/admin/**`

**Problema:** Três padrões diferentes de auth:
1. `requireAuth(locals)` + `jsonError(403)` → dashboard/metrics, funnel, pipelines, alerts
2. `throw error(401/403)` from `@sveltejs/kit` → tokens, pipeline, audit, health
3. `json({ error: ... }, { status: 403 })` → pipeline-events

Se `requireAuth()` não lança exceção em user ausente, o endpoint continua sem admin check. Inconsistência dificulta manutenção.

**Fix:** Padronizar todos para:
```typescript
if (!locals.user) throw error(401, 'Unauthorized');
if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');
```

---

## 🟠 HIGH — Corrigir antes de uso real

### H-01: `SvelteSet` import questionável

**Arquivo:** `components/admin/MaturityTimeline.svelte` (linha 2)

**Problema:** `SvelteSet` existe em `svelte/reactivity` no Svelte 5, mas é experimental e pode mudar. Dentro de `$derived.by()` (após fix C-01), um `Set` nativo funciona perfeitamente — não precisa de reatividade no Set interno.

**Fix:**
```diff
- import { SvelteSet } from 'svelte/reactivity';
+ // Use native Set — only needed inside $derived.by computation
...
- const keys = new SvelteSet<string>();
+ const keys = new Set<string>();
```

---

### H-02: EventSource sem error handler e sem cleanup robusto

**Arquivo:** `routes/admin/dashboard/+page.svelte` (linhas 24-37)

**Problema:** O `EventSource` não tem handler de `error`. Se a conexão cair, o browser tenta reconectar infinitamente. Se o componente for destruído durante reconexão, a cleanup pode não executar.

**Fix:**
```typescript
$effect(() => {
    const es = new EventSource('/api/admin/pipeline-events');
    es.addEventListener('pipeline_done', ...);
    es.addEventListener('pipeline_failed', ...);
    es.addEventListener('error', () => {
        es.close(); // Stop auto-reconnect on persistent errors
    });
    return () => es.close();
});
```

---

### H-03: `MessagesTab` pode crashar com `initialMessages` undefined

**Arquivo:** `components/admin/tabs/MessagesTab.svelte` (linha 15)

**Problema:** `[...initialMessages]` lança TypeError se `initialMessages` for `null` ou `undefined`. O tipo diz `InterviewMessage[]`, mas o caller (`InterviewDetail`) pode passar `detail.messages` que pode ser `undefined` se o fetch falhar parcialmente.

**Fix:**
```diff
- let messages = $state<InterviewMessage[]>([...initialMessages]);
+ let messages = $state<InterviewMessage[]>([...(initialMessages ?? [])]);
- let offset = $state(initialMessages.length);
+ let offset = $state(initialMessages?.length ?? 0);
```

---

### H-04: Race condition na mutação de `steps` entre thread e event loop

**Arquivo:** `apps/ai/src/services/estimate_runner.py` (linhas 89-99)

**Problema:** A lista `steps` é mutada no callback `on_task_done` (thread do executor) e lida pelo `backend.update_agent_steps` (coroutine no event loop). Sem lock, uma mutação pode ocorrer durante serialização do JSON.

**Fix:** Criar cópia defensiva antes do send:
```python
def on_task_done(agent_key: str) -> None:
    for step in steps:
        if step["agent_key"] == agent_key:
            step["status"] = "done"
            break
    snapshot = [dict(s) for s in steps]  # defensive copy
    asyncio.run_coroutine_threadsafe(
        backend.update_agent_steps(job_id, snapshot), loop
    )
```

---

### H-05: SSE keepalive no pipeline-events usa formato incorreto

**Arquivo:** `routes/api/admin/pipeline-events/+server.ts`

**Problema:** Keepalive envia `': keepalive\n\n'` (comment SSE), que é válido mas some browsers ignoram comments silenciosamente. Se nenhum evento real chegar em >30s, proxies (Cloud Run, nginx) podem dropar a conexão.

**Fix:** Enviar como evento nomeado:
```diff
- controller.enqueue(enc.encode(': keepalive\n\n'));
+ controller.enqueue(enc.encode('event: keepalive\ndata: \n\n'));
```

---

### H-06: Pipeline events SSE no FastAPI não tem heartbeat

**Arquivo:** `apps/ai/src/routers/admin.py`

**Problema:** O `pubsub.listen()` bloqueia até receber mensagem. Se não houver pipelines rodando, a conexão fica silenciosa indefinidamente. Cloud Run mata conexões ociosas após ~10min.

**Fix:** Adicionar keepalive server-side a cada 30s:
```python
async for message in pubsub.listen():
    if message["type"] == "message":
        yield {"event": "pipeline_update", "data": message["data"]}
    # Add timeout-based keepalive
```
Ou usar `asyncio.wait_for` com timeout de 30s e yield comment no timeout.

---

### H-07: Non-null assertion sem guard no run comparison

**Arquivo:** `routes/api/admin/cockpit/interviews/[id]/runs/compare/+server.ts`

**Problema:** `runs.find(...)!` com `!` assertion — se a query retorna menos de 2 rows, TypeError em runtime.

**Fix:**
```diff
- const runA = runs.find((r) => r.id === runAId)!;
- const runB = runs.find((r) => r.id === runBId)!;
+ const runA = runs.find((r) => r.id === runAId);
+ const runB = runs.find((r) => r.id === runBId);
+ if (!runA || !runB) throw error(404, 'Uma ou ambas as runs não encontradas');
```

---

## 🟡 MEDIUM — Melhorar robustez

### M-01: Validação de `period` param ausente na maioria dos endpoints

**Arquivos:** `api/admin/dashboard/tokens`, `api/admin/pipeline`, `api/admin/audit`

**Problema:** `parseInt(url.searchParams.get('period') ?? '30') as PeriodDays` aceita qualquer número. Valores como 999 ou -1 executam queries com `999 days`.

**Fix:** Validar contra whitelist:
```typescript
const raw = Number(url.searchParams.get('period'));
const period: PeriodDays = ([7, 30, 90] as const).includes(raw as any) ? (raw as PeriodDays) : 30;
```

---

### M-02: UUIDs não validados em route params

**Arquivos:** `cockpit/interviews/[id]`, `runs/compare`, `documents/[id]/download`

**Problema:** IDs de rota passados direto pro SQL sem validar formato UUID. String malformada causa erro 500 do PostgreSQL ao invés de 400.

**Fix:** Helper de validação:
```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(id)) throw error(400, 'Invalid ID format');
```

---

### M-03: Maturity snapshots silently swallowed errors

**Arquivo:** `apps/web/src/lib/server/maturity-snapshots.ts` (linha 33)

**Problema:** `catch {}` vazio sem logging. Se snapshots pararem de salvar (ex: tabela não migrada), o admin nunca fica sabendo.

**Fix:**
```diff
- } catch {
-     // Never let snapshot saving break the request
- }
+ } catch (err) {
+     console.warn('[maturity-snapshot] Failed to save:', interviewId, err);
+ }
```

---

### M-04: Sem paginação no audit — potencial OOM

**Arquivo:** `apps/web/src/lib/server/admin-audit.ts`

**Problema:** Default limit de 200 eventos, mas 90 dias de atividade pode ter milhares. Sem cursor-based pagination, o frontend carrega tudo de uma vez.

**Fix:** Adicionar `offset/limit` ou cursor param.

---

### M-05: `ON CONFLICT DO NOTHING` na snapshot sem constraint

**Arquivo:** `maturity-snapshots.ts` (linha 31) + `020_interview_state_snapshots.sql`

**Problema:** `ON CONFLICT DO NOTHING` requer uma unique constraint para detectar o conflito. A migration não cria UNIQUE constraint em `(interview_id, turn_number)`.

**Fix na migration:**
```sql
CREATE UNIQUE INDEX idx_state_snapshots_unique
  ON public.interview_state_snapshots(interview_id, turn_number);
```

---

### M-06: Token stats query lê do JSONB mas table `pipeline_token_usage` existe

**Arquivo:** `admin-dashboard.ts` (linhas 362-375)

**Problema:** A query faz `jsonb_array_elements(er.agent_steps)` para extrair tokens, mas a migration 021 criou `pipeline_token_usage` como tabela dedicada. A tabela está **vazia** — ninguém faz INSERT nela. A query funciona porque os tokens são escritos no JSONB `agent_steps` pelo `estimate_runner.py`.

**Decisão necessária:** Ou (a) dropar a tabela 021 e manter via JSONB, ou (b) adicionar INSERT na tabela e migrar a query. JSONB é mais simples mas menos eficiente para agregações.

---

### M-07: Índice de `pipeline_token_usage` em ordem subótima

**Arquivo:** `021_pipeline_token_usage.sql`

**Problema:** Índice `(agent_key, created_at)` mas as queries filtram por `created_at` primeiro e agrupam por `agent_key`. Para range scan em `created_at`, o índice deveria ser `(created_at DESC, agent_key)`.

---

### M-08: `DomainProgress` não protege contra `answered` undefined

**Arquivo:** `components/admin/DomainProgress.svelte`

**Fix:** `(d.answered ?? 0) / d.total`

---

## 🔵 LOW — Qualidade de código

### L-01: Hardcoded API paths em InterviewDetail.svelte

4 endpoints hardcoded como strings. Criar helper `adminApi.ts` com funções tipadas.

### L-02: Event handler naming inconsistente nos componentes

`ontriggerrerun`, `onopenrerunmodal`, `onstepclick` — deveriam ser `onTriggerRerun`, `onOpenRerunModal`, `onStepClick` (camelCase).

### L-03: RunHistoryList renderiza botão "Comparar" mesmo sem `oncompare` prop

Se o callback é opcional e não passado, o botão aparece mas não faz nada. Esconder quando `!oncompare`.

### L-04: PipelineTab não mostra mensagem quando todos os steps estão pending

Adicionar: "Pipeline ainda não foi executado."

### L-05: RequirementsView hardcoda labels PT-BR + EN para complexidade

`'high' || 'alta'` — frágil. Usar mapping numérico.

### L-06: Sem backfill de snapshots para entrevistas existentes

Após deploy da migration 020, entrevistas antigas não terão snapshots. MaturityTimeline mostra "Sem dados". Considerar script de backfill que derive snapshots do `interview_messages` existente.

---

## Resumo

| Sev. | Qtd | Impacto |
|------|-----|---------|
| 🔴 CRITICAL | 4 | Bugs que quebram funcionalidade em prod |
| 🟠 HIGH | 7 | Bugs funcionais ou resource leaks |
| 🟡 MEDIUM | 8 | Robustez e integridade de dados |
| 🔵 LOW | 6 | Qualidade e manutenibilidade |
| **Total** | **25** | |

### Ordem de execução recomendada

1. **C-01** (5min) — `$derived.by` — impacto visual imediato
2. **C-03** (2min) — Status filter — dashboard mostra dados reais
3. **C-04** (30min) — Auth padronização — segurança
4. **C-02** (15min) — Token tracker reset — integridade de dados
5. **H-01 a H-07** (2-3h) — Bugs funcionais
6. **M-01 a M-08** (2-3h) — Robustez
7. **L-01 a L-06** (1-2h) — Qualidade
