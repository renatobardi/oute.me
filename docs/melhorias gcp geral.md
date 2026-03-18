# Melhorias de Plataforma GCP (não-AI)

> Estudo de oportunidades de produtos GCP além de IA/ML no oute.me  
> Criado em: 2026-03-18 | Status: `draft`  
> Complementa: `docs/plans/melhorias-ia-gcp.md`

-----

## Metodologia

Este estudo parte da leitura do `CLAUDE.md`, `package.json`, `turbo.json` e da estrutura do monorepo. A análise cobre as seguintes camadas: **rede e entrega**, **banco de dados**, **segredos e IAM**, **observabilidade**, **CI/CD**, **armazenamento** e **segurança**. Cada oportunidade é avaliada por impacto real no oute.me — não por completude de catálogo GCP.

-----

## Inventário: O que já está correto

Antes das oportunidades, o diagnóstico honesto do que está bem resolvido:

|Recurso                |Status                                                          |
|-----------------------|----------------------------------------------------------------|
|Cloud Run (web + ai)   |✅ Correto. Scale-to-zero, sem VM, sem Docker Compose            |
|Cloud SQL PostgreSQL 16|✅ Correto. Managed, com pgvector                                |
|Google Cloud Storage   |✅ Correto. Separação dev/prod de buckets                        |
|Firebase Auth          |✅ Correto. ADR-05 bem fundamentado                              |
|Memorystore Redis      |✅ Correto. Apenas em prod, fallback em dev                      |
|Domain mapping + TLS   |✅ Correto. oute.me nativo GCP, oute.pro via CNAME + redirect 301|

O projeto está em GCP-only por decisão arquitetural (ADR-06). Isso é vantagem: menos fragmentação de vendor, mais coesão de IAM e billing.

-----

## Oportunidades Identificadas

-----

### 1. Secret Manager — substituir variáveis de ambiente com segredos

**Prioridade:** 🔴 Alta  
**Risco:** Muito Baixo  
**Esforço:** 4–6h

**O gap**  
Tanto `apps/web` quanto `apps/ai` carregam credenciais críticas via variáveis de ambiente (`FIREBASE_PRIVATE_KEY`, `DATABASE_URL`, `GEMINI_API_KEY`, `REDIS_URL`). No Cloud Run, isso significa que qualquer pessoa com permissão `run.services.get` consegue listar as env vars e ver os segredos em plaintext.

**Por que é problema real**

- `FIREBASE_PRIVATE_KEY` é uma chave RSA privada — se vazar, comprometem toda a autenticação
- `DATABASE_URL` com credentials embutidas expõe o Cloud SQL diretamente
- Rotação de segredos hoje exige redeploy do Cloud Run

**Solução: Cloud Secret Manager**

```bash
# Criar os segredos
gcloud secrets create firebase-private-key --replication-policy=automatic
gcloud secrets create database-url --replication-policy=automatic
gcloud secrets create redis-url --replication-policy=automatic

# Versionar
echo -n "$FIREBASE_PRIVATE_KEY" | gcloud secrets versions add firebase-private-key --data-file=-

# Dar acesso ao Service Account do Cloud Run
gcloud secrets add-iam-policy-binding firebase-private-key \
  --member="serviceAccount:oute-web@oute-488706.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**No Cloud Run — montar segredos como env vars automaticamente**

```yaml
# cloud-run-web.yaml
env:
  - name: FIREBASE_PRIVATE_KEY
    valueFrom:
      secretKeyRef:
        name: firebase-private-key
        version: latest
```

**Benefícios imediatos**

- Rotação sem redeploy
- Audit log nativo de cada acesso ao segredo
- Sem exposição no `gcloud run services describe`

**ADR sugerido:** ADR-11 — Secret Manager como fonte única de segredos de produção

-----

### 2. Cloud Armor — proteção da camada de borda

**Prioridade:** 🔴 Alta  
**Risco:** Baixo  
**Esforço:** 1 dia

**O gap**  
O oute.me expõe dois endpoints públicos críticos: `POST /api/chat/[id]/message` (SSE streaming com Gemini, custo por token) e `POST /api/chat/[id]/upload` (upload de documentos). Sem rate limiting na camada de borda, um atacante pode inflar seu custo GCP com requisições maliciosas antes de você perceber.

**Atualmente**  
Cloud Run expõe HTTP diretamente via Load Balancer. Não há WAF, rate limiting ou geo-blocking configurado.

**Solução: Cloud Armor + Cloud Load Balancing**

```bash
# Criar política de segurança
gcloud compute security-policies create oute-armor-policy \
  --description="WAF policy for oute.me"

