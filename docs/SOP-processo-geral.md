# SOP — Processo Geral da Plataforma oute.me

**Owner:** Bardi (Arquitetura e Engenharia)
**Versão:** 1.0
**Data:** 2026-03-22
**Cadência de revisão:** Trimestral ou após mudança arquitetural relevante

---

## Propósito

Documentar o fluxo funcional completo da plataforma oute.me — desde o input do usuário até a geração de estimativas de projetos de software — descrevendo cada agente de IA, seus inputs, outputs, critérios de decisão, e os pontos de integração entre os módulos.

---

## Escopo

**Incluído:**
- Fluxo de entrevista conversacional com o agente de IA
- Pipeline de estimativa com os 6 agentes CrewAI
- Processamento de documentos
- Ciclo de aprendizado via base de conhecimento vetorial (RAG)
- Mecanismos de fallback e resiliência

**Excluído:**
- Autenticação e gestão de contas de usuário
- Configuração de infraestrutura GCP
- Processo de CI/CD e deploy

---

## Máquina de Estados Central

O objeto central da plataforma percorre três estágios:

```
Interview (active) → Estimate (approved) → Project (created)
```

Cada estágio tem status próprio e só avança mediante critério explícito.

---

## RACI por Fluxo

| Atividade | Responsável | Aprovador | Consultado | Informado |
|-----------|-------------|-----------|------------|-----------|
| Conduzir entrevista | Agente Entrevistador (AI) | Usuário | Sistema de estado | Frontend |
| Calcular maturity score | `state_analyzer.py` | Regra determinística | Gemini 2.5 Flash | Frontend (barra de progresso) |
| Disparar estimativa | Usuário (≥ 0.70 maturity) | Admin | — | BFF SvelteKit |
| Pipeline de 6 agentes | CrewAI / Cloud Tasks | Reviewer (Agente 5) | RAG + Web Search | Estado do job (Redis/PG) |
| Armazenar conhecimento | Agente Knowledge Manager | — | pgvector | RAG futuro |
| Processar documentos | FastAPI + parsers | — | Gemini Vision | Contexto de chat |

---

## FLUXO 1 — Entrevista Conversacional

### Visão Geral

O usuário conversa com um agente de IA para detalhar o projeto que quer estimar. A cada turno, o sistema avalia o quanto os 5 domínios de conhecimento foram cobertos e calcula uma pontuação de maturidade (0.0 a 1.0). Quando a maturidade ≥ 0.70 **e** o usuário aprova explicitamente, a estimativa é desbloqueada.

### Pré-condição

- Usuário autenticado via Firebase Auth
- Interview criada no banco com `status = active`

### Passo a Passo

#### Passo 1.1 — Recepção da mensagem (BFF)

**Quem:** SvelteKit BFF
**Trigger:** Usuário envia mensagem no chat
**Como:**
1. Valida token Firebase Admin SDK
2. Carrega do PostgreSQL: estado atual da entrevista (`interviews.state` JSONB), histórico de mensagens, e contexto de documentos processados
3. Monta `ChatRequest` e faz proxy HTTP interno para FastAPI `/chat/message`

**Output:** `ChatRequest` com state, history e documentos

---

#### Passo 1.2 — Inicialização de domínios

**Quem:** `interview_initializer.py`
**Como:**
- Chama `ensure_domains_initialized(state)` — garante que os 5 domínios estejam presentes no state com `total > 0`
- Domínios e seus pesos:

| Domínio | Peso | Vital (obrigatório) |
|---------|------|---------------------|
| `scope` | 30% | Sim |
| `timeline` | 20% | Sim |
| `budget` | 20% | Sim |
| `integrations` | 15% | Não |
| `tech_stack` | 15% | Sim |

**Critério de falha:** Se `total = 0` para qualquer domínio, `calculate_maturity()` retorna 0 e a entrevista nunca avança.

---

#### Passo 1.3 — Streaming da resposta (Vertex AI)

