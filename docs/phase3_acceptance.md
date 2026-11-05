# Phase 3 acceptance - Durability and observability

Implementation date: 2026-11-04. Scope: roadmap work items P3-01 through
P3-07. Operational procedures and recovery targets are in
[`operations_runbook.md`](operations_runbook.md).

## P3-01 - Outbox and worker

- Migration `backend/config/migrations/008_phase3_durability.sql` adds
  `outbox_events`, `audit_logs.idempotency_key`, `audit_logs_archive`, and the
  notification retention index.
- `OutboxService` writes events inside the caller's transaction through
  `db.afterCommit()`; the worker polls with `FOR UPDATE SKIP LOCKED`, retries
  with exponential backoff, and moves exhausted events to `dead`.
- Consumers: audit (`audit.record`, `audit.record_many`), notifications
  (batch, subject subscribers, followers), and transactional email.
- Notification/audit events are processed immediately after commit to keep
  API-visible behavior. Email is drained by the worker.
- Dedupe keys make enqueue idempotent. Audit rows use
  `audit_logs.idempotency_key = outbox:<event id>[:<index>]`; notification
  creation keeps its existing unique keys.
- Defaults: 5 attempts, 5s base backoff, 5min max backoff, 5min stale lock
  release, 1s poll, batch 20. Configure with `OUTBOX_*` variables.

Acceptance: a committed transaction leaves an event in the outbox even if the
process dies before handling it. Retries/backoff and a dead-letter state are
implemented. Delivery is at-least-once, not exactly-once.

## P3-02 - Structured logging and correlation

- `backend/utils/logger.js` emits JSON lines with level, event, timestamp, and
  child fields.
- `requestContextMiddleware` creates or accepts `X-Request-Id`, exposes it in
  the response, and attaches `req.log` with the request ID.
- Sensitive keys (password/token/authorization/cookie/api key) are redacted;
  email fields are masked. Application `console.*` calls were replaced with
  the structured logger; the logger itself and startup config errors are the
  only intentional console writes.
- `LOG_LEVEL` controls verbosity; `LOG_RETENTION_DAYS` documents the policy.
  `ops/logrotate/bibliotech` covers file output.

Acceptance: request-scoped logs include `requestId`; redaction tests are
covered indirectly by the logger sanitizer and production log review.

## P3-03 - Metrics, dashboards, tracing

- `/metrics` exposes Prometheus text metrics protected by `METRICS_TOKEN` in
  production.
- HTTP: request count and duration histogram by method/route/status.
- DB: query duration histogram and query/error counters by operation; pool
  total/free/queued/limit gauges.
- Mail: sent/error counters by scope.
- Outbox: enqueued/processed/failed/retried/dead counters, processing
  duration, and queue-size gauge by status.
- Security: auth failures, permission denials, rate limits, server errors.
- Upload: rejection counter by reason.
- `ops/grafana/bibliotech-dashboard.json` includes p95/p99 latency, pool
  saturation, DB latency, outbox throughput/status, mail, and security panels.
- Tracing uses the request ID as the correlation key across HTTP logs, DB
  activity, and worker events; no external distributed tracer is required for
  the acceptance criterion.

## P3-04 - Audit retention and archival

- Policy: 365 days live, then batch move to `audit_logs_archive`.
- `npm run db:archive-audit` is a dry run; `-- --execute` performs the batch
  move. `node scripts/archiveAudit.js --verify` checks for archive/live
  overlap and duplicate archive IDs.
- The append-only delete trigger is suspended during the maintenance window
  and restored in a `finally` block; a MySQL advisory lock prevents concurrent
  jobs.
- The archive table is not exposed by the API and retains the original audit
  columns plus `archived_at`.

Dry-run evidence (2026-11-04): candidates `0`, archived `0`; verify reported
archive rows `0`, overlap `0`, duplicate IDs `0`.

## P3-05 - Backup and restore drills

- `npm run ops:backup` creates a database dump, uploads archive, and SHA-256
  checksums. `npm run ops:restore` restores into an explicit target database
  and refuses the live database unless explicitly overridden.
- `npm run ops:restore-drill -- <backup-dir>` restores into `RESTORE_DB`,
  validates checksums, extracts uploads to an isolated directory, and prints
  table counts and elapsed time.
- RPO target 24h, RTO target 2h; see the runbook. Cloudinary assets require a
  provider-side policy and are not in the local uploads archive.
- Backup smoke test (2026-11-04): database dump + uploads archive created and
  checksum file generated. GTID warning observed with MySQL 8; use
  `MYSQLDUMP_EXTRA_ARGS='--set-gtid-purged=OFF'` for portable dumps.
- Restore drill (2026-11-04, isolated `bibliotech_restore_drill`): checksums
  matched, all tables restored, uploads extracted, elapsed 60s. Verification
  showed the six application triggers (audit append-only plus search
  projection) present. MySQL 8.4 rejects mysqldump trigger delimiters during
  scripted restore, so the dump skips triggers and
  `backend/config/restoreTriggers.sql` recreates them.

## P3-06 - Notification retention

- Read notifications older than 90 days are deleted in batches; unread rows
  are preserved. `idx_notifications_read_created` supports the retention scan
  and the inbox query.
- `npm run db:prune-notifications` is a dry run;
  `-- --execute` deletes in batches.
- Dry-run evidence (2026-11-04): candidates `0`, deleted `0`.

## P3-07 - Security monitoring

- 401/403/429/5xx responses increment `security_events_total` with a bounded
  route label (`unmatched` for unknown paths).
- `auth_rate_limit_hits_total`, `upload_rejected_total`, and mail/outbox error
  counters provide additional incident signals.
- `ops/prometheus/bibliotech-alerts.yml` contains rules for 5xx, latency,
  DB pool/errors, auth failures, permission denials, rate limiting, upload
  anomalies, outbox backlog/dead letters/retries, and mail errors.
- Dead-letter, retry, and replay procedures are in the runbook.

## Validation

- `node --check` passed for all changed backend files.
- Migration `008_phase3_durability.sql` applied successfully; `outbox_events`,
  `audit_logs_archive`, the audit idempotency index, the notification
  retention index, and both audit triggers are present.
- Backend unit suite: `40/40` passing, including new outbox immediate,
  retry/backoff, dead-letter, missing-handler, and flush tests.
- Outbox database smoke test: duplicate dedupe key returned the same event ID,
  claim and `markDone` worked, and the test row was removed.
- Notification/audit/outbox retention scripts returned dry-run summaries.
- Integration suite: `75/75` passing with the Phase 3 outbox/retry
  integration (log: `/tmp/bibliotech-integration-suite.log`). Post-change
  targeted recovery/notification tests: `3/3`.
- Performance budget: `4/4` passing after the Phase 3 changes; baseline
  `SELECT 1` 151.6 ms and each hot-path overhead below the 150 ms budget.

## Residual risks

- Email delivery is at-least-once; duplicate sends are possible after a crash
  between send and `markDone`.
- Activation/recovery links are stored in the outbox payload until the event
  is processed and pruned. Restrict database access and consider payload
  encryption if that becomes a compliance requirement.
- The archival job briefly removes the append-only delete trigger. Use the
  advisory lock, a maintenance window, and a backup; do not run it alongside a
  live incident.
- Retention jobs need an external scheduler (cron/systemd timer).
- No external distributed tracing backend is configured; request IDs provide
  correlation.
- Cloudinary assets are outside the local backup archive.
