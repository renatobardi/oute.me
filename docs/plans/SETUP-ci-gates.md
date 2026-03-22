# Setup: CI Gates & Branch Protection

Guia para configurar os novos gates (Auto-Fix e DEV Deploy Gate) no GitHub.

## Pré-requisitos

### 1. Adicionar ANTHROPIC_API_KEY como secret

O workflow de auto-fix precisa de uma API key da Anthropic para rodar o Claude Code CLI.

```
GitHub → Settings → Secrets and variables → Actions → New repository secret
```

- **Name**: `ANTHROPIC_API_KEY`
- **Value**: sua API key da Anthropic (começa com `sk-ant-...`)
- **Escopo**: Repository secret (não environment secret)

> Custo estimado: cada auto-fix consome ~$0.05–0.30 dependendo da complexidade do erro.
> Com o limite de 1 tentativa por falha, o custo mensal deve ser baixo.

### 2. Permitir que workflow_run funcione

Os dois novos workflows usam `workflow_run` event, que:
- Roda no contexto da branch **default** (main), não da branch do PR
- Tem acesso a secrets (diferente de `pull_request` de forks)
- Precisa que o workflow "pai" (PR Gate, Deploy DEV) exista na branch default

Isso significa: **faça merge desses workflows para `main` primeiro**, antes de testar.

---

## Configuração do Branch Protection

### Branch: `develop`

```
GitHub → Settings → Branches → Branch protection rules → develop
```

| Setting | Valor |
|---|---|
| Require a pull request before merging | ✅ |
| Required approvals | 1 |
| Dismiss stale pull request approvals when new commits are pushed | ✅ |
| Require status checks to pass before merging | ✅ |
| **Required status checks** | `PR Status Summary` |
| Require branches to be up to date before merging | ✅ |

> **Nota sobre auto-fix**: quando o auto-fix commita na branch do PR, o GitHub
> automaticamente invalida aprovações anteriores (por causa do "dismiss stale approvals").
> Isso é intencional — você deve revisar o que o Claude mudou antes de aprovar.

### Branch: `main`

```
GitHub → Settings → Branches → Branch protection rules → main
```

| Setting | Valor |
|---|---|
| Require a pull request before merging | ✅ |
| Required approvals | 1 |
| Dismiss stale pull request approvals when new commits are pushed | ✅ |
| Require status checks to pass before merging | ✅ |
| **Required status checks** | `PR Status Summary` + `dev-deploy-gate` |
| Require branches to be up to date before merging | ✅ |

O status check `dev-deploy-gate` é criado pelo workflow `3-dev-deploy-gate.yml`.
Ele só aparece na lista de status checks disponíveis **depois** de rodar pela primeira vez.

**Bootstrapping**: na primeira vez, faça merge dos workflows para main, depois faça
um push qualquer para develop para triggerar o deploy-dev e criar o primeiro status.
Aí sim configure o required status check.

---

## Ordem de implementação

1. **Commit e push os dois workflows novos para `develop`** (`2-auto-fix-pr.yml` e `3-dev-deploy-gate.yml`)
2. **Crie PR de develop → main** e faça merge (para que os workflows existam na branch default)
3. **Adicione o secret** `ANTHROPIC_API_KEY` no GitHub
4. **Force um deploy de develop** (push qualquer para develop) para que `dev-deploy-gate` rode pela primeira vez
5. **Configure branch protection** para `main` adicionando `dev-deploy-gate` como required status check
6. **Teste o auto-fix**: crie uma branch com um erro de lint proposital, abra PR → develop, espere o auto-fix rodar

---

## Verificação

Depois de configurar, verifique:

- [ ] PR para develop exige `PR Status Summary` verde
- [ ] Se PR falha, auto-fix roda e commita (verifique na aba Actions)
- [ ] Auto-fix não roda se o commit anterior já foi auto-fix (loop prevention)
- [ ] PR para main exige `PR Status Summary` + `dev-deploy-gate`
- [ ] Se deploy de develop falhou, PR develop→main fica bloqueado
- [ ] Após fix no develop + deploy verde, PR develop→main desbloqueia

---

## Troubleshooting

**Auto-fix não roda**: verificar se `ANTHROPIC_API_KEY` está configurado e se o
workflow `PR Gate` tem exatamente o nome `PR Gate` (o `workflow_run` matcher é por nome).

**dev-deploy-gate não aparece nos required checks**: o status check precisa existir
pelo menos uma vez no repositório. Force um deploy de develop para criá-lo.

**Auto-fix entra em loop**: não deveria acontecer (GITHUB_TOKEN + check de commit message),
mas se acontecer, desabilite o workflow temporariamente em Actions → Auto-Fix PR → ⋯ → Disable.
