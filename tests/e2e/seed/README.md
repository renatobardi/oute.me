# Seed Data Generator

Gera massa de dados completa no ambiente dev: 7 entrevistas, 6 estimativas e 5 projetos cobrindo todas as fases do pipeline.

## Pré-requisitos

Variáveis de ambiente (pode usar `.env` na raiz do repo):

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
E2E_BASE_URL=http://localhost:5173
E2E_TEST_EMAIL=e2e-test@oute.pro
E2E_TEST_PASSWORD=...
E2E_FIREBASE_API_KEY=...
```

## Uso

```bash
# 1. Gera os arquivos de fixture (PDF, DOCX, XLSX, PPTX) — só precisa rodar uma vez
pnpm seed:fixtures

# 2. Sobe o app localmente
pnpm dev

# 3. Roda o seed (em outro terminal)
pnpm seed:e2e

# 4. Para limpar os dados gerados
pnpm seed:clean
```

## O que é gerado

| Tipo | Qtd | Detalhes |
|---|---|---|
| Entrevistas | 7 | Maturity 0.15 → 0.93, cada uma com 2–12 mensagens e 1 documento |
| Estimativas | 6 | Status: `pending_approval`, `pending`, `running`, `done`, `failed`, `approved` |
| Projetos | 5 | Do recém-criado ao finalizado, com milestones e tasks variados |

Todos os títulos têm prefixo `[SEED]` — o `seed:clean` remove só eles, sem tocar em dados reais.

## Via GitHub Actions (sem rodar local)

```bash
gh workflow run seed-data.yml --ref develop -f environment=dev
```

Com limpeza prévia:
```bash
gh workflow run seed-data.yml --ref develop -f environment=dev -f clean_before=true
```

Screenshots ficam disponíveis como artefato da run em `seed-screenshots-dev-<N>`.

## Arquivos de fixture

Se os binários (PDF/DOCX/XLSX/PPTX) não existirem em `fixtures/`, rode `pnpm seed:fixtures` primeiro. O CSV (`sample-timeline.csv`) já está commitado e não precisa ser gerado.

## Estrutura

```
seed/
├── seed-data-generator.spec.ts  # script principal
├── seed-config.ts               # auth, constantes, BASE_URL
├── generate-fixtures.ts         # gera os arquivos binários
├── data/
│   ├── interview-scenarios.ts   # 7 cenários com mensagens reais
│   ├── estimate-results.ts      # results mock + agent steps
│   └── project-definitions.ts  # 5 projetos com milestones/tasks
├── helpers/
│   ├── db-seeder.ts             # pool pg, query helpers
│   ├── interview-helper.ts      # criar entrevista, enviar msgs, upload
│   ├── estimate-helper.ts       # trigger API, injetar result via DB
│   └── project-helper.ts       # criar projeto, milestones, tasks
└── fixtures/
    └── sample-timeline.csv      # fixture CSV estático
```
