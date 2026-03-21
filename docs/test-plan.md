# Plano de Testes — oute.me

> Usuário de referência: **renatobardicabral@gmail.com**
> Seed: `database/seeds/001_test_data.sql`
> UUIDs fixos: `aaaaaaaa-0001-...` (entrevistas), `bbbbbbbb-0001-...` (estimativas), `cccccccc-0001-...` (projeto)

---

## 1. Autenticação

| # | Caso | Pré-condição | Passos | Esperado |
|---|------|-------------|--------|---------|
| 1.1 | Login com conta existente | Usuário cadastrado | Acessa `/`, clica "Entrar", faz login com Google | Redireciona para `/interviews` |
| 1.2 | Redirect autenticado | Logado | Acessa `/` | Redireciona para `/interviews` |
| 1.3 | Proteção de rota | Não logado | Acessa `/interviews` diretamente | Redireciona para `/` (login) |
| 1.4 | Logout | Logado | Clica "Sair" | Sessão encerrada, redireciona para `/` |

---

## 2. Entrevistas — Listagem

| # | Caso | Pré-condição | Passos | Esperado |
|---|------|-------------|--------|---------|
| 2.1 | Aba "Ativas" (padrão) | Seed rodado | Acessa `/interviews` | Mostra iw1 (in_progress) e iw2 (ready), iw4–iw7 (com estimativas ativas). iw3 (arquivada) não aparece |
| 2.2 | Aba "Todas" | Seed rodado | Clica tab "Todas" | Mostra todas as 7 entrevistas incluindo iw3 arquivada |
| 2.3 | Aba "Arquivadas" | Seed rodado | Clica tab "Arquivadas" | Mostra apenas iw3 |
| 2.4 | Nova entrevista | Logado | Clica "Nova Entrevista" | Cria nova entrevista e redireciona para `/interviews/[id]` |
| 2.5 | Maturity bar | Seed rodado | Visualiza iw2 | Barra de maturidade mostra ~0.79 (verde) |

---

## 3. Chat de Entrevista

| # | Caso | Pré-condição | Passos | Esperado |
|---|------|-------------|--------|---------|
| 3.1 | Enviar mensagem | iw1 aberta | Digita mensagem e envia | Resposta do Entrevistador via SSE, maturidade atualiza |
| 3.2 | Input liberado imediatamente | iw1 aberta | Envia mensagem, aguarda resposta | Input fica disponível após receber resposta IA (não espera `state_update`) |
| 3.3 | Upload de documento | iw1 aberta | Arrasta ou seleciona arquivo PDF | Documento aparece na lista de anexos, status "processing" → "completed" |
| 3.4 | Solicitação de estimativa — maturidade insuficiente | iw1 (maturity ~0.5) | Clica "Solicitar Estimativa" | Botão aparece desabilitado ou não aparece ainda |
| 3.5 | Solicitação de estimativa — maturidade OK | iw2 (maturity ≥ 0.70) | Abre iw2, clica "Solicitar Estimativa" | Pipeline inicia, redireciona para `/estimates/[id]` com status "pending" |
| 3.6 | Erro de estimativa — mensagem clara | Estimativa falha (iw6 como referência) | Simula erro ou usa iw6 | Mensagem de erro específica (ex: "Erro ao solicitar estimativa: Bad Request"), não mensagem genérica |
| 3.7 | Deletar documento | iw1 com documento anexado | Clica ícone excluir no documento | Documento removido da lista, confirmação visual |

---

## 4. Pipeline de Estimativa

