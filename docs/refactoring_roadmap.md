# Bibliotech — Refactoring and Scalability Roadmap

**Assessment date:** 2026-10-30  
**Goal:** move from a working prototype-grade implementation to a secure, correct, observable, and scalable production system without changing the product's core behavior.

---

## 1. How to Use This Roadmap

This roadmap is organized by **risk reduction**, not by layer. Each phase delivers a coherent safety or capability improvement and can be shipped independently.

- **Phase 0 — Stop the bleeding:** security and operational safety. Do this before any public production exposure.
- **Phase 1 — Correctness:** transactions, state invariants, authorization, idempotency. This is the highest-value engineering work.
- **Phase 2 — Performance:** pagination, indexes, query rewrites, caching. This makes growth predictable.
- **Phase 3 — Durability:** outbox/worker, audit guarantees, notifications/email reliability, observability.
- **Phase 4 — Structure:** service decomposition, domain model, API contract, frontend modules, test pyramid.
- **Continuous:** tests, docs, dependency updates, security review, performance budgets.

Do not start Phase 2 index work before Phase 1 state invariants are understood; otherwise you may optimize queries against inconsistent data. Do not start Phase 4 decomposition before Phase 1 transactions exist; otherwise you will distribute the same bugs across more services.

---

## 2. Phase 0 — Safety Net (1–2 weeks)

### 2.1 Objectives

- Prevent trivially exploitable security issues.
- Make the process safe to deploy and restart.
- Make configuration fail fast.
- Establish a baseline for observation and rollback.

### 2.2 Work items

| ID | Work | Findings | Acceptance criteria | Effort |
|---|---|---|---|---:|
| P0-01 | Require a strong `JWT_SECRET` at startup; remove fallback; rotate current secret. | SEC-01 | Process refuses to start if secret is missing/weak; one config source. | S |
| P0-02 | Add token version/revocation on ban, delete, password change, role change. | SEC-02, SEC-18 | Old token returns 401 immediately after the event; test for each event. | M |
| P0-03 | Add auth rate limits and lockout. | SEC-04 | Login/reset/verify/resend have per-IP and per-account budgets; 429 with `Retry-After`; metrics. | M |
| P0-04 | Restrict CORS and add security headers. | SEC-05, SEC-14 | Only configured origins; Helmet/CSP/HSTS/Referrer-Policy; no wildcard in production. | S |
| P0-05 | Remove dev-token exposure by default. | SEC-06 | Tokens returned only when an explicit test flag is set; production response never contains them. | S |
| P0-06 | Protect public profile/engagement data. | SEC-07, SEC-08, API-07 | Public DTO excludes email/birthdate/social links; reads/backlog/favorites require ownership or explicit visibility. | M |
| P0-07 | Add graceful shutdown, health, readiness. | OPS-01, OPS-02 | SIGTERM drains requests and closes pool; `/healthz` and `/readyz` reflect dependencies. | S |
| P0-08 | Validate environment at startup. | ARCH-06, OPS-09 | Missing/invalid vars produce a clear, non-secret error and exit non-zero. | S |
| P0-09 | Make `init.sql` non-destructive for existing environments. | SEC-15, OPS-05 | Bootstrap and reset are separate; migrations are ordered; seed accounts disabled/changed in production. | M |
| P0-10 | Add baseline logs/metrics. | ARCH-17, OPS-03, OPS-04 | Request ID, route, status, duration, user ID (when safe), DB/email failures; dashboard. | M |
| P0-11 | Harden upload intake and public file serving. | SEC-09, SEC-10, SEC-12 | Enforce request/file quotas, magic-byte validation, quarantine/scanning, authorized download route, `nosniff`, and `Content-Disposition`. | M |

### 2.3 Phase 0 exit criteria

- No known critical security finding remains exploitable.
- The app starts only with valid configuration.
- A deploy/restart does not drop in-flight requests.
- Health checks work.
- Auth abuse is rate-limited and observable.
- Upload intake is quota-bound, signature-validated, and not directly executable from a public path.

---

## 3. Phase 1 — Correctness and Integrity (3–5 weeks)

### 3.1 Objectives

- Make multi-step writes atomic.
- Define and enforce material state invariants.
- Fix authorization and gamification integrity.
- Make duplicate/concurrent behavior deterministic.

### 3.2 Work items

