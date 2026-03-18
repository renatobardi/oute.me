#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# oute.me — Cloud SQL Configuration
# Projeto: oute-488706
# Uso: ./infra/gcp/setup-sql.sh
#
# Aplica configurações de segurança e recuperação no Cloud SQL:
#   - Point-in-Time Recovery (PITR) com 7 dias de retenção de logs
#   - Query Insights para observabilidade de queries
#
# Requer: gcloud autenticado com permissão cloudsql.instances.update
# Downtime: nenhum (patch online)
# =============================================================================

PROJECT_ID="oute-488706"
SQL_INSTANCE="oute-postgres"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1" >&2; }
info() { echo -e "${CYAN}[i]${NC} $1"; }

preflight() {
  if ! command -v gcloud &>/dev/null; then
    err "gcloud CLI not found."
    exit 1
  fi
  gcloud config set project "$PROJECT_ID" --quiet

  # Verifica se a instância existe
  if ! gcloud sql instances describe "$SQL_INSTANCE" --project="$PROJECT_ID" &>/dev/null 2>&1; then
    err "Cloud SQL instance '${SQL_INSTANCE}' not found in project '${PROJECT_ID}'."
    exit 1
  fi
  log "Instance: ${SQL_INSTANCE} (project: ${PROJECT_ID})"
}

show_current_state() {
  echo ""
  echo "━━━ Estado atual ━━━"
  gcloud sql instances describe "$SQL_INSTANCE" \
    --project="$PROJECT_ID" \
    --format="table(
      name,
      settings.tier,
      settings.backupConfiguration.enabled,
      settings.backupConfiguration.pointInTimeRecoveryEnabled,
      settings.backupConfiguration.transactionLogRetentionDays,
      settings.insightsConfig.queryInsightsEnabled
    )"
}

enable_pitr() {
  echo ""
  echo "━━━ Habilitando Point-in-Time Recovery ━━━"
  info "PITR permite restaurar o banco para qualquer segundo dos últimos 7 dias."
  info "Sem downtime. Custo: armazenamento de transaction logs (~mínimo)."
  echo ""

  gcloud sql instances patch "$SQL_INSTANCE" \
    --project="$PROJECT_ID" \
    --enable-point-in-time-recovery \
    --retained-transaction-log-days=7 \
    --quiet

  log "PITR habilitado com retenção de 7 dias."
}

enable_query_insights() {
  echo ""
  echo "━━━ Habilitando Query Insights ━━━"
  info "Permite visualizar queries lentas e custo por query no Cloud SQL Studio."
  echo ""

  gcloud sql instances patch "$SQL_INSTANCE" \
    --project="$PROJECT_ID" \
    --insights-config-query-insights-enabled \
    --insights-config-record-application-tags \
    --insights-config-record-client-address \
    --quiet

  log "Query Insights habilitado."
}

show_final_state() {
  echo ""
  echo "━━━ Estado final ━━━"
  gcloud sql instances describe "$SQL_INSTANCE" \
    --project="$PROJECT_ID" \
    --format="table(
      name,
      settings.tier,
      settings.backupConfiguration.enabled,
      settings.backupConfiguration.pointInTimeRecoveryEnabled,
      settings.backupConfiguration.transactionLogRetentionDays,
      settings.insightsConfig.queryInsightsEnabled
    )"
}

main() {
  preflight
  show_current_state

  echo ""
  warn "Isso aplicará PITR + Query Insights na instância '${SQL_INSTANCE}'."
  warn "Pressione Enter para continuar ou Ctrl+C para cancelar."
  read -r

  enable_pitr
  enable_query_insights
  show_final_state

  echo ""
  log "Configuração do Cloud SQL concluída!"
  echo ""
  info "Para restaurar para um ponto específico:"
  echo "  gcloud sql instances clone ${SQL_INSTANCE} ${SQL_INSTANCE}-restore \\"
  echo "    --point-in-time=YYYY-MM-DDTHH:MM:SSZ"
  echo ""
  info "Query Insights disponível em:"
  echo "  console.cloud.google.com → Cloud SQL → ${SQL_INSTANCE} → Query insights"
}

main "$@"
