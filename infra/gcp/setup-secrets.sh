#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# oute.me — Secret Manager Setup
# Projeto: oute-488706
# Uso: ./infra/gcp/setup-secrets.sh
#
# Cria e versiona todos os segredos necessários no Cloud Secret Manager.
# Execute uma vez por ambiente após o setup.sh principal.
#
# Nota: FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY NÃO são necessários
# em Cloud Run — o Firebase Admin SDK usa Application Default Credentials (ADC)
# com o service account do container automaticamente.
# =============================================================================

PROJECT_ID="oute-488706"
SA_EMAIL="oute-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1" >&2; }
info()  { echo -e "${CYAN}[i]${NC} $1"; }

# Garante que o projeto está correto
preflight() {
  if ! command -v gcloud &>/dev/null; then
    err "gcloud CLI not found."
    exit 1
  fi
  gcloud config set project "$PROJECT_ID" --quiet
  log "Project: ${PROJECT_ID}"
}

# Cria o segredo se não existir
ensure_secret() {
  local name="$1"
  if gcloud secrets describe "$name" --project="$PROJECT_ID" &>/dev/null 2>&1; then
    warn "Secret '${name}' already exists — skipping creation."
  else
    gcloud secrets create "$name" \
      --replication-policy=automatic \
      --project="$PROJECT_ID"
    log "Secret '${name}' created."
  fi
}

# Adiciona uma versão ao segredo lendo do stdin
add_version() {
  local name="$1"
  local value="$2"
  echo -n "$value" | gcloud secrets versions add "$name" \
    --data-file=- \
    --project="$PROJECT_ID"
  log "Version added to '${name}'."
}

# Concede acesso ao Service Account
grant_access() {
  local name="$1"
  gcloud secrets add-iam-policy-binding "$name" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT_ID" \
    --quiet
  log "Access granted: ${SA_EMAIL} → ${name}"
}

# =============================================================================
# Segredos de produção
# =============================================================================
prod_secrets() {
  echo ""
  echo "━━━ Segredos de Produção ━━━"

  ensure_secret "ADMIN_EMAILS_PROD"
  grant_access  "ADMIN_EMAILS_PROD"

  warn "Informe os ADMIN_EMAILS de produção (separados por vírgula):"
  read -r ADMIN_EMAILS_PROD_VAL
  add_version "ADMIN_EMAILS_PROD" "$ADMIN_EMAILS_PROD_VAL"
}

# =============================================================================
# Segredos de desenvolvimento
# =============================================================================
dev_secrets() {
  echo ""
  echo "━━━ Segredos de Desenvolvimento ━━━"

  ensure_secret "ADMIN_EMAILS_DEV"
  grant_access  "ADMIN_EMAILS_DEV"

  warn "Informe os ADMIN_EMAILS de dev (separados por vírgula):"
  read -r ADMIN_EMAILS_DEV_VAL
  add_version "ADMIN_EMAILS_DEV" "$ADMIN_EMAILS_DEV_VAL"
}

# =============================================================================
# Listar todos os segredos configurados
# =============================================================================
list_secrets() {
  echo ""
  echo "━━━ Segredos configurados no projeto ━━━"
  gcloud secrets list --project="$PROJECT_ID" \
    --format="table(name,createTime,replication.automatic)"
}

# =============================================================================
# Main
# =============================================================================
main() {
  preflight

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo " oute.me — Secret Manager Setup"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  info "Este script cria os segredos listados abaixo."
  info "Segredos já existentes são mantidos (nova versão é adicionada)."
  echo ""
  echo "  Segredos que serão criados/atualizados:"
  echo "  • ADMIN_EMAILS_PROD   (produção)"
  echo "  • ADMIN_EMAILS_DEV    (desenvolvimento)"
  echo ""
  info "Firebase Auth usa ADC no Cloud Run — sem necessidade de chaves de SA."
  echo ""
  warn "Pressione Enter para continuar ou Ctrl+C para cancelar."
  read -r

  prod_secrets
  dev_secrets
  list_secrets

  echo ""
  log "Setup de segredos concluído!"
  echo ""
  info "Próximos passos:"
  echo "  1. Faça push da branch feature/gcp-platform-improvements"
  echo "  2. Os workflows de deploy já estão configurados para ler esses segredos"
  echo "  3. Para rotacionar um segredo: gcloud secrets versions add NOME --data-file=-"
}

main "$@"