| # | Caso | Pré-condição | Passos | Esperado |
|---|------|-------------|--------|---------|
| 4.1 | Estimativa "pending" | est4 (`bbbbbbbb-0001-...0004`) | Acessa `/estimates/bbbbbbbb-0001-0000-0000-000000000004` | Stepper com 6 agentes, todos "pending" |
| 4.2 | Estimativa "done" | est5 | Acessa `/estimates/bbbbbbbb-0001-0000-0000-000000000005` | Resultado completo: sumário executivo, milestones, cenários de custo, tech stack |
| 4.3 | Estimativa "failed" | est6 | Acessa `/estimates/bbbbbbbb-0001-0000-0000-000000000006` | Stepper mostra agente(s) com status "failed" em vermelho, botão "Tentar novamente" visível |
| 4.4 | Estimativa "approved" | est7 | Acessa `/estimates/bbbbbbbb-0001-0000-0000-000000000007` | Exibe resultado, badge "Aprovada", link para projeto criado |
| 4.5 | Re-run completo | est6 (failed) | Clica "Tentar novamente" → não muda from_agent → confirma | Pipeline reinicia do zero, job_id atualizado, stepper volta para "pending" |
| 4.6 | Re-run parcial | est6 (failed) | Clica "Tentar novamente", seleciona agente específico, confirma | Pipeline reroda a partir do agente selecionado, outputs anteriores reutilizados |
| 4.7 | Seletor de modelo LLM | est6 | Abre modal re-run | Dropdown com opções: Gemini 2.5 Flash, Flash Lite, Pro |
| 4.8 | Aprovação de estimativa | est5 (done) | Clica "Aprovar Estimativa" | Estimativa marcada "approved", projeto criado, redireciona para `/projects/[id]` |
| 4.9 | Polling de status | est4 (pending) | Aguarda na página | Página atualiza status automaticamente a cada ~3s sem reload manual |

---

## 5. Projetos

| # | Caso | Pré-condição | Passos | Esperado |
|---|------|-------------|--------|---------|
| 5.1 | Título da página | Logado | Acessa `/projects` | Título "Meus Projetos" (não "Projetos") |
| 5.2 | Sem botão "Nova Entrevista" | Logado | Acessa `/projects` | Não há botão "Nova Entrevista" na página de projetos |
| 5.3 | Aba "Ativos" (padrão) | Seed rodado | Acessa `/projects` | Mostra proj7 (active) |
| 5.4 | Aba "Todos" | Seed rodado | Clica "Todos" | Mostra todos os projetos |
| 5.5 | Aba "Arquivados" | Sem projetos arquivados | Clica "Arquivados" | Lista vazia, mensagem "Nenhum projeto arquivado" |
| 5.6 | Detalhe do projeto | proj7 (`cccccccc-0001-...0007`) | Clica no projeto | Abre `/projects/[id]` com 3 milestones e 9 tasks |

---

## 6. Admin — Cockpit de Entrevistas

> Acesso: somente usuário `is_admin = true`

| # | Caso | Pré-condição | Passos | Esperado |
|---|------|-------------|--------|---------|
| 6.1 | Lista de entrevistas | Admin logado | Acessa `/admin/cockpit` | Lista todas as entrevistas de todos os usuários |
| 6.2 | Filtro padrão "Ativas" | Admin logado | Abre cockpit | Tab "Ativas" selecionada por padrão |
| 6.3 | Detalhe de entrevista | Qualquer entrevista | Clica em uma entrevista | Painel lateral com tabs: Messages, Documents, Pipeline |
| 6.4 | Tab Pipeline — sem estimativa | iw1 ou iw2 | Seleciona entrevista, clica tab Pipeline | Mensagem "Nenhuma estimativa" ou estado vazio |
| 6.5 | Tab Pipeline — estimativa done | iw5 ou iw7 | Seleciona entrevista com est done, tab Pipeline | Timeline dos agentes com durações, outputs expandíveis |
| 6.6 | Tab Pipeline — estimativa failed | iw6 | Seleciona iw6, tab Pipeline | Agente falho destacado em vermelho, detalhes do erro |
| 6.7 | Botão Re-run no cockpit | iw6 (est failed) | Clica "Re-run Pipeline" | Abre modal com: modelo LLM, from_agent pré-selecionado no agente falho |
| 6.8 | Re-run parcial via cockpit | Modal aberto | Confirma re-run (ou muda agente) | Pipeline reiniciado, job_id atualizado na estimativa |
| 6.9 | Re-run modelo diferente | Modal aberto | Muda modelo para "gemini-2.5-pro", confirma | Pipeline usa modelo selecionado |

---

## 7. Admin — Agentes

| # | Caso | Pré-condição | Passos | Esperado |
|---|------|-------------|--------|---------|
| 7.1 | Lista de agentes | Admin logado | Acessa `/admin/agents` | 6 agentes listados com chave, nome e instrução atual |
| 7.2 | Editar instrução | Admin logado | Clica em agente, edita textarea, salva | Instrução atualizada no banco, usada no próximo rerun |
| 7.3 | Preview de output | Alguma run "done" existe | Clica em agente | Seção "Último Output" aparece com JSON do output do agente |
| 7.4 | Output de agente sem run | Nenhuma run concluída | Clica em agente | Seção output não aparece ou exibe "Sem dados disponíveis" |
| 7.5 | Instrução vazia | Admin logado | Apaga instrução e salva | Campo salvo vazio, sem erro |

