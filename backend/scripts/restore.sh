#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || "$2" != "--yes" ]]; then
  echo "Usage: $0 <backup-dir> --yes" >&2
  echo "Required environment: TARGET_DB, RESTORE_UPLOAD_DIR. Optional: DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_SSL." >&2
  exit 2
fi

SOURCE_DIR="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
: "${TARGET_DB:?TARGET_DB is required}"
: "${RESTORE_UPLOAD_DIR:?RESTORE_UPLOAD_DIR is required}"
: "${DB_HOST:?DB_HOST is required}"
: "${DB_USER:?DB_USER is required}"
DB_PORT="${DB_PORT:-3306}"
: "${DB_NAME:?DB_NAME is required}"

if [[ "$TARGET_DB" == "$DB_NAME" && "${ALLOW_SAME_DB:-false}" != "true" ]]; then
  echo "Refusing to restore into the live DB_NAME. Set ALLOW_SAME_DB=true only for a deliberate recovery." >&2
  exit 3
fi

[[ -f "$SOURCE_DIR/database.sql.gz" ]] || { echo "Missing $SOURCE_DIR/database.sql.gz" >&2; exit 4; }
[[ -f "$SOURCE_DIR/uploads.tar.gz" ]] || { echo "Missing $SOURCE_DIR/uploads.tar.gz" >&2; exit 4; }
[[ -f "$SOURCE_DIR/SHA256SUMS" ]] || { echo "Missing $SOURCE_DIR/SHA256SUMS" >&2; exit 4; }

(
  cd "$SOURCE_DIR"
  sha256sum -c SHA256SUMS
)

mkdir -p "$RESTORE_UPLOAD_DIR"

MYSQL_ARGS=(
  --host="$DB_HOST"
  --port="$DB_PORT"
  --user="$DB_USER"
)
if [[ "${DB_SSL:-false}" == "true" ]]; then MYSQL_ARGS+=(--ssl-mode=REQUIRED); fi

MYSQL_PWD="${DB_PASS:-}" mysql "${MYSQL_ARGS[@]}" "$TARGET_DB" < <(gzip -dc "$SOURCE_DIR/database.sql.gz")

MYSQL_PWD="${DB_PASS:-}" mysql "${MYSQL_ARGS[@]}" "$TARGET_DB" < "$BACKEND_DIR/config/restoreTriggers.sql"

tar -xzf "$SOURCE_DIR/uploads.tar.gz" -C "$RESTORE_UPLOAD_DIR" --strip-components=1
printf '{"restoredDatabase":"%s","restoredUploads":"%s"}\n' "$TARGET_DB" "$RESTORE_UPLOAD_DIR"