**Quem:** `llm.py` → Vertex AI Gemini 2.5 Flash
**Como:**
1. Constrói system prompt via `build_system_prompt()` com: estado atual, domínios não cobertos, tom de conversa, nome do usuário, contexto de documentos
2. Envia histórico + mensagem do usuário para Gemini via SDK direto (sem CrewAI)
3. Faz streaming chunk-a-chunk via SSE

**Eventos SSE emitidos (ordem obrigatória):**
```
1. message_chunk  (N vezes — um por chunk de texto)
2. done           (1 vez — streaming concluído)
3. state_update   (1 vez — análise de estado assíncrona)
```

**Output:** Texto completo da resposta do agente

---

#### Passo 1.4 — Análise de estado (Dual-Pass)

**Quem:** `state_analyzer.py`
**Executa em paralelo ao title suggestion (asyncio.gather)**
**Como:**
1. Monta prompt com a mensagem do usuário, resposta do AI, e estado atual dos domínios
2. Executa **dois passes em paralelo** via Gemini:
   - Pass 1: `temperature=0.0` (determinístico)
   - Pass 2: `temperature=0.3` (leve variação)
3. Faz merge conservador:
   - `answered_delta` = **mínimo** dos dois passes (evita inflar score)
   - `vital_answered = True` somente se **ambos** concordarem
4. Aplica validações de sanidade:
   - Delta por domínio: máximo 2 por turno
   - Delta total: máximo 3 por turno — se ultrapassar, **rejeita o update inteiro**
   - Negativo: clampado para 0 (score nunca decresce)
   - `vital_answered` é one-way: uma vez True, nunca reverte

**Output:** `(updated_state, maturity_score)`

---

#### Passo 1.5 — Cálculo de Maturity

**Quem:** `calculate_maturity()` em `models/interview.py`
**Fórmula:**
```
score = Σ (weight[domain] × min(answered/total, 1.0))

Se algum vital domain não foi respondido:
  score = score × 0.85  (penalização)

Threshold para estimativa: maturity ≥ 0.70 + aprovação explícita do usuário
```

---

#### Passo 1.6 — Persistência (BFF)

**Quem:** SvelteKit BFF
**Como:**
- Persiste mensagem do usuário + resposta do AI em `interview_messages`
- Atualiza `interviews.state` (JSONB) com o novo estado
- Atualiza `interviews.maturity` com o score calculado
- Frontend recebe `state_update` via SSE e atualiza barra de progresso

---

### Exceções e Tratamento

| Cenário | Comportamento |
|---------|--------------|
| Vertex AI indisponível | Emite evento SSE `error` com mensagem amigável; não persiste mensagem |
| Análise de estado falha | Mantém state atual, calcula maturity com state anterior |
| Delta total suspeito (> 3) | Rejeita update inteiro, loga como `error`, mantém state anterior |
| Vital domain revertido | Ignora reversão, loga `warning` |
| Title suggestion falha | Retorna `suggested_title = null`, sem impacto no fluxo |

---

## FLUXO 2 — Processamento de Documentos

### Pré-condição

- Interview ativa
- Usuário faz upload de arquivo ou fornece URL

### Passo a Passo

**Passo 2.1 — Upload e storage**
BFF salva arquivo em GCS (prod) ou filesystem local (dev), retorna URL interna.

**Passo 2.2 — Detecção de tipo e roteamento (FastAPI)**
FastAPI recebe path/URL e roteia para o parser correto:

| Tipo | Parser |
|------|--------|
| PDF | Document AI Layout Parser → fallback PyMuPDF |
| DOCX | Document AI Layout Parser → fallback python-docx |
| XLSX | openpyxl |
| CSV | pandas |
| PPTX | python-pptx |
| Imagem (PNG, JPG...) | Vertex AI Gemini Vision (multimodal) |
| URL | httpx + BeautifulSoup4 |

**Passo 2.3 — Persistência do texto extraído**
BFF salva texto em `documents` e inclui no contexto dos próximos turnos de chat.