# Rate limit no endpoint de chat (custo por chamada)
gcloud compute security-policies rules create 1000 \
  --security-policy=oute-armor-policy \
  --expression="request.path.matches('/api/chat/.*/message')" \
  --action=rate-based-ban \
  --rate-limit-threshold-count=20 \
  --rate-limit-threshold-interval-sec=60 \
  --ban-duration-sec=300 \
  --conform-action=allow \
  --exceed-action=deny-429

# Proteção OWASP Top 10
gcloud compute security-policies rules create 2000 \
  --security-policy=oute-armor-policy \
  --expression="evaluatePreconfiguredExpr('xss-stable')" \
  --action=deny-403

gcloud compute security-policies rules create 2001 \
  --security-policy=oute-armor-policy \
  --expression="evaluatePreconfiguredExpr('sqli-stable')" \
  --action=deny-403
```

**Regras prioritárias para o oute.me**

|Regra            |Endpoint             |Limite    |
|-----------------|---------------------|----------|
|Rate limit por IP|`/api/chat/*/message`|20 req/min|
|Rate limit por IP|`/api/chat/*/upload` |5 req/min |
|Rate limit por IP|`/api/estimates`     |3 req/min |
|OWASP XSS        |global               |block     |
|OWASP SQLi       |global               |block     |

**Custo:** ~$5/mês pela política + $0.75/milhão de requisições avaliadas.

-----

### 3. Cloud SQL — ajustes críticos de configuração

**Prioridade:** 🔴 Alta  
**Risco:** Médio (requer janela de manutenção)  
**Esforço:** 4h

**O gap identificado**  
O CLAUDE.md define `db-f1-micro` em dev e `db-g1-small` em prod. Dois problemas sérios:

**Problema 1 — `db-g1-small` é insuficiente para produção SaaS com pgvector**  
`db-g1-small` tem 1 vCPU compartilhada e 1.7GB RAM. O índice IVFFlat do pgvector para `ai.knowledge_vectors` (768 dims) com carga concorrente vai saturar isso rapidamente. Recomendação mínima real: `db-n1-standard-2` (2 vCPU, 7.5GB RAM).

**Problema 2 — Sem backups point-in-time configurados explicitamente**  
O CLAUDE.md não menciona política de backup. Cloud SQL tem backup automático por padrão, mas sem PITR (Point-in-Time Recovery) habilitado, a janela de recuperação é limitada ao último backup diário.

**Correções**

```bash
# Upgrade de tier (prod)
gcloud sql instances patch oute-production \
  --tier=db-n1-standard-2 \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=3

# Habilitar PITR
gcloud sql instances patch oute-production \
  --enable-point-in-time-recovery \
  --retained-transaction-log-days=7

# Habilitar insights de query (Query Insights)
gcloud sql instances patch oute-production \
  --insights-config-query-insights-enabled \
  --insights-config-record-application-tags \
  --insights-config-record-client-address
```

**Cloud SQL Query Insights** é especialmente valioso aqui: você consegue ver quais queries do pipeline CrewAI estão custando mais no banco, sem instrumentação manual.

-----

### 4. Cloud CDN — cache de assets estáticos do SvelteKit

**Prioridade:** 🟡 Média  
**Risco:** Muito Baixo  
**Esforço:** 2–3h

**O gap**  
O SvelteKit em Cloud Run serve tanto a aplicação dinâmica (BFF, SSR) quanto os assets estáticos (`/_app/immutable/...`). Esses assets são imutáveis por build — o hash no nome garante isso. Servir via Cloud Run gasta instâncias e introduz latência desnecessária.

**Solução**  
Configurar Cloud CDN na frente do Cloud Run para cachear os assets imutáveis do SvelteKit.

```bash
# Habilitar CDN no backend do Load Balancer
gcloud compute backend-services update oute-web-backend \
  --enable-cdn \
  --cache-mode=CACHE_ALL_STATIC \
  --global

# Cache explícito para assets imutáveis do SvelteKit
gcloud compute url-maps import oute-urlmap --global << EOF
  headerAction:
    responseHeadersToAdd:
      - headerName: Cache-Control
        headerValue: "public, max-age=31536000, immutable"
        replace: true
  matchRules:
    - prefixMatch: "/_app/immutable/"
