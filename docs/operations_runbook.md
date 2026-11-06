# Bibliotech operations runbook

This runbook covers the Phase 3 durability and observability jobs. Run the
commands from `backend/` unless stated otherwise. Never print `.env` values in
tickets or logs.

## Recovery targets

| Target | Value | Notes |
| --- | --- | --- |
| RPO | 24 hours | Daily database + uploads backup. Use provider PITR/binlogs if a lower RPO is required. |
| RTO | 2 hours | Restore the database, uploads, run migrations if needed, then verify readiness. |

The targets must be confirmed with a real restore drill. Record the measured
duration in the drill ticket.

## Serverless database connections

Production runs the API as Vercel serverless functions. Every active function
instance owns a separate `mysql2` pool, so database `max_connections` must be
sized for the maximum number of concurrent instances, not for one Node process.

- The app auto-detects `VERCEL`, `AWS_LAMBDA_FUNCTION_NAME`,
  or `SERVERLESS=true`.
- Serverless defaults: `DB_CONNECTION_LIMIT=1`, `DB_QUEUE_LIMIT=20`,
  `DB_IDLE_TIMEOUT_MS=10000`, `DB_MAX_IDLE=1`, `DB_POOL_WARMUP=0`.
- Keep those limits low. Raising `DB_CONNECTION_LIMIT` multiplies connections
  by the number of warm functions and can exhaust the provider limit; Aiven
  currently allows 46.
- When the pool queue is full or the server rejects a connection, the API
  returns HTTP 503 `DATABASE_UNAVAILABLE`/`errors.serviceBusy` instead of a
  generic 500. Retry with backoff and avoid long batch requests from many
  clients at once.
- `/metrics` exposes pool size, waiting requests, and database errors; alert on
  saturation. If connection pressure persists, add a provider-side pooler or
  move long-running batch work to a queue.

## Backup

`npm run ops:backup` writes a compressed database dump, a tar of
`backend/uploads/`, and `SHA256SUMS` under `backend/backups/<UTC timestamp>/`.

Required environment: `DB_HOST`, `DB_USER`, `DB_NAME`; optional `DB_PASS`,
`DB_PORT`, `DB_SSL`, `BACKUP_ROOT`, `MYSQLDUMP_EXTRA_ARGS`.

For MySQL 8 with GTIDs, avoid restoring the source GTID state:

```bash
set -a; . .env; set +a
MYSQLDUMP_EXTRA_ARGS='--set-gtid-purged=OFF' npm run ops:backup
```

Schedule daily at a low-traffic hour and copy the directory off-host. The
archive does not include `.env`; keep configuration in your secret manager and
restore it before starting the recovered instance. The backup includes local
uploads only; Cloudinary assets must be protected with the Cloudinary
account's retention/backup policy or re-uploaded from source.

## Restore drill

Create an isolated target database, never the live database:

```bash
RESTORE_DB=bibliotech_restore_drill
npm run ops:restore-drill -- /secure/backups/20261104T030000Z
```

The drill checks `SHA256SUMS`, restores the dump into `RESTORE_DB`, extracts
uploads into a temporary directory, and prints table counts plus elapsed
seconds. Verify the counts against the source backup ticket and delete the
drill database afterwards.

The database dump skips triggers because MySQL 8.4 rejects mysqldump trigger
delimiters during scripted restores. `restore.sh` recreates all application
triggers from `backend/config/restoreTriggers.sql` after the import. Keep that
file in sync when adding a trigger in a migration.

A live recovery requires an explicit acknowledgement and must not target
`DB_NAME` by accident:

```bash
TARGET_DB=bibliotech_restore RESTORE_UPLOAD_DIR=/srv/bibliotech/uploads \
  npm run ops:restore -- /secure/backups/20261104T030000Z --yes
```

After restore: start the app, check `/healthz`, `/readyz`, login, open an
approved PDF, and confirm the outbox worker drains `pending` events. Run
`npm run db:migrate` if the backup predates the current schema.

## Audit retention

Policy: live `audit_logs` for 365 days; older rows move to
`audit_logs_archive`. The archive table is not exposed by the API.

```bash
npm run db:archive-audit                  # dry run, prints candidates
npm run db:archive-audit -- --execute     # archive + delete in batches
node scripts/archiveAudit.js --verify     # overlap/duplicate check
```

The delete trigger is temporarily removed while the batch runs, protected by
a MySQL advisory lock. Run it in a maintenance window. Take a backup first.
For a non-default policy use `--days=<N> --batch=<N>` or set
`AUDIT_RETENTION_DAYS`.

## Notification and outbox retention

Policy: read notifications older than 90 days are deleted in batches; done
outbox events older than 30 days are deleted. Unread notifications and pending
or dead events are never removed by these jobs.

```bash
npm run db:prune-notifications             # dry run
npm run db:prune-notifications -- --execute
npm run db:prune-outbox                    # dry run
npm run db:prune-outbox -- --execute
```

Adjust with `--days=<N> --batch=<N>` or `NOTIFICATION_RETENTION_DAYS` /
`OUTBOX_RETENTION_DAYS`. Keep dead letters long enough to investigate and
replay them.

## Outbox operations

Useful queries:

```sql
SELECT status, COUNT(*) FROM outbox_events GROUP BY status;
SELECT id, event_type, attempts, available_at, last_error
  FROM outbox_events WHERE status = 'dead' ORDER BY id DESC LIMIT 50;
SELECT id, event_type, locked_by, locked_at
  FROM outbox_events WHERE status = 'processing' ORDER BY id LIMIT 50;
```

Retry a dead event after fixing the handler:

```sql
UPDATE outbox_events
   SET status = 'pending', attempts = 0, available_at = CURRENT_TIMESTAMP,
       locked_at = NULL, locked_by = NULL, last_error = NULL
 WHERE id = ? AND status = 'dead';
```

If the worker is stopped, events stay durable in `outbox_events`; start the
process and it will drain them. `OUTBOX_WORKER_ENABLED=false` disables polling
but keeps immediate post-commit processing of audit/notification events.

At-least-once semantics apply: a crash after an email handler succeeds but
before `markDone` can send the same email twice. Audit and notification
handlers are idempotent through `audit_logs.idempotency_key` and notification
uniqueness keys.

## Logs and monitoring

The app writes one JSON object per line with `timestamp`, `level`, `event`,
`requestId`, and redacted fields. Use `LOG_LEVEL` to control verbosity and
`LOG_RETENTION_DAYS` as the retention policy. For file-based logs use
`ops/logrotate/bibliotech`; under systemd/Docker use the platform's rotation
or log collector.

Scrape `/metrics` with `METRICS_TOKEN` when `METRICS_ENABLED=true` in
production. Load `ops/prometheus/bibliotech-alerts.yml` into Prometheus and
import `ops/grafana/bibliotech-dashboard.json` into Grafana. The dashboard
includes request rate, p95/p99 latency, DB pool/query latency, outbox status,
email delivery, security events, and upload rejections.

Alerts cover 5xx, latency, DB pool saturation/errors, auth failures,
permission denials, rate limiting, upload rejections, outbox backlog/retries/
dead letters, and mail errors. Treat `BibliotechOutboxDeadLetters` as a
durability incident: inspect `last_error`, fix the handler, then replay.
