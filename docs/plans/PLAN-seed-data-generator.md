# PLAN: Seed Data Generator via Playwright

**Status:** Draft
**Data:** 2026-03-24
**Autor:** Bardi + Claude
**Objetivo:** Script Playwright on-demand que gera massa de dados rica e completa em ambiente dev, cobrindo todas as fases do pipeline (Interview → Estimate → Project), com uploads de arquivos reais e textos extensos para análise no admin.

---

## 1. Visão Geral

### O que será gerado

| Fase | Quantidade | Conteúdo |
|---|---|---|
| **Entrevistas (chat completo)** | 5 | Cada uma com 8-12 turnos de conversa, maturity progressivo, upload de 1 arquivo de tipo distinto |
| **Estimativas (pipeline completo)** | 5 | Vinculadas às entrevistas maduras, com `result` preenchido (3 cenários, milestones, risks, tech_recommendations) |
| **Projetos (pós-aprovação)** | 5 | Criados a partir de estimativas aprovadas, com milestones, tasks, status variados |

### Distribuição por fase do pipeline

```
INTERVIEWS (5):
  #1 — maturity 0.15 (início, 2 turnos, 1 doc PDF)          → status: active
  #2 — maturity 0.45 (meio, 5 turnos, 1 doc DOCX)           → status: active
  #3 — maturity 0.72 (threshold atingido, 8 turnos, 1 doc XLSX) → status: active
  #4 — maturity 0.85 (madura, 10 turnos, 1 doc CSV)         → status: active
  #5 — maturity 0.93 (muito madura, 12 turnos, 1 doc PPTX)  → status: completed

ESTIMATES (5):
  #1 — status: pending_approval  (da entrevista #3)
  #2 — status: pending           (da entrevista #4, job_id set)
  #3 — status: running           (da entrevista #5, agent_steps parciais)
  #4 — status: done              (entrevista nova #6, result completo)
  #5 — status: failed            (entrevista nova #7, error_message)

  + 1 extra: status: approved    (da estimate #4, approved_at set)

PROJECTS (5):
  #1 — status: active,   milestones: [pending, pending, pending]      (recém-criado)
  #2 — status: active,   milestones: [done, in_progress, pending]     (em andamento)
  #3 — status: active,   milestones: [done, done, in_progress]        (quase pronto)
  #4 — status: completed, milestones: [done, done, done]              (finalizado)
  #5 — status: active,   milestones: [done, in_progress, pending, pending] (grande, 4 milestones)
```