EOF
```

**Impacto real**

- Assets imutáveis servidos do edge GCP (~10ms) vs. Cold start Cloud Run (~800ms)
- Redução direta de custo de instâncias Cloud Run
- TTFB (Time to First Byte) melhorado para usuários fora da região primary

-----

### 5. Cloud Logging — estruturação e alertas operacionais

**Prioridade:** 🟡 Média  
**Risco:** Muito Baixo  
**Esforço:** 1 dia

**O gap**  
Cloud Run captura stdout/stderr automaticamente no Cloud Logging, mas logs não estruturados são difíceis de filtrar e criar alertas. O FastAPI provavelmente usa `print()` ou `logging` simples hoje.

**Solução: logs JSON estruturados**

```python
# apps/ai/src/core/logging.py
import json
import logging
import sys
from typing import Any

class StructuredLogger:
    def __init__(self, name: str):
        self.name = name

    def _emit(self, severity: str, message: str, **kwargs: Any):
        entry = {
            "severity": severity,
            "message": message,
            "logger": self.name,
            **kwargs
        }
        print(json.dumps(entry), file=sys.stdout, flush=True)

    def info(self, msg: str, **kw): self._emit("INFO", msg, **kw)
    def warning(self, msg: str, **kw): self._emit("WARNING", msg, **kw)
    def error(self, msg: str, **kw): self._emit("ERROR", msg, **kw)

# Uso nos handlers
logger = StructuredLogger("estimate.pipeline")
logger.info("pipeline started", job_id=job_id, interview_id=interview_id)
logger.error("agent failed", agent="cost_specialist", error=str(e))
```

**Alertas prioritários a criar no Cloud Logging**

```bash
# Alerta: pipeline de estimativa falhando
gcloud logging metrics create estimate_pipeline_errors \
  --description="Erros no pipeline CrewAI" \
  --log-filter='jsonPayload.logger="estimate.pipeline" AND jsonPayload.severity="ERROR"'

# Alerta: latência SSE > 5s no primeiro chunk
gcloud logging metrics create chat_sse_slow \
  --description="SSE lento no chat" \
  --log-filter='jsonPayload.event="sse_first_chunk" AND jsonPayload.latency_ms>5000'
```

-----

### 6. Cloud Build — CI/CD nativo GCP

**Prioridade:** 🟡 Média  
**Risco:** Baixo  
**Esforço:** 1–2 dias

**O gap**  
O repo tem `.github/workflows/` mas o CLAUDE.md não detalha o pipeline de CI/CD. Dado o ADR-06 (GCP-only), usar GitHub Actions para fazer deploy no Cloud Run funciona mas introduz dependência externa e exige gerenciar Workload Identity Federation do GitHub → GCP.

**Alternativa: Cloud Build com triggers nativos**

```yaml
# cloudbuild.yaml
steps:
  # 1. Install e lint (monorepo)
  - name: 'node:24'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        npm install -g pnpm@10.30.3
        pnpm install --frozen-lockfile
        pnpm turbo run lint build

  # 2. Testes Python
  - name: 'python:3.12'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        pip install uv
        cd apps/ai && uv sync && uv run pytest

  # 3. Build e push imagens Docker
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/oute-488706/oute-web:$COMMIT_SHA', './apps/web']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/oute-488706/oute-ai:$COMMIT_SHA', './apps/ai']

  # 4. Deploy no Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'gcloud'
    args:
      - 'run', 'deploy', 'oute-web'
      - '--image', 'gcr.io/oute-488706/oute-web:$COMMIT_SHA'
      - '--region', 'us-central1'
      - '--platform', 'managed'

options:
  machineType: 'E2_HIGHCPU_8'
  logging: CLOUD_LOGGING_ONLY

timeout: '1200s'
```

**Vantagem sobre GitHub Actions**

- Build roda dentro do projeto GCP — sem exfiltração de credenciais para runner externo
- Cache de layers Docker no Artifact Registry nativo
- Turbo cache pode ser integrado com GCS bucket
- Custo: 120 min/dia gratuitos, depois $0.003/build-min

**Se mantiver GitHub Actions:** certifique-se de usar Workload Identity Federation (sem service account keys em GitHub Secrets) — padrão que você já conhece.

-----

### 7. Artifact Registry — repositório de imagens Docker

**Prioridade:** 🟡 Média  
**Risco:** Muito Baixo  
**Esforço:** 2h

**O gap**  
O Container Registry (`gcr.io`) foi depreciado pelo Google em favor do Artifact Registry. Se o pipeline atual usa `gcr.io`, é necessário migrar.

```bash
# Criar repositório no Artifact Registry
gcloud artifacts repositories create oute-images \
  --repository-format=docker \
  --location=us-central1 \
  --description="Imagens Docker do oute.me"