| ID | Work | Findings | Acceptance criteria | Effort |
|---|---|---|---|---:|
| P1-01 | Add transaction abstraction and wire it into repositories. | DATA-01, DATA-02, ARCH-05 | Upload/batch/moderation/subject/registration can roll back all DB writes; integration tests prove it. | L |
| P1-02 | Move file cleanup to a storage compensation flow. | DATA-03, SEC-11 | No file is deleted for a committed row; orphan reconciliation job exists; hashing is streamed. | M |
| P1-03 | Define material state model and enforce it. | DATA-04, DATA-05, DATA-06 | State matrix tests pass; approve/reject validates association; duplicate flows consistent. | M |
| P1-04 | Fix professor authorization. | SEC-03 | Professor can manage only own uploads or materials in subjects they teach; tests for allowed/denied. | M |
| P1-05 | Make read completion idempotent and add XP ledger. | DATA-08, DATA-09, DATA-15 | Read awards once per user/material; toggle does not farm; progress validated. | M |
| P1-06 | Persist heartbeat/session windows and validate input. | DATA-10 | Streak cannot be advanced by a single forged payload; multi-instance safe. | M |
| P1-07 | Make favorite toggle transactional and count authoritative. | DATA-13, DATA-15 | Concurrent toggles do not drift; count matches source. | S |
| P1-08 | Make pending limit and subscription/ban atomic. | DATA-12, DATA-20 | Concurrent requests cannot exceed limits; ban cannot be bypassed by subscribe race. | M |
| P1-09 | Fix subject assignment flows. | DATA-07, DATA-14, DATA-21, DATA-22 | Subject + professors atomic; reject removes only requester; no active subject without professor. | M |
| P1-10 | Fix notification uniqueness and duplicate semantics. | DATA-17, DATA-18 | Null combinations cannot duplicate; read state behavior documented and tested. | S |
| P1-11 | Make audit durable or explicitly eventual. | DATA-23, ARCH-04 | Critical actions always have an audit row, or an outbox with monitoring; append-only permissions. | M |
| P1-12 | Add API validation for moderation and batch metadata. | API-04, API-10, API-11 | Invalid IDs/metadata return 422/404 with per-item errors. | S |
| P1-13 | Add authorization/state tests. | OPS-10 | Policy matrix covered by unit tests; regressions blocked in CI. | M |

### 3.3 Phase 1 exit criteria

- No multi-step write can leave a partial DB state in the covered flows.
- Material visibility is explainable by one invariant.
- A professor cannot modify another professor's subject material or an unrelated student upload.
- XP cannot be farmed by toggling or forged progress.
- Concurrent duplicate uploads/favorites/subscriptions behave deterministically.
- Critical actions have audit coverage or a monitored outbox.

---

## 4. Phase 2 — Performance and Scalability (3–5 weeks)

### 4.1 Objectives

- Bound every list response.
- Make the catalog read path efficient.
- Add the right indexes, validated by plans.
- Introduce caching only where it is safe.

### 4.2 Work items

| ID | Work | Findings | Acceptance criteria | Effort |
|---|---|---|---|---:|
| P2-01 | Add pagination contract and server-side pagination. | PERF-01, API-01, ARCH-10 | Catalog/audit/users/notifications/lists accept `page`/`pageSize` or cursor; max enforced; frontend uses it. | M |
| P2-02 | Rewrite catalog projection. | PERF-02, PERF-03 | No correlated subqueries per row; batch association/flags; constant query count per page. | M |
| P2-03 | Add candidate indexes and validate. | PERF-10 | `EXPLAIN` shows index use; no full scans/filesort on hot paths; write throughput acceptable. | M |
| P2-04 | Rewrite search and tag filters. | PERF-07, PERF-08 | FULLTEXT or search read model; normalized tags; no `%LIKE%` on hot paths. | L |
| P2-05 | Batch and bulk the upload/notification paths. | PERF-05, PERF-06 | Batch 100 items bounded; category/hash lookups batched; bulk inserts; no N+1. | L |
| P2-06 | Fix profile stats. | PERF-04 | Stats query indexed and/or cached; profile p95 target met. | M |
| P2-07 | Paginate and optimize audit. | PERF-09 | Date/operation filters, cursor/page, no six-way join per row. | M |
| P2-08 | Add reference-data caching. | ARCH-12, PERF-15 | Careers/subjects/categories/ranks cached with invalidation; hit rate monitored. | M |
| P2-09 | Add query timeouts and pool tuning. | ARCH-13, DB ops | Finite pool queue, timeouts, max connections documented; no request hangs. | S |
| P2-10 | Add performance budget tests. | OPS-04, OPS-10 | CI or staging benchmark catches regressions in catalog/profile/audit. | M |

