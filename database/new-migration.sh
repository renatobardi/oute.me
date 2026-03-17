#!/usr/bin/env bash
# Cria um par de arquivos de migration (up + down) com numeração automática.
#
# Uso: ./database/new-migration.sh <nome_da_migration>
# Exemplo: ./database/new-migration.sh add_user_roles
#
# Resultado:
#   database/migrations/013_add_user_roles.sql
#   database/migrations/013_add_user_roles.down.sql

set -euo pipefail

NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  echo "Uso: $0 <nome_da_migration>"
  echo "Exemplo: $0 add_user_roles"
  exit 1
fi

MIGRATIONS_DIR="$(cd "$(dirname "$0")/migrations" && pwd)"

LAST=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null \
  | grep -v '\.down\.sql$' \
  | sort \
  | tail -1 || true)

if [[ -z "$LAST" ]]; then
  NEXT=1
else
  LAST_NUM=$(basename "$LAST" | grep -oE '^[0-9]+')
  NEXT=$((10#$LAST_NUM + 1))
fi

PADDED=$(printf "%03d" "$NEXT")
CREATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
UP="${MIGRATIONS_DIR}/${PADDED}_${NAME}.sql"
DOWN="${MIGRATIONS_DIR}/${PADDED}_${NAME}.down.sql"

cat > "$UP" <<EOF
-- Migration: ${PADDED}_${NAME}
-- Created:   ${CREATED_AT}

EOF

cat > "$DOWN" <<EOF
-- Rollback:  ${PADDED}_${NAME}
-- Created:   ${CREATED_AT}

EOF

echo "Criados:"
echo "  $UP"
echo "  $DOWN"