---

## FLUXO 3 — Pipeline de Estimativa (6 Agentes CrewAI)

### Pré-condição

- `interviews.maturity ≥ 0.70`
- Aprovação explícita do usuário
- Estimate criado com `status = pending_approval`
- Admin aprova → BFF chama FastAPI `/estimate/run`

### Arquitetura de Execução

```
FastAPI /estimate/run
    │
    ├── Prod:  Cloud Tasks → /estimate/execute (retry automático)
    └── Dev:   asyncio background task
```

Job criado no state backend (Redis em prod / PostgreSQL em dev) com `status = pending`.

### Pré-processamento (antes do pipeline)

1. Remove vetores antigos da entrevista (source types: `interview_summary`, `interview_responses`, `interview_document`)
2. Cria embeddings do state atual da entrevista e documentos → armazena em `ai.knowledge_vectors` para uso do Agente 2 (RAG Analyst)
3. Publica todos os 6 steps como `pending` no state backend → frontend mostra stepper imediatamente

---

### Os 6 Agentes (Processo Sequencial)

```
[1] Architecture Interviewer
        ↓ ConsolidatedRequirements
[2] RAG Analyst
        ↓ SimilarProjectsResult
[3] Software Architect
        ↓ ArchitectureDesign
[4] Cost Specialist
        ↓ CostEstimate
[5] Reviewer
        ↓ ReviewResult
[6] Knowledge Manager
        ↓ KnowledgePrep → pgvector
```

Tempo total estimado: **90–130 segundos**. Hard limit: **300 segundos** (5 minutos).

---

#### Agente 1 — Architecture Interviewer

**Role:** Entrevistador de Arquitetura
**Modelo:** `vertex_ai/gemini-2.5-flash-lite` | Temperature: 0.7
**Input:** estado da entrevista (JSONB), resumo da conversa, contexto de documentos
**Tarefa:** Consolidar requisitos técnicos em documento estruturado
**Output (`ConsolidatedRequirements`):**
```json
{
  "functional_requirements": ["..."],
  "non_functional_requirements": ["..."],
  "integrations": ["..."],
  "constraints": ["..."],
  "technologies": ["..."],
  "complexity_assessment": "low|medium|high|very_high"
}
```

---

#### Agente 2 — RAG Analyst

**Role:** Analista RAG
**Modelo:** `vertex_ai/gemini-2.5-flash-lite` | Temperature: 0.7
**Ferramentas:** `VectorSearchTool` (pgvector), `WebSearchTool` (busca na internet)
**Input:** output do Agente 1
**Tarefa:** Buscar projetos similares na base interna (2-3 queries) + benchmarks na internet
**Output (`SimilarProjectsResult`):**
```json
{
  "similar_projects": [
    {"summary": "...", "relevance_score": 0.85, "metrics": {"cost": 0, "duration_weeks": 0, "team_size": 0}}
  ],
  "market_benchmarks": {
    "avg_cost_per_hour": 0, "typical_duration_weeks": 0, "typical_team_size": 0
  }
}
```

**Nota:** Dados internos têm prioridade sobre benchmarks de mercado quando disponíveis.

---

#### Agente 3 — Software Architect

**Role:** Arquiteto de Software
**Modelo:** `vertex_ai/gemini-2.5-flash` | Temperature: 0.7
**Input:** outputs dos Agentes 1 e 2
**Tarefa:** Propor arquitetura técnica e cronograma com milestones
**Output (`ArchitectureDesign`):**
```json
{
  "architecture_overview": "...",
  "milestones": [{"name": "...", "duration_weeks": 0, "deliverables": ["..."], "dependencies": ["..."]}],
  "tech_recommendations": [{"category": "...", "technology": "...", "justification": "..."}],
  "risks": [{"description": "...", "impact": "high|medium|low", "mitigation": "...", "probability": "..."}]
}
```

---

#### Agente 4 — Cost Specialist