# Configurar autenticação
gcloud auth configure-docker us-central1-docker.pkg.dev

# Novo padrão de tag
# Antes: gcr.io/oute-488706/oute-web:tag
# Depois: us-central1-docker.pkg.dev/oute-488706/oute-images/oute-web:tag
```

**Benefícios**

- Vulnerability scanning nativo por push (Container Analysis)
- Políticas de retenção automática de imagens antigas
- Suporte a múltiplos formatos (Docker, npm, Python, Maven) — útil se quiser publicar `@oute/ui` internamente

-----

### 8. Cloud Scheduler — jobs recorrentes

**Prioridade:** 🟢 Baixa  
**Risco:** Muito Baixo  
**Esforço:** 2h  
**Fase alvo:** Fase 4+

**O gap**  
À medida que o oute.me cresce, surgirão necessidades de jobs recorrentes que hoje não têm infraestrutura: limpeza de interviews abandonadas, re-embedding de knowledge vectors desatualizados, relatórios de uso, expiração de sessões de estimativa.

**Solução: Cloud Scheduler + Cloud Tasks (ou Cloud Run Jobs)**

```bash
# Exemplo: limpeza de interviews abandonadas (diária às 3h)
gcloud scheduler jobs create http cleanup-abandoned-interviews \
  --location=us-central1 \
  --schedule="0 3 * * *" \
  --uri="https://oute-ai-[hash].run.app/maintenance/cleanup-interviews" \
  --message-body='{"max_age_hours": 72}' \
  --oidc-service-account-email="oute-scheduler@oute-488706.iam.gserviceaccount.com" \
  --time-zone="America/Sao_Paulo"
```

**Jobs candidatos a scheduling**

|Job                                               |Frequência|Serviço         |
|--------------------------------------------------|----------|----------------|
|Limpeza de interviews abandonadas (>72h)          |Diária 3h |FastAPI         |
|Re-indexação de knowledge vectors obsoletos       |Semanal   |FastAPI         |
|Snapshot de métricas de uso (maturity avg, tokens)|Horária   |FastAPI         |
|Purge de job_state expirados (`ai.job_state`)     |Diária 4h |Cloud SQL direto|

-----

### 9. VPC + Cloud SQL Private IP

**Prioridade:** 🟢 Baixa (mas estratégica para produção enterprise)  
**Risco:** Alto (mudança de rede exige planejamento)  
**Esforço:** 1 dia + janela de manutenção  
**Fase alvo:** Fase 5 (produção)

**O gap**  
A comunicação do Cloud Run com o Cloud SQL provavelmente ocorre via Cloud SQL Auth Proxy com IP público. Em produção SaaS com dados de clientes, o ideal é tráfego interno via VPC Private IP — o banco nunca exposto à internet.

**Configuração**

```bash
# Criar VPC dedicada
gcloud compute networks create oute-vpc \
  --subnet-mode=custom

gcloud compute networks subnets create oute-subnet-primary \
  --network=oute-vpc \
  --region=us-central1 \
  --range=10.0.0.0/24

# Private Service Connection para Cloud SQL
gcloud compute addresses create oute-sql-private-range \
  --global \
  --purpose=VPC_PEERING \
  --prefix-length=16 \
  --network=oute-vpc

gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges=oute-sql-private-range \
  --network=oute-vpc

# Habilitar Private IP no Cloud SQL
gcloud sql instances patch oute-production \
  --network=oute-vpc \
  --no-assign-ip

# Cloud Run com VPC connector
gcloud run services update oute-web \
  --vpc-connector=oute-vpc-connector \
  --region=us-central1
```

**Resultado:** `DATABASE_URL` passa a apontar para IP interno `10.x.x.x`. Sem Cloud SQL Auth Proxy, sem IP público exposto no banco.

-----

## Produtos Descartados (com justificativa)

|Produto             |Razão                                                                                                                                                |
|--------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
|**GKE (Kubernetes)**|Cloud Run cobre 100% dos casos de uso atuais com menor overhead operacional. GKE só faz sentido com >10 serviços e necessidade de sidecar containers.|
|**Pub/Sub**         |Cloud Tasks é suficiente para os jobs atuais (estimativa pipeline). Pub/Sub adiciona complexidade de fan-out que não existe no modelo atual.         |
|**Spanner**         |PostgreSQL 16 + Cloud SQL é adequado para o volume e modelo de dados do oute.me. Spanner é para escala global multi-região com >10k QPS.             |
|**Dataflow**        |Sem pipeline de dados em batch ou streaming que justifique.                                                                                          |
|**Firebase Hosting**|ADR-01 define SvelteKit como BFF único. Firebase Hosting quebraria o modelo de SSR e proxy.                                                          |
|**Apigee**          |Overkill para API gateway com 2 serviços internos. Cloud Armor + Cloud Run são suficientes.                                                          |
|**Cloud Functions** |Cloud Run Jobs cobrem o caso de uso. Misturar Functions e Run fragmenta a arquitetura.                                                               |

-----

## Roadmap de Implementação

```
Imediato (qualquer fase)
  ├── [GCP-PLT-01] Secret Manager ─────────────────────── 🔴 sem depender de fase
  └── [GCP-PLT-02] Cloud Armor ────────────────────────── 🔴 antes de qualquer tráfego real

