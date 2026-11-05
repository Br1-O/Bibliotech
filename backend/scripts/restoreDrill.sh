#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-dir>" >&2
  echo "Required environment: RESTORE_DB, DB_HOST, DB_USER, DB_NAME. Optional: DB_PORT, DB_PASS, DB_SSL." >&2
  exit 2
fi

SOURCE_DIR="$1"
: "${RESTORE_DB:?RESTORE_DB is required}"
: "${DB_HOST:?DB_HOST is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_NAME:?DB_NAME is required}"
DB_PORT="${DB_PORT:-3306}"
RESTORE_UPLOAD_DIR="${RESTORE_UPLOAD_DIR:-$(mktemp -d)}"

STARTED_AT="$(date +%s)"
TARGET_DB="$RESTORE_DB" RESTORE_UPLOAD_DIR="$RESTORE_UPLOAD_DIR" "$SCRIPT_DIR/restore.sh" "$SOURCE_DIR" --yes

query_count() {
  local args=(--host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER")
  if [[ "${DB_SSL:-false}" == "true" ]]; then args+=(--ssl-mode=REQUIRED); fi
  MYSQL_PWD="${DB_PASS:-}" mysql "${args[@]}" -N -B "$RESTORE_DB" \
    -e "SELECT COUNT(*) FROM $1" 2>/dev/null || echo 0
}

for table in schema_migrations users materials outbox_events audit_logs notifications; do
  printf '%s=%s\n' "$table" "$(query_count "$table")"
done

UPLOAD_FILES="$(find "$RESTORE_UPLOAD_DIR" -type f ! -name '.gitkeep' | wc -l | tr -d ' ')"
ELAPSED="$(( $(date +%s) - STARTED_AT ))"
printf 'uploads=%s\nrestoreSeconds=%s\n' "$UPLOAD_FILES" "$ELAPSED"