**Role:** Especialista em Custos
**Modelo:** `vertex_ai/gemini-2.5-flash` | Temperature: 0.7
**Input:** outputs dos Agentes 2 e 3
**Tarefa:** Elaborar 3 cenários financeiros com metodologia paramétrica (âncora em projetos similares + ajuste por complexidade)

**Método de cálculo por cenário:**
```
total_hours = Σ (duration_weeks × team_size × 40h × utilization)
total_cost = total_hours × hourly_rate   ← deve ser exato
duration_weeks = total_hours / (team_size × horas_semanais)
```

**Regras de diferenciação:**
| Cenário | Buffer | Equipe | Confiança |
|---------|--------|--------|-----------|
| Conservador | +30–50% | Júnior-pleno | 0.75–0.90 |
| Moderado | +10–15% | Pleno-sênior | 0.50–0.75 |
| Otimista | -15–25% | Sênior | 0.30–0.55 |

Taxas horárias de referência: **R$ 80–250/h** (mercado BR)
Moeda: **BRL**

**Output (`CostEstimate`):** 3 cenários com total_hours, hourly_rate, total_cost, duration_weeks, team_size, confidence, currency, risk_buffer_percent.

---

#### Agente 5 — Reviewer

**Role:** Revisor e Apresentador
**Modelo:** `vertex_ai/gemini-2.5-flash` | **Temperature: 0.0** (determinístico)
**Input:** outputs dos Agentes 1, 3 e 4
**Tarefa:** Validação completa de consistência + geração de sumário executivo

**Checklist de validação obrigatório:**

| # | Verificação | Categoria | Severidade |
|---|------------|-----------|------------|
| 1 | `total_cost = total_hours × hourly_rate` (tolerância 5%) | `mathematical` | critical |
| 2 | conservador ≥ moderado ≥ otimista (custo e prazo) | `cost_consistency` | critical |
| 3 | Cada requisito funcional coberto em ≥ 1 milestone | `requirement_coverage` | warning |
| 4 | Cada integração com risco associado e mitigação | `risk_coverage` | warning |
| 5 | `duration_weeks` compatível com `total_hours / (team_size × 40 × 0.75)` (desvio ≤ 20%) | `timeline_consistency` | warning |
| 6 | Campos obrigatórios preenchidos | `general` | critical |

**Output (`ReviewResult`):** validation (is_consistent, issues_found, adjustments_made, percentuais de cobertura) + executive_summary em português (3–5 parágrafos para decisores de negócio).

---

#### Agente 6 — Knowledge Manager

**Role:** Gestor de Conhecimento
**Modelo:** `vertex_ai/gemini-2.5-flash-lite` | Temperature: 0.7
**Input:** outputs dos Agentes 1, 3, 4 e 5
**Tarefa:** Preparar texto para embedding vetorial e metadados estruturados

**Output (`KnowledgePrep`):**
```json
{
  "knowledge_text": "Texto corrido em parágrafos (500–1500 palavras, NÃO JSON) ...",
  "metadata": {
    "project_type": "saas|e-commerce|marketplace|...",
    "technologies": ["..."],
    "complexity": "low|medium|high|very_high",
    "cost_range": {"min": 0.0, "max": 0.0},
    "duration_range": {"min": 0.0, "max": 0.0},
    "team_size_range": {"min": 0, "max": 0},
    "integrations_count": 0,
    "requirements_count": 0
  }
}
```

---

### Pós-processamento (após os 6 agentes)

1. **Armazenamento de conhecimento:** `knowledge_text` é embeddado via Vertex AI `text-multilingual-embedding-002` (768 dims) e armazenado em `ai.knowledge_vectors` com source_type `estimate`. Vetores antigos da mesma entrevista são deletados antes (deduplicação). Textos longos são chunkeados automaticamente.

2. **Atualização do job:** `backend.update_job(job_id, "done", result)` — resultado completo salvo em Redis/PG.

3. **Métricas emitidas:** duração por agente (`llm/agent_duration`), tamanho do output (`llm/agent_output_size`), duração total do pipeline (`llm/pipeline_duration`).

