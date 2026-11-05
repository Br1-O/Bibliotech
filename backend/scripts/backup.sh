#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-$BACKEND_DIR/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_ROOT/$STAMP"

: "${DB_HOST:?DB_HOST is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_NAME:?DB_NAME is required}"
DB_PORT="${DB_PORT:-3306}"

command -v mysqldump >/dev/null 2>&1 || { echo 'mysqldump is required' >&2; exit 1; }
command -v tar >/dev/null 2>&1 || { echo 'tar is required' >&2; exit 1; }

umask 077
mkdir -p "$DEST"

MYSQL_ARGS=(
  --host="$DB_HOST"
  --port="$DB_PORT"
  --user="$DB_USER"
  --single-transaction
  --quick
  --routines
  --skip-triggers
  --no-tablespaces
)
if [[ "${DB_SSL:-false}" == "true" ]]; then MYSQL_ARGS+=(--ssl-mode=REQUIRED); fi
if [[ -n "${MYSQLDUMP_EXTRA_ARGS:-}" ]]; then
  read -r -a EXTRA_ARGS <<< "${MYSQLDUMP_EXTRA_ARGS}"
  MYSQL_ARGS+=("${EXTRA_ARGS[@]}")
fi

MYSQL_PWD="${DB_PASS:-}" mysqldump "${MYSQL_ARGS[@]}" "$DB_NAME" | gzip -9 > "$DEST/database.sql.gz"

tar -czf "$DEST/uploads.tar.gz" -C "$BACKEND_DIR" uploads
(
  cd "$DEST"
  sha256sum database.sql.gz uploads.tar.gz > SHA256SUMS
)

printf '{"backupDir":"%s","database":"%s","uploads":true,"createdAt":"%s"}\n' "$DEST" "$DB_NAME" "$STAMP"
