#!/usr/bin/env bash
# Apaga entrevistas, projetos e documentos GCS de um usuário no banco DEV.
# Uso: ./scripts/clear-user-dev.sh <email>
#
# Requer: gcloud autenticado (gcloud auth application-default login)

set -euo pipefail

EMAIL="${1:-}"
if [[ -z "$EMAIL" ]]; then
  echo "Uso: $0 <email>"
  exit 1
fi

PROXY_BIN="$(gcloud info --format='value(installation.sdk_root)')/bin/cloud-sql-proxy"
INSTANCE="oute-488706:us-central1:oute-postgres"
PROXY_PORT=15432
DB_URL="postgresql://postgres:wazjin-corfi0-cYdbav-hkutX@localhost:${PROXY_PORT}/oute_develop"
GCS_BUCKET="oute-dev-uploads"

echo "▶ Subindo Cloud SQL Auth Proxy..."
"$PROXY_BIN" "$INSTANCE" "--port=${PROXY_PORT}" &
PROXY_PID=$!
trap 'echo "▶ Encerrando proxy..."; kill "$PROXY_PID" 2>/dev/null; wait "$PROXY_PID" 2>/dev/null' EXIT
sleep 2

echo "▶ Limpando dados de [DEV] para: $EMAIL"
DATABASE_URL="$DB_URL" GCS_BUCKET="$GCS_BUCKET" \
  node "$(dirname "$0")/../apps/web/scripts/clear-user-data.mjs" "$EMAIL"