4. **BFF polling:** GET `/estimate/status` → retorna resultado ao browser quando `status = done`.

---

### Resiliência do Pipeline

**Parse com 3 tentativas:**
1. `parse_agent_output()` normal
2. Extração de JSON via regex `\{[\s\S]+\}`
3. LLM reformat: pede ao Gemini 2.5 Flash para reformatar o output bruto como JSON válido

**Circuit breaker:** 2 agentes consecutivos com output vazio → `RuntimeError` (indica degradação do Vertex AI).

**Partial rerun:** Pipeline pode ser reiniciado a partir de qualquer agente (`from_agent`), reaproveitando outputs anteriores que já estavam corretos.

**Heartbeat:** Enquanto o pipeline roda, uma coroutine toca `updated_at` a cada 60s para evitar falso alarme de "job travado".

---

### Exceções e Tratamento

| Cenário | Comportamento |
|---------|--------------|
| Agente falha no parse | 3 tentativas (regex → LLM reformat) → step marcado como `failed` |
| 2 agentes consecutivos com output vazio | Circuit breaker → job `failed` com "Serviço de IA indisponível" |
| Pipeline ultrapassa 300s | TimeoutError → job `failed` com "Pipeline excedeu tempo limite" |
| Embed de conhecimento falha | Log de erro, mas pipeline continua normalmente |
| Cloud Tasks entrega duplicada | Idempotência: se `status in (running, done)`, ignora re-execução |

---

## FLUXO 4 — Ciclo de Aprendizado (RAG Feedback Loop)

O Agente 6 (Knowledge Manager) fecha o ciclo: cada estimativa concluída alimenta a base vetorial que será usada pelo Agente 2 (RAG Analyst) em estimativas futuras.

```
Estimativa concluída
    │
    ▼
Knowledge Manager → knowledge_text (texto otimizado para busca semântica)
    │
    ▼
Vertex AI Embeddings → vetor 768 dims
    │
    ▼
ai.knowledge_vectors (pgvector) ← com metadata estruturado
    │
    ▼  (próxima estimativa)
RAG Analyst → VectorSearchTool → busca projetos similares
    │
    ▼
Calibra Cost Specialist com dados reais de custo/prazo
```

**Known issue (F-01 CRITICAL):** O Knowledge Manager atualmente armazena sem validação de qualidade. Estimativas com erros de validação (issues `critical` no Reviewer) podem contaminar a base. Plano de correção em `docs/plans/PLAN-architecture-fixes.md`.

---

## Métricas do Processo

| Métrica | Meta | Como medir |
|---------|------|------------|
| Maturity score ao solicitar estimativa | ≥ 0.70 | `interviews.maturity` |
| Duração total do pipeline | ≤ 130s (p50) | `llm/pipeline_duration` |
| Duração por agente | ≤ 90s (hard limit) | `llm/agent_duration` |
| Taxa de falha de parse (agentes) | < 5% | steps com `status = failed` |
| Cobertura de requisitos (Reviewer) | ≥ 85% | `requirements_coverage_pct` |
| Cobertura de riscos (Reviewer) | ≥ 70% | `risk_coverage_pct` |
| Taxa de jobs com `is_consistent = false` | < 10% | Reviewer.validation |

---

## Documentos Relacionados

- `docs/ARCHITECTURE.md` — Visão arquitetural completa
- `docs/API.md` — Referência dos endpoints
- `docs/adr/ADR-11-crewai-pipeline-review.docx` — Revisão do pipeline CrewAI
- `docs/adr/ADR-12-revisao-arquitetural.docx` — 14 findings (3 CRITICAL)
- `docs/plans/PLAN-architecture-fixes.md` — Planos de correção dos findings críticos
- `apps/ai/src/crew/agents.yaml` — Backstories e configurações dos agentes
- `apps/ai/src/crew/tasks.yaml` — Descrições e expected outputs das tarefas