### 4.3 Phase 2 exit criteria

- No public list returns unbounded rows.
- Catalog query count is constant per page.
- Hot queries use indexes and avoid filesort/temporary tables.
- Search no longer relies on `%LIKE%` across six columns.
- The frontend no longer downloads the full catalog.
- p95 targets are measured and tracked.

---

## 5. Phase 3 — Durability and Observability (3–4 weeks)

### 5.1 Objectives

- Make side effects reliable.
- Make incidents diagnosable.
- Add retention and recovery discipline.

### 5.2 Work items

| ID | Work | Findings | Acceptance criteria | Effort |
|---|---|---|---|---:|
| P3-01 | Introduce outbox + worker for notifications/email/audit. | ARCH-04, DATA-23 | Events survive process crash; retries with backoff; dead-letter queue; idempotent consumers. | L |
| P3-02 | Add structured logging and request correlation. | ARCH-17, OPS-03 | Every log has request ID; no secrets; log levels; retention. | M |
| P3-03 | Add metrics/tracing. | OPS-04 | HTTP, DB, pool, email, upload, queue metrics; p95/p99 dashboards. | M |
| P3-04 | Add audit retention/archival. | DATA-23 | Policy documented; partition/archive job; restore test. | M |
| P3-05 | Add backup/restore drills. | OPS-08 | RPO/RTO defined; restore verified; uploads included. | M |
| P3-06 | Add notification retention. | PERF-13 | Read notifications archived/deleted in batches; inbox stays fast. | S |
| P3-07 | Add security monitoring. | SEC-04, OPS-04 | Auth failures, rate-limit hits, 5xx, permission denials, upload anomalies alerted. | M |

### 5.3 Phase 3 exit criteria

- A crash after commit does not lose notification/audit events.
- Incidents can be traced end-to-end with a request ID.
- Backups are tested, not just scheduled.
- Audit/notification growth is bounded by policy.

---

## 6. Phase 4 — Structural Cleanup (4–8 weeks)

### 6.1 Objectives

- Make the codebase easier to change safely.
- Enforce the hexagonal boundaries.
- Reduce service coupling.
- Improve frontend modularity and testability.

### 6.2 Work items

| ID | Work | Findings | Acceptance criteria | Effort |
|---|---|---|---|---:|
| P4-01 | Split `MaterialService` into upload/moderation/association/catalog/favorite/deletion services. | ARCH-03 | Each service has a focused dependency set and unit tests; facade preserves routes. | L |
| P4-02 | Introduce policies for visibility/management/state. | ARCH-01, SEC-03 | Policies are pure, tested, and used by all entry points. | M |
| P4-03 | Move read logic to query services/read models. | ARCH-02, ARCH-11 | Controllers no longer call repositories directly; read DTOs stable. | L |
| P4-04 | Enforce ports with DTOs/contract tests. | ARCH-07 | Repository contract tests run against MariaDB; adapters return documented shapes. | M |
| P4-05 | Add OpenAPI and contract tests. | ARCH-08 | OpenAPI covers all routes; CI validates request/response examples. | M |
| P4-06 | Standardize API envelopes/errors/naming. | ARCH-09, API-06 | One documented envelope; camelCase; stable error codes. | M |
| P4-07 | Adopt ES modules in frontend. | ARCH-15 | No implicit globals; explicit imports; build optional. | M |
| P4-08 | Add unit test pyramid and lint/format/CI. | ARCH-18, OPS-06, OPS-10 | Coverage thresholds; lint/format; CI blocks regressions. | M |
| P4-09 | Align README/docs with reality; add ADRs. | ARCH-19, ARCH-20 | ADRs for state/auth/transactions/search/storage/audit; docs reviewed. | S |
| P4-10 | Consider extracting search/media/notifications only if justified. | ARCH-04, DB scaling | Extraction is driven by measured bottlenecks, not fashion. | XL |

### 6.3 Phase 4 exit criteria

- A new developer can trace a request without guessing.
- Business rules live in one place per invariant.
- Repository contracts are tested.
- The API is described by a machine-readable contract.
- The frontend has explicit module boundaries.
- The test suite catches regressions before release.

---

## 7. Continuous Workstreams

### 7.1 Testing

