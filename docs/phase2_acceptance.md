# Phase 2 Acceptance — Performance and Scalability

**Date:** 2026-11-01
**Scope:** `P2-01` to `P2-10` of `docs/refactoring_roadmap.md`
**Result:** implemented for material, profile, notification, user and audit read paths; backend `35/35`, integration `75/75`, performance budget passed. Post-acceptance latency and rank-toast fixes are documented below.

---

## Verification commands

```bash
cd backend
npm run db:migrate
npm run test:backend
npm run test:perf
```

```bash
# API integration server
cd backend
NODE_ENV=development EXPOSE_DEV_TOKENS=true FILES_MODE=local \
AUTH_IP_RATE_LIMIT=10000 AUTH_ACCOUNT_RATE_LIMIT=10000 \
AUTH_RECOVERY_RATE_LIMIT=10000 UPLOAD_RATE_LIMIT=10000 \
nohup npm start > /tmp/bibliotech-server.log 2>&1 &

# suite
node frontend/js/tests/runNode.mjs
```

Observed results:

- `npm run test:backend`: **35/35**.
- `node frontend/js/tests/runNode.mjs`: **75/75**.
- `npm run test:perf`: all four probes passed. The verification database is remote (Aiven), so the `SELECT 1` baseline is about `159 ms`; query overhead was `0.5` to `1.8 ms` against the default `150 ms` budget.
- `EXPLAIN` for the paginated global catalog uses `idx_materials_estado_created` (`Using index`, backward index scan, no filesort).
- `EXPLAIN` for subject materials uses `idx_ms_subject_state_material` (backward index scan, no filesort).

---

## P2-01 — Pagination contract

Implemented `backend/utils/pagination.js` with:

- `page`, `pageSize`, `page_size` and legacy `limit` alias.
- Default page size `20`, maximum `100`.
- `{page, pageSize, total, totalPages, hasNext, hasPrev}` metadata.
- Unit coverage in `backend/tests/pagination.test.js`.

Applied server-side pagination to:

- global catalog, author profile materials, own uploads, pending suggestions, professor pending review;
- subject materials;
- favorites;
- profile reads and backlog;
- audit logs and audit by user;
- users (default page size `100` for the current admin UI);
- notifications.

Existing array envelopes were preserved (`materials`, `favorites`, `logs`, `users`) and pagination metadata was added alongside them. `limit=1` remains compatible.

Frontend consumers updated to request pages and render server metadata:

- `catalogFrontController.js`, `authorFrontController.js`, `favoritesFrontController.js`;
- `subjectFrontController.js`, `profileFrontController.js`, `myContentFrontController.js`;
- admin audit table.

---

## P2-02 — Catalog projection

- Removed the three correlated `materias`/`materiasIds`/`materiasTodosIds` subqueries from `SELECT_MATERIAL`.
- Association data is loaded once per page by `attachCareers` and `attachAllAssociations`.
- Favorite status is now resolved only for the material IDs on the current page.
- List queries now return `{items,total}` and use one count query plus one page query.
- `findById` loads full detail associations; `findByIds` remains batched for reads/backlog.

---

## P2-03 — Indexes and plans

Migration `backend/config/migrations/007_phase2_performance.sql` adds:

- catalog indexes by state/date, author, uploader, category and type;
- subject association indexes for subject/state/material and material/state/subject;
- subject/career/favorite/notification/backlog/user indexes;
- audit timestamp, user, operation and target indexes.

The migration was applied to the local database as `007_phase2_performance.sql`. `EXPLAIN` checks were used for the global catalog and subject material paths.

---

## P2-04 — Search and tags

- Added fulltext projection tables `material_search` and `user_search`, populated by triggers for new/updated rows and backfilled during migration.
- Catalog `q` now uses `MATCH ... AGAINST` in boolean mode, with a short-token fallback limited to title/author.
- Added normalized `material_tags` table. Application writes keep it synchronized on material insert, update and batch insert; migration backfills existing comma-separated categories.
- Tag filters now use indexed `EXISTS` predicates and retain the previous AND semantics. The existing filter integration test passes.
- Upload-year filtering uses a range on `created_at` instead of `YEAR(created_at)`.
- Filter years are derived from `MIN`/`MAX` dates instead of a distinct `YEAR()` scan.

---

## P2-05 — Batch paths

- `uploadBatch` now validates and hashes all items, resolves categories once, detects duplicates with one batched `FOR UPDATE` lookup, and inserts new materials with one multi-row insert.
- Tags are synchronized with one delete plus one multi-row insert.
- Audit rows for the batch are inserted in one multi-row statement.
- Subject-ownership checks use one batched subject lookup instead of one query per subject.
- `BATCH_LIMIT = 100` remains enforced.

---

## P2-06 — Profile stats

- Added supporting indexes for subscriptions, reads, favorites, uploads, backlog and followers.
- Kept the existing single-round-trip stats query; aggregate subqueries are now index-backed. A materialized counter table is a possible future optimization, not required for the current dataset.

---

## P2-07 — Audit

- Audit listing now paginates and counts separately.
- Removed the six-way join from the list query.
- Target names are loaded in batches after the page is fetched, grouped by `registroTipo`.
- New rows persist `registro_tipo`; old rows derive it from `tipo_operacion`.
- No backfill of old rows is performed because `audit_logs` is append-only by trigger. Old rows remain readable through derivation.

---

## P2-08 — Reference caching