Fase 3 (Estimate Pipeline)
  ├── [GCP-PLT-03] Cloud SQL tier upgrade + PITR ──────── 🔴 antes de prod
  └── [GCP-PLT-04] Artifact Registry ─────────────────── 🟡 junto com CI/CD

Fase 4 (Project Management)
  ├── [GCP-PLT-05] Cloud CDN para assets SvelteKit ────── 🟡
  ├── [GCP-PLT-06] Cloud Logging estruturado ──────────── 🟡
  ├── [GCP-PLT-07] Cloud Build (avaliar vs GitHub Actions) 🟡
  └── [GCP-PLT-08] Cloud Scheduler para jobs recorrentes  🟢

Fase 5 (Produção enterprise)
  └── [GCP-PLT-09] VPC + Cloud SQL Private IP ─────────── 🟢 pré-enterprise
```

-----

## Estimativa de Custo Incremental (prod)

|Item                                       |Custo estimado/mês|
|-------------------------------------------|------------------|
|Secret Manager (~10 segredos, <10k acessos)|~$0.06            |
|Cloud Armor (política + 1M req)            |~$5.75            |
|Cloud SQL upgrade (db-n1-standard-2)       |~$50 adicional    |
|Cloud CDN (primeiros 10GB)                 |~$0.08            |
|Cloud Build (além do free tier)            |~$2–5             |
|Cloud Scheduler (3 jobs)                   |$0 (free tier)    |
|**Total incremental**                      |**~$58–62/mês**   |

O maior driver de custo é o upgrade do Cloud SQL — que é necessário, não opcional, para produção com pgvector sob carga.

-----

## Issues Sugeridas no Linear

|ID sugerido|Título                                                    |Fase    |
|-----------|----------------------------------------------------------|--------|
|OUTE-PLT-01|Migrar segredos de env vars para Secret Manager           |Imediato|
|OUTE-PLT-02|Configurar Cloud Armor com rate limiting e OWASP          |Imediato|
|OUTE-PLT-03|Upgrade Cloud SQL para db-n1-standard-2 + habilitar PITR  |Fase 3  |
|OUTE-PLT-04|Migrar Container Registry para Artifact Registry          |Fase 3  |
|OUTE-PLT-05|Configurar Cloud CDN para assets imutáveis SvelteKit      |Fase 4  |
|OUTE-PLT-06|Implementar logs JSON estruturados + alertas Cloud Logging|Fase 4  |
|OUTE-PLT-07|Avaliar migração CI/CD para Cloud Build                   |Fase 4  |
|OUTE-PLT-08|Implementar Cloud Scheduler para jobs de manutenção       |Fase 4  |
|OUTE-PLT-09|VPC privada + Cloud SQL Private IP                        |Fase 5  |

-----

## Referências

- [Secret Manager — Cloud Run integration](https://cloud.google.com/run/docs/configuring/secrets)
- [Cloud Armor — rate limiting](https://cloud.google.com/armor/docs/rate-limiting-overview)
- [Cloud SQL — PITR](https://cloud.google.com/sql/docs/postgres/backup-recovery/pitr)
- [Cloud SQL Query Insights](https://cloud.google.com/sql/docs/postgres/using-query-insights)
- [Cloud CDN — cache modes](https://cloud.google.com/cdn/docs/caching)
- [Artifact Registry — Docker](https://cloud.google.com/artifact-registry/docs/docker/quickstart)
- [Cloud Build — Cloud Run deploy](https://cloud.google.com/build/docs/deploying-builds/deploy-cloud-run)
- [Cloud Scheduler](https://cloud.google.com/scheduler/docs)
- [VPC — Cloud SQL Private IP](https://cloud.google.com/sql/docs/postgres/configure-private-ip)