- Unit tests for policies, state transitions, validators, mappers.
- Service tests with fake repositories.
- Repository integration tests against MariaDB (Testcontainers or CI service).
- API contract tests.
- End-to-end critical journeys.
- Load tests for catalog/upload/notification fan-out.

### 7.2 Security

- Dependency audit (`npm audit`, Dependabot/Renovate).
- Secret scanning.
- Authorization matrix review each release.
- Upload malware scanning.
- Periodic penetration test before public launch.

### 7.3 Documentation

- Update `routes.txt`, `database_diagram.txt`, and OpenAPI with every contract/schema change.
- Add ADRs for decisions.
- Keep runbooks for deploy, rollback, backup/restore, and incident response.
- Add a "known limitations" section to the README.

### 7.4 Operations

- SLOs for availability, latency, error rate.
- Capacity planning based on growth.
- Backup/restore drills.
- Migration rehearsal in staging.
- Post-incident reviews with action items.

---

## 8. Prioritized Backlog (Top 25)

| Rank | Item | Phase | Why now |
|---:|---|---|---|
| 1 | JWT secret + revocation | 0 | Account takeover risk. |
| 2 | Auth rate limiting | 0 | Brute force / credential stuffing. |
| 3 | CORS + security headers | 0 | Token theft impact reduction. |
| 4 | Public profile privacy | 0 | Data exposure. |
| 5 | Graceful shutdown/health | 0 | Safe deploys. |
| 6 | Env validation | 0 | Fail fast, no silent fallback. |
| 7 | Transaction abstraction | 1 | Root cause of partial writes. |
| 8 | Material state invariant | 1 | Core data correctness. |
| 9 | Professor authorization | 1 | Cross-subject content tampering. |
| 10 | XP/read idempotency | 1 | Gamification integrity. |
| 11 | Favorite/pending/ban races | 1 | Deterministic behavior. |
| 12 | Subject assignment atomicity | 1 | Academic data correctness. |
| 13 | Audit durability | 1/3 | Compliance and traceability. |
| 14 | Pagination contract | 2 | Scalability and payload control. |
| 15 | Catalog query rewrite | 2 | Main read path. |
| 16 | Index rollout | 2 | Immediate plan improvement. |
| 17 | Search/tag normalization | 2 | Search quality and scale. |
| 18 | Batch upload bulk path | 2 | Admin performance. |
| 19 | Profile/audit optimization | 2 | Admin/user experience. |
| 20 | Outbox/worker | 3 | Reliable side effects. |
| 21 | Structured logs/metrics | 3 | Operability. |
| 22 | Split MaterialService | 4 | Maintainability. |
| 23 | Query services/DTOs | 4 | Boundary enforcement. |
| 24 | OpenAPI/contract tests | 4 | Frontend/backend alignment. |
| 25 | Frontend ES modules | 4 | Maintainability and testability. |

---

## 9. Suggested 30/60/90 Plan

### First 30 days

- Complete Phase 0.
- Add transaction abstraction and migrate upload/moderation/registration.
- Define material state model and tests.
- Add the first batch of indexes and pagination for catalog.
- Establish CI with lint, unit tests, and a smoke migration.

### Days 31–60

- Complete Phase 1.
- Add cursor pagination and catalog read model.
- Rewrite search/tag filtering.
- Add profile/audit optimization.
- Add Redis for reference-data cache and rate limits.
- Add structured logs and request IDs.

### Days 61–90

- Complete Phase 2.
- Add outbox/worker for notifications/email/audit.
- Add metrics/tracing and SLO dashboards.
- Start Phase 4 service split and DTO/contract tests.
- Run a load test and a restore drill.

---

## 10. Migration Strategy

### 10.1 Strangler pattern

Do not rewrite the app. Introduce new code paths beside old ones:

1. Add a new repository method or query service.
2. Route a small percentage of reads to it (feature flag or internal toggle).
3. Compare results and latency.
4. Increase traffic.
5. Remove the old path.

### 10.2 Expand/contract for schema

1. **Expand:** add nullable columns/indexes; keep old code working.
2. **Backfill:** migrate data in batches with checkpoints.
3. **Switch:** write/read new shape.
4. **Contract:** remove old columns/indexes after verification.

### 10.3 Backward compatibility

- Keep existing route paths and response fields during transition.
- Add new pagination fields without removing old arrays.
- Version only if a breaking change is unavoidable.
- Document deprecations and removal dates.

### 10.4 Rollback

Every phase should have:

- a feature flag or configuration switch;
- a database migration rollback or forward-fix plan;
- a tested backup/restore path for destructive changes;
- a monitoring signal that tells you to roll back.