- Added `backend/utils/ttlCache.js`.
- Cached material filter options, careers and subject lists with a 60-second TTL.
- Subject/career mutations clear their related cache.
- Caches are process-local; multi-instance deployments will need a shared cache if strong cross-instance freshness is required.

---

## P2-09 — Pool and timeout tuning

- Added `DB_QUEUE_LIMIT` (default `50`), `DB_CONNECT_TIMEOUT_MS` (default `10000`) and `DB_QUERY_TIMEOUT_MS` (default `15000`).
- Pool now configures `queueLimit`, `connectTimeout`, keep-alive and per-query timeout.
- Defaults keep local development behavior compatible; production values remain environment-driven.

---

## P2-10 — Performance budget

- Added `backend/scripts/perfBudget.js` and `npm run test:perf`.
- Probes cover paginated catalog, subject materials, notifications and profile stats.
- The script measures a `SELECT 1` baseline and compares query overhead against `PERF_BUDGET_MS` (default `150`) so remote database latency does not hide regressions.
- Current run: all probes passed with `0.5` to `1.8 ms` of query overhead. The subject probe now uses the production join/order (`msx.material_id DESC`) and the script follows `DB_PREPARED_STATEMENTS`.

---

## Post-acceptance fixes (2026-11-02)

- Rank toast: `GamificationService.toggleRead` now returns `rankTitle` only when `rankLevel` increases. Re-marking an already-read material keeps `rankTitle: null`, so the frontend toast does not repeat. Integration coverage asserts both cases.
- Remote database latency: development uses remote Aiven MySQL with ~159 ms `SELECT 1` RTT. The default query path now uses `mysql2.query` with escaped placeholders instead of `execute`; prepared statements remain opt-in through `DB_PREPARED_STATEMENTS=true`. This removes repeated first-use `PREPARE` round trips.
- Pool warmup: `DB_POOL_WARMUP` opens idle connections at startup and `DB_IDLE_TIMEOUT_MS` keeps them alive, avoiding a cold connection on the first request.
- Read path: `getReadState` combines read/backlog checks, backlog removal is skipped when not needed, follower notifications are skipped when the user has no followers, and badge/rank context is resolved from the locked user summary. Warm reads dropped from roughly 2–4 s to roughly 1–2 s in integration logs; the remaining cost is the remote round-trip floor.
- Uploads: subject resolution is batched once per upload instead of loading each subject with counts/professors inside the transaction loop.
- Mail: `EmailDispatcher` caches pooled Gmail transporters and closes them on shutdown. Registration still pays SMTP latency; an outbox/worker remains the durable long-term fix.
- Final verification after these changes: backend `35/35`, integration `75/75`, performance budget passed.
- File viewer: approved materials are public for reading and download; pending/non-approved files still require the owner or staff. The backend sets an HttpOnly `bt_file_access` cookie scoped to `/api` at login and on authenticated API requests so new tabs and the PDF iframe can keep the owner session without JavaScript URLs; `/auth/logout` clears it.
- Cloudinary proxy: `/file` and `/download` forward `Range`/`If-Range`, return `206` with `Content-Range`/`Accept-Ranges`, support `HEAD`, and force identity encoding so the browser PDF viewer can seek without re-downloading the whole file. Integration covers cookie-only access, range responses and logout cleanup.

---

## Residual items

- Admin users still use client-side filtering over the first page (default `100`); professor selectors rely on that list. A server-driven admin table and a dedicated bounded professor list would complete this path.
- Career, subject and thematic-tag admin lists remain mostly client-paginated.
- The notification navbar consumes the first page; infinite scroll/history pagination is not implemented.
- `material_tags` is maintained by application writes, not triggers. Direct SQL edits to `materials.categories` must call the synchronization path.
- Fulltext short-token queries fall back to bounded `LIKE` on title/author.
- Profile statistics still use six indexed scalar subqueries rather than materialized counters.
- Performance budget is a manual/staging script; it is not wired into CI.
- Cache hit-rate metrics are not exposed yet.
- Audit rows written before migration 007 have `registro_tipo = NULL` by design.

---

## Files of record

- `backend/utils/pagination.js`
- `backend/utils/ttlCache.js`
- `backend/middleware/authMiddleware.js`
- `backend/config/env.js`
- `backend/config/db.js`
- `backend/config/migrations/007_phase2_performance.sql`
- `backend/infrastructure/repositories/MariaDBMaterialRepository.js`
- `backend/infrastructure/repositories/MariaDBAuditLogRepository.js`
- `backend/infrastructure/repositories/MariaDBGamificationRepository.js`
- `backend/infrastructure/repositories/MariaDBSubjectRepository.js`
- `backend/infrastructure/repositories/MariaDBUserRepository.js`
- `backend/infrastructure/repositories/MariaDBNotificationRepository.js`
- `backend/infrastructure/mail/EmailDispatcher.js`
- `backend/application/services/MaterialService.js`
- `backend/application/services/AuditLogService.js`
- `backend/application/services/GamificationService.js`
- `backend/application/services/SubjectService.js`
- `backend/application/services/CareerService.js`
- `backend/controllers/materialController.js`
- `backend/controllers/subjectController.js`
- `backend/controllers/engagementController.js`
- `backend/controllers/auditController.js`
- `backend/controllers/authController.js`
- `backend/controllers/notificationController.js`
- `backend/scripts/perfBudget.js`
- `backend/tests/pagination.test.js`
- `backend/tests/materialFile.test.js`
- `frontend/js/tests/gamificationTests.js`
- `frontend/js/tests/securityTests.js`
- `frontend/js/utils/authHelper.mjs`