---

## 8. Admin — Base de Conhecimento

| # | Caso | Pré-condição | Passos | Esperado |
|---|------|-------------|--------|---------|
| 8.1 | Lista de vetores | Admin logado | Acessa `/admin/knowledge` | Lista de entradas na base vetorial |
| 8.2 | Adicionar entrada | Admin logado | Preenche formulário e submete | Nova entrada embedada e salva no pgvector |

---

## 9. Casos de Borda

| # | Caso | Pré-condição | Passos | Esperado |
|---|------|-------------|--------|---------|
| 9.1 | Acesso a recurso de outro usuário | Usuário B logado | Tenta acessar `/interviews/aaaaaaaa-0001-0000-0000-000000000001` (do usuário A) | Retorna 404 ou 403 |
| 9.2 | Acesso admin sem permissão | Usuário comum logado | Acessa `/admin/cockpit` | Redireciona ou exibe 403 |
| 9.3 | Rerun de estimativa em execução | est com status "running" | Tenta rerun | Botão desabilitado ou erro "Estimativa já em execução" |
| 9.4 | Aprovação de estimativa já aprovada | est7 (approved) | Tenta aprovar novamente | Erro ou botão ausente |
| 9.5 | Seed idempotente | Seed já rodado | Roda `001_test_data.sql` novamente | Sem erro, dados recriados corretamente |
| 9.6 | Entrevista sem maturidade suficiente | iw1 (~0.5) | Tenta solicitar estimativa | UI não exibe botão "Solicitar" ou exibe com aviso de maturidade insuficiente |

---

## 10. Infraestrutura (Pré-deploy)

| # | Caso | Verificação |
|---|------|------------|
| 10.1 | Migrations aplicadas | Verificar tabelas `ai.job_state.agent_steps`, `public.estimate_runs`, colunas extras em `agent_instructions` |
| 10.2 | Health check | `GET /health/services` retorna postgres=ok, vertex_ai=ok |
| 10.3 | Seed no banco dev | `psql $DATABASE_URL -f database/seeds/001_test_data.sql` sem erros |
| 10.4 | Deploy web | Cloud Run responde em oute.pro sem erros 5xx |
| 10.5 | Deploy AI | `GET [AI_SERVICE_URL]/health/services` retorna 200 |

---

## Execução das Migrations

Antes de validar os cenários de estimativa, aplicar no banco dev:

```sql
-- 015: agent_steps na tabela estimates
\i database/migrations/015_agent_steps.sql

-- 016: tabela estimate_runs
\i database/migrations/016_estimate_runs.sql

-- 017: temperature, max_tokens, enabled em agent_instructions
\i database/migrations/017_agent_config.sql
```

Depois rodar o seed:

```bash
psql $DATABASE_URL -f database/seeds/001_test_data.sql
```

---

## Referência de UUIDs do Seed

| UUID | Tipo | Estado |
|------|------|--------|
| `aaaaaaaa-0001-0000-0000-000000000001` | Interview | in_progress (maturity ~0.50) |
| `aaaaaaaa-0001-0000-0000-000000000002` | Interview | ready (maturity ~0.79) |
| `aaaaaaaa-0001-0000-0000-000000000003` | Interview | archived |
| `aaaaaaaa-0001-0000-0000-000000000004` | Interview | com estimativa pending |
| `aaaaaaaa-0001-0000-0000-000000000005` | Interview | com estimativa done |
| `aaaaaaaa-0001-0000-0000-000000000006` | Interview | com estimativa failed |
| `aaaaaaaa-0001-0000-0000-000000000007` | Interview | com estimativa approved → projeto |
| `bbbbbbbb-0001-0000-0000-000000000004` | Estimate | pending |
| `bbbbbbbb-0001-0000-0000-000000000005` | Estimate | done |
| `bbbbbbbb-0001-0000-0000-000000000006` | Estimate | failed |
| `bbbbbbbb-0001-0000-0000-000000000007` | Estimate | approved |
| `cccccccc-0001-0000-0000-000000000007` | Project | active (3 milestones, 9 tasks) |