**Total de entrevistas criadas:** 7 (5 principais + 2 extras para estimates #4 e #5)

---

## 2. Arquitetura do Script

### Estrutura de arquivos

```
tests/
├── e2e/
│   ├── seed/
│   │   ├── seed-data-generator.spec.ts    # Script principal (Playwright test)
│   │   ├── seed-config.ts                 # Configuração e constantes
│   │   ├── fixtures/                      # Arquivos de upload
│   │   │   ├── sample-requirements.pdf
│   │   │   ├── sample-architecture.docx
│   │   │   ├── sample-budget.xlsx
│   │   │   ├── sample-timeline.csv
│   │   │   └── sample-presentation.pptx
│   │   ├── data/
│   │   │   ├── interview-scenarios.ts     # 7 cenários de entrevista com mensagens
│   │   │   ├── estimate-results.ts        # Resultados mock completos
│   │   │   └── project-definitions.ts     # Definições de projetos com milestones/tasks
│   │   └── helpers/
│   │       ├── interview-helper.ts        # Funções para criar entrevistas via UI/API
│   │       ├── estimate-helper.ts         # Funções para criar estimativas via DB
│   │       ├── project-helper.ts          # Funções para criar projetos via DB
│   │       └── db-seeder.ts              # Acesso direto ao DB para dados que não passam pela UI
│   └── playwright.seed.config.ts          # Config separada para o seed (timeout maior)
```

### Abordagem: Híbrida (Playwright + API + DB direto)

O script usa **3 camadas** dependendo da necessidade:

| Camada | Quando usar | Motivo |
|---|---|---|
| **Playwright UI** | Criar entrevistas, enviar mensagens no chat, upload de arquivos | Exercita o fluxo real, gera SSE events, atualiza maturity naturalmente |
| **API direta (fetch)** | Disparar estimativas, aprovar estimativas | Mais rápido, não depende de UI de loading |
| **DB direto (pg)** | Inserir estimate results mock, ajustar status de estimates/projects, inserir agent_steps | Pipeline de estimativa real demora 90-130s × 5 = impraticável; mock do result é necessário |

> **Decisão crítica:** O pipeline CrewAI real é lento demais (90-130s por estimativa). Para o seed, vamos usar DB direto para injetar `estimate.result` e `estimate_runs.agent_steps` com dados realistas pré-definidos, simulando o output do pipeline completo.

---

## 3. Cenários de Entrevista (Detalhamento)

### Entrevista #1 — "App de Delivery de Comida" (maturity 0.15)

**Turnos:** 2 mensagens do usuário
**Upload:** `sample-requirements.pdf`
**Mensagens:**
1. "Quero criar um aplicativo de delivery de comida similar ao iFood, com foco em restaurantes locais de uma cidade de 500 mil habitantes."
2. "O público-alvo são pessoas de 18-45 anos que preferem pedir comida pelo celular. Queremos começar com Android e iOS."

**Domínios tocados:** scope (parcial)

---

### Entrevista #2 — "Sistema ERP Industrial" (maturity 0.45)

**Turnos:** 5 mensagens
**Upload:** `sample-architecture.docx`
**Mensagens:**
1. "Preciso de um ERP para uma fábrica de autopeças com 200 funcionários. Módulos: estoque, produção, financeiro e RH."
2. "O prazo ideal seria 12 meses para o MVP. Temos budget de R$800 mil para a primeira fase."
3. "Integrações necessárias: SAP para contabilidade, sistema de ponto eletrônico Dimep, e API do banco Itaú para conciliação."
4. "Stack preferida: Java Spring Boot no backend, React no frontend, PostgreSQL como banco."
5. "O módulo de produção precisa de rastreabilidade completa de lotes, com código de barras e QR code em cada peça."

**Domínios tocados:** scope, timeline, budget, integrations, tech_stack (parciais)

---

### Entrevista #3 — "Plataforma de Telemedicina" (maturity 0.72)

**Turnos:** 8 mensagens
**Upload:** `sample-budget.xlsx`
**Mensagens abrangentes cobrindo:** escopo detalhado (videochamada, prontuário, prescrição digital, agendamento), timeline (6 meses MVP), budget (R$1.2M), integrações (HL7 FHIR, e-prescribing, planos de saúde), stack (Node.js, React Native, PostgreSQL, WebRTC)

---

### Entrevista #4 — "Marketplace B2B de Insumos Agrícolas" (maturity 0.85)

**Turnos:** 10 mensagens
**Upload:** `sample-timeline.csv`
**Cobertura:** Todos os domínios com profundidade. Inclui detalhes de logística, pagamentos, ratings, analytics dashboard.

---

### Entrevista #5 — "Plataforma SaaS de Gestão Escolar" (maturity 0.93)

**Turnos:** 12 mensagens
**Upload:** `sample-presentation.pptx`
**Cobertura:** Extremamente detalhada. Módulos: matrícula, notas, frequência, comunicação pais-escola, financeiro, portal do aluno. Integrações com MEC, e-SIC, gateway de pagamento.

---

### Entrevistas #6 e #7 — Para Estimates Done e Failed

**#6 — "Portal de E-commerce de Moda"** (maturity 0.88, 10 turnos)
**#7 — "Sistema de Gestão de Frotas"** (maturity 0.78, 8 turnos)

---

## 4. Dados de Estimativa (Mock)

### Estrutura do `estimate.result` (para cada estimate `done`/`approved`)

```typescript
{
  summary: "Análise completa de viabilidade técnica e financeira...", // ~500 palavras
  architecture_overview: "Arquitetura proposta baseada em microserviços...", // ~300 palavras
  milestones: [
    {
      name: "Fase 1 — Fundação e Infraestrutura",
      description: "Setup do projeto, CI/CD, auth, banco de dados...",
      duration_weeks: 4,
      deliverables: ["Repositório configurado", "Pipeline CI/CD", "Auth flow", "DB schema"],
      dependencies: []
    },
    // 3-5 milestones por estimate
  ],
  cost_scenarios: [
    {
      name: "conservador",
      description: "Equipe senior, buffer alto, escopo máximo",
      total_hours: 2400, hourly_rate: 180, total_cost: 432000,
      duration_weeks: 24, team_size: 5, confidence: 0.95,
      currency: "BRL", risk_buffer_percent: 25
    },
    { name: "moderado", /* ... */ },
    { name: "otimista", /* ... */ }
  ],
  tech_recommendations: [
    { category: "Backend", technology: "Node.js + NestJS", justification: "..." },
    { category: "Frontend", technology: "React + Next.js", justification: "..." },
    // 5-8 recomendações
  ],
  risks: [
    {
      description: "Dependência de APIs externas de terceiros",
      impact: "Atraso de 2-4 semanas se API mudar contrato",
      mitigation: "Implementar adapter pattern e contract tests",
      probability: "Média"
    },
    // 4-6 riscos
  ],
  similar_projects: [
    { name: "Projeto Similar X", similarity: 0.82, duration_weeks: 20, cost: 350000 }
  ],
  executive_summary: "Resumo executivo de 3 parágrafos..." // ~200 palavras
}
```

### Agent Steps (para estimate_runs)

Cada estimate terá um `estimate_run` com `agent_steps` completos:

```typescript
[
  { agent_key: "architecture_interviewer", status: "done", duration_s: 18.5, input_tokens: 3200, output_tokens: 1800 },
  { agent_key: "rag_analyst",             status: "done", duration_s: 25.3, input_tokens: 4100, output_tokens: 2200 },
  { agent_key: "software_architect",      status: "done", duration_s: 32.1, input_tokens: 5500, output_tokens: 3400 },
  { agent_key: "cost_specialist",         status: "done", duration_s: 22.7, input_tokens: 4800, output_tokens: 2900 },
  { agent_key: "reviewer",               status: "done", duration_s: 19.4, input_tokens: 6200, output_tokens: 1500 },
  { agent_key: "knowledge_manager",       status: "done", duration_s: 12.0, input_tokens: 2100, output_tokens: 800 }
]
```

Para estimate `running`: steps 1-3 done, step 4 running, steps 5-6 pending.
Para estimate `failed`: steps 1-4 done, step 5 failed com error_message.

---

## 5. Dados de Projetos (Mock)

Cada projeto terá 3-4 milestones com 3-5 tasks cada:

```typescript
// Projeto #2 — Em andamento
{
  name: "ERP Industrial — MVP",
  status: "active",
  selected_scenario: "moderado",
  milestones: [
    {
      name: "Fundação",
      status: "done",
      tasks: [
        { title: "Setup monorepo", status: "done", priority: "high", estimated_hours: 8 },
        { title: "Configurar CI/CD", status: "done", priority: "high", estimated_hours: 16 },
        { title: "Implementar autenticação", status: "done", priority: "high", estimated_hours: 24 },
      ]
    },
    {
      name: "Módulo de Estoque",
      status: "in_progress",
      tasks: [
        { title: "CRUD de produtos", status: "done", priority: "high", estimated_hours: 16 },
        { title: "Controle de lotes", status: "in_progress", priority: "high", estimated_hours: 32 },
        { title: "Relatórios de movimentação", status: "todo", priority: "medium", estimated_hours: 24 },
      ]
    },
    {
      name: "Módulo Financeiro",
      status: "pending",
      tasks: [
        { title: "Contas a pagar/receber", status: "todo", priority: "high", estimated_hours: 40 },
        { title: "Conciliação bancária", status: "todo", priority: "medium", estimated_hours: 32 },
      ]
    }
  ]
}
```

---

## 6. Arquivos de Upload

Criar 5 arquivos pequenos mas realistas (< 100KB cada):

| Arquivo | Tipo | Conteúdo |
|---|---|---|
| `sample-requirements.pdf` | PDF | Documento de requisitos de 2 páginas com tabelas |
| `sample-architecture.docx` | DOCX | Diagrama de arquitetura descritivo com seções |
| `sample-budget.xlsx` | XLSX | Planilha de orçamento com 3 abas e fórmulas |
| `sample-timeline.csv` | CSV | Cronograma com 20 linhas (fase, inicio, fim, responsável) |
| `sample-presentation.pptx` | PPTX | Pitch deck de 5 slides do projeto |

> **Geração:** Esses arquivos serão gerados programaticamente no setup do script usando libs como `pdfkit`, `docx`, `exceljs`, `csv-stringify` e `pptxgenjs`. Ficam commitados no repo como fixtures estáticas.

---

## 7. Fluxo de Execução do Script

```
┌─────────────────────────────────────────────────┐
│  1. SETUP                                       │
│     • Auth via Firebase REST (reusa fixture)     │
│     • Verifica conectividade DB e AI service     │
│     • Gera arquivos de upload se não existem     │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  2. ENTREVISTAS (via Playwright UI)              │
│     Para cada cenário (1-7):                     │
│       • POST /api/interviews (criar)             │
│       • Para cada mensagem:                      │
│         - Preenche textarea + Enter              │
│         - Aguarda SSE response (assistant msg)   │
│         - Verifica maturity update               │
│       • Upload arquivo (input[type=file])        │
│       • Aguarda processamento do documento       │
│     Coleta: interview_ids[]                      │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  3. ESTIMATIVAS (API + DB)                       │
│     Para entrevistas com maturity >= 0.70:       │
│       • POST /api/estimates (disparar)           │
│       • UPDATE via DB: status, result, steps     │
│       • INSERT estimate_runs com agent_steps     │
│       • Para estimate #4: SET approved_at        │
│     Coleta: estimate_ids[]                       │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  4. PROJETOS (API + DB)                          │
│     Para estimates approved/done:                │
│       • POST /api/projects (criar)               │
│       • INSERT milestones com status variados    │
│       • INSERT tasks com status/priority variados│
│       • UPDATE project status conforme cenário   │
│     Coleta: project_ids[]                        │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  5. VERIFICAÇÃO                                  │
│     • Navega para /admin/cockpit — verifica 7    │
│       entrevistas listadas                       │
│     • Navega para /admin/pipeline — verifica 5   │
│       estimates em diferentes status             │
│     • Navega para /admin/dashboard — verifica    │
│       métricas de funil atualizadas              │
│     • Screenshot de cada tela admin              │
│     • Log resumo: IDs criados, status, maturity  │
└─────────────────────────────────────────────────┘
```

---

## 8. Configuração Playwright Separada

```typescript
// tests/e2e/playwright.seed.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './seed',
  timeout: 300_000,        // 5 min por test (SSE pode ser lento)
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,              // Seed não deve dar retry
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'seed', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

**Comando para rodar:**
```bash
# Local
cd tests/e2e && npx playwright test --config=playwright.seed.config.ts

# Via pnpm script (raiz)
pnpm seed:e2e

# Via GitHub Actions (on-demand)
gh workflow run seed-data.yml --ref develop
```

---

## 9. GitHub Actions Workflow

```yaml
# .github/workflows/seed-data.yml
name: Seed Dev Data
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'dev'
        type: choice
        options: [dev, staging]
      clean_before:
        description: 'Limpar dados existentes antes do seed'
        required: false
        default: false
        type: boolean

jobs:
  seed:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: npx playwright install chromium

      - name: Cleanup existing seed data (optional)
        if: ${{ inputs.clean_before }}
        run: pnpm seed:clean
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Generate seed data
        run: pnpm seed:e2e
        env:
          E2E_BASE_URL: ${{ vars.E2E_BASE_URL }}
          E2E_TEST_EMAIL: ${{ secrets.E2E_TEST_EMAIL }}
          E2E_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}
          E2E_FIREBASE_API_KEY: ${{ secrets.E2E_FIREBASE_API_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Upload screenshots
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: seed-screenshots
          path: tests/e2e/seed/screenshots/
```

---

## 10. Script de Limpeza (`seed:clean`)

```typescript
// scripts/seed-clean.ts
// Remove APENAS dados criados pelo seed (identificados por prefixo no title)
// Convenção: todas as entrevistas do seed têm title prefixado com "[SEED]"

DELETE FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '[SEED]%');
DELETE FROM milestones WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '[SEED]%');
DELETE FROM projects WHERE name LIKE '[SEED]%';
DELETE FROM estimate_runs WHERE estimate_id IN (
  SELECT e.id FROM estimates e
  JOIN interviews i ON e.interview_id = i.id
  WHERE i.title LIKE '[SEED]%'
);
DELETE FROM estimates WHERE interview_id IN (SELECT id FROM interviews WHERE title LIKE '[SEED]%');
DELETE FROM documents WHERE interview_id IN (SELECT id FROM interviews WHERE title LIKE '[SEED]%');
DELETE FROM interview_messages WHERE interview_id IN (SELECT id FROM interviews WHERE title LIKE '[SEED]%');
DELETE FROM interviews WHERE title LIKE '[SEED]%';
```

---

## 11. Dependências Adicionais

```json
// Adicionar ao tests/e2e/package.json ou raiz como devDependencies
{
  "pdfkit": "^0.15.0",       // Gerar PDF fixture
  "docx": "^9.0.0",          // Gerar DOCX fixture
  "exceljs": "^4.4.0",       // Gerar XLSX fixture
  "pptxgenjs": "^3.12.0",    // Gerar PPTX fixture
  "pg": "^8.13.0"            // Acesso direto ao DB para seed
}
```

---

## 12. Estimativa de Esforço

| Etapa | Horas |
|---|---|
| Gerar fixtures de arquivo (PDF, DOCX, XLSX, CSV, PPTX) | 3h |
| Definir cenários de entrevista (7 cenários × mensagens) | 4h |
| Definir estimate results mock (5 resultados completos) | 3h |
| Definir projetos mock (5 projetos × milestones × tasks) | 2h |
| Script principal Playwright (interview flow via UI) | 6h |
| Helpers de DB seeding (estimates, projects) | 4h |
| Playwright config + pnpm scripts | 1h |
| GitHub Actions workflow | 1h |
| Script de limpeza | 1h |
| Testes do próprio seed (verifica dados no admin) | 2h |
| **Total** | **~27h** |

---

## 13. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| SSE timeout no chat (AI service lento) | Entrevista não completa | Retry com backoff; fallback para inserção DB direta das mensagens |
| Rate limiting no chat (1 msg por vez) | Seed lento | Await entre mensagens; usar timeout adequado |
| Firebase Auth rate limiting | Falha na auth | Reusar sessão entre entrevistas (1 auth, múltiplas entrevistas) |
| AI service down em dev | Upload de docs falha | Aceitar status `failed` nos documentos — seed ainda é útil |
| Schema de DB muda | Insert SQL quebra | Usar types do app como source of truth; CI verifica |

---

## 14. Critérios de Sucesso

Após rodar o seed, o admin deve mostrar:

- [ ] `/admin/cockpit` — 7 entrevistas com maturity variando de 0.15 a 0.93
- [ ] `/admin/cockpit/[id]` — Cada entrevista com histórico de mensagens e documentos
- [ ] `/admin/pipeline` — 5 estimates (1 pending_approval, 1 pending, 1 running, 1 done, 1 failed) + 1 approved
- [ ] `/admin/pipeline/[id]` — Agent steps com duração e tokens
- [ ] `/admin/dashboard` — Funil completo com números > 0 em todas as fases
- [ ] Projetos acessíveis com milestones e tasks em estados variados
- [ ] Cada entrevista com pelo menos 1 documento uploaded

---

## 15. Ordem de Implementação Sugerida

```
Fase 1 (Foundation):
  ├── playwright.seed.config.ts
  ├── seed-config.ts (constantes, DB connection)
  ├── Geração das 5 fixtures de arquivo
  └── Helper de auth (reuso do fixture existente)

Fase 2 (Data Definitions):
  ├── interview-scenarios.ts (7 cenários com todas as mensagens)
  ├── estimate-results.ts (5 results mock completos)
  └── project-definitions.ts (5 projetos com milestones/tasks)

Fase 3 (Helpers):
  ├── interview-helper.ts (criar entrevista, enviar msg, upload)
  ├── estimate-helper.ts (criar estimate, injetar result via DB)
  ├── project-helper.ts (criar projeto, milestones, tasks via DB)
  └── db-seeder.ts (connection pool, query helper)

Fase 4 (Script Principal):
  ├── seed-data-generator.spec.ts
  └── Verificação no admin (screenshots)

Fase 5 (CI/CD):
  ├── pnpm scripts (seed:e2e, seed:clean)
  ├── GitHub Actions workflow
  └── Script de limpeza
```