---

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Transaction refactor touches many repositories | Large diff, regression risk | Start with two use cases; add integration tests; use a transaction context with a default. |
| Indexes slow down writes | Upload latency increases | Validate write throughput; add only measured indexes; monitor. |
| Pagination changes break frontend | UI regressions | Add backward-compatible fields; update one page at a time. |
| Token revocation adds a DB lookup per request | Latency | Cache auth projection in Redis; short TTL; measure. |
| Outbox adds complexity | Delivery bugs | Use a proven library/pattern; idempotent consumers; dead-letter monitoring. |
| Search engine adds operations | New failure mode | Start with FULLTEXT; move only when measured. |
| Team capacity | Roadmap slips | Prioritize Phase 0/1; defer Phase 4. |

---

## 12. Definition of Done

A roadmap item is done only when:

- the behavior is covered by automated tests;
- authorization is enforced server-side and tested for allowed/denied roles;
- multi-step writes are transactional or explicitly documented as eventual;
- errors map to stable status codes and localized messages;
- logs include correlation IDs and exclude secrets;
- database changes have before/after `EXPLAIN` and a rollback plan;
- API docs/OpenAPI and existing docs are updated;
- metrics/alerts exist for the new behavior;
- a rollback path is documented.

---

## 13. Success Metrics

Track these before/after:

| Metric | Baseline | Target direction |
|---|---|---|
| Auth brute-force success rate | unknown | Near zero |
| p95 catalog latency | unknown | < 150 ms |
| p95 profile latency | unknown | < 200 ms |
| p95 audit latency | unknown | < 250 ms |
| Rows examined / returned (catalog) | unknown | < 100 |
| Full scans on hot queries | unknown | Zero |
| Partial-write incidents | unknown | Zero |
| Audit coverage of critical actions | unknown | 100% or monitored outbox |
| Orphan files | unknown | Zero via reconciliation |
| Test coverage (services/domain) | low | > 70% for critical modules |
| Error rate (5xx) | unknown | < 0.5% |
| Mean time to detect incidents | unknown | < 5 min |

Set real baselines during Phase 0; do not treat the targets as arbitrary promises.

---

## 14. Finding-to-Phase Traceability

All 119 finding IDs from `code_analysis.md` are mapped to at least one phase below. Phase 0 IDs are also revisited structurally in later phases where noted in the finding register.

- **Phase 0 (28):** SEC-01, SEC-02, SEC-04, SEC-05, SEC-06, SEC-07, SEC-08, SEC-09, SEC-10, SEC-12, SEC-13, SEC-14, SEC-15, SEC-16, SEC-17, SEC-18, SEC-19, SEC-20, ARCH-06, ARCH-14, API-07, FE-02, FE-06, OPS-01, OPS-02, OPS-05, OPS-07, OPS-09.
- **Phase 1 (39):** SEC-03, SEC-11, SEC-22, DATA-01 through DATA-26, ARCH-01, ARCH-05, ARCH-16, API-03, API-04, API-08, API-10, API-11, PERF-12, FE-07.
- **Phase 2 (23):** ARCH-10, ARCH-12, ARCH-13, API-01, API-02, API-12, PERF-01 through PERF-11, PERF-14 through PERF-17, FE-01, FE-04.
- **Phase 3 (7):** SEC-21, ARCH-04, ARCH-17, PERF-13, OPS-03, OPS-04, OPS-08.
- **Phase 4 (20):** ARCH-02, ARCH-03, ARCH-07, ARCH-08, ARCH-09, ARCH-11, ARCH-15, ARCH-18, ARCH-19, ARCH-20, API-05, API-06, API-09, FE-03, FE-05, FE-08, FE-09, FE-10, OPS-06, OPS-10.
- **Continuous (2):** OPS-11, OPS-12.

The ranges above are inclusive and intentionally compact: `DATA-01 through DATA-26` means every DATA finding is Phase 1, and `PERF-01 through PERF-11` means every PERF finding in that range is Phase 2.

---

## 15. Final Recommendation

The correct strategy is **not** a rewrite. It is a disciplined sequence:

1. **Secure and stabilize** the process and auth.
2. **Make writes atomic and state explicit.**
3. **Bound and index the read paths.**
4. **Make side effects durable and observable.**
5. **Then** improve structure and modularity.

This preserves the working product, reduces risk early, and gives the team measurable wins before the larger architectural refactors.
