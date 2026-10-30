# Bibliotech — Code and Architecture Analysis

**Assessment date:** 2026-10-30  
**Scope:** backend and frontend source, current schema, configuration, and existing documentation  
**Change policy:** no application code was modified.

---

## 1. Executive Summary

Bibliotech is a functional modular monolith with a recognizable hexagonal structure, a complete route surface, a rich domain vocabulary, and a working frontend without a framework. It is also carrying a significant amount of **latent correctness, security, and scalability debt**.

The most serious pattern is not any single bug. It is the combination of:

1. **multi-step writes without transactions**;
2. **duplicated state without a single source of truth**;
3. **authorization checks that are too broad or missing**;
4. **client-trusting gamification and progress**;
5. **unbounded queries and client-side pagination**;
6. **best-effort side effects for audit, notifications, and email**.

These interact. For example, a failed notification does not fail the upload, but the upload itself may be half-written; a professor can edit a student's material, and the audit record may be missing; a user can farm XP because the read state and XP are updated by separate statements.

### 1.1 Severity distribution

| Severity | Count | Meaning |
|---|---:|---|
| Critical | 6 | Exploitable security issue or data-loss/integrity risk that should be fixed before production use. |
| High | 36 | Serious correctness, authorization, privacy, or scalability issue likely to cause incidents. |
| Medium | 59 | Significant maintainability, performance, or consistency issue that will compound over time. |
| Low | 18 | Hygiene, clarity, documentation, or minor robustness issue. |
| **Total** | **119** | Findings across security, data, architecture, API, performance, frontend, and operations. |

By area: **SEC 22, DATA 26, ARCH 20, API 12, PERF 17, FE 10, OPS 12**.

### 1.2 Fix-first set

| Order | ID | Finding |
|---:|---|---|
| 1 | SEC-01 | JWT secret has a known fallback and is duplicated. |
| 2 | SEC-02 | JWTs are not revoked on ban, delete, password change, or role change. |
| 3 | SEC-03 | Any professor can edit any student-uploaded material. |
| 4 | DATA-01 | Material upload/batch/moderation writes are not transactional. |
| 5 | DATA-04 | Global material state and per-subject approval state can contradict each other. |
| 6 | DATA-08 | Read toggling farms XP and does not reverse it. |
| 7 | DATA-09 | Reading progress and streak heartbeat trust client input. |
| 8 | SEC-04 | No rate limiting or lockout on login, reset, verification, or resend. |
| 9 | SEC-05 | Open CORS plus JWT in `localStorage` plus no CSP. |
| 10 | SEC-07 | Public endpoints expose email, birthdate, social links, favorites, reads, and backlog. |
| 11 | PERF-01 | No server-side pagination on catalog, audit, users, or most lists. |
| 12 | PERF-04 | Catalog query uses correlated subqueries and extra queries per request. |

---

## 2. Method and Severity Scale

### 2.1 Method

- Static inspection of routes, controllers, services, repositories, entities, middleware, SQL, and frontend controllers.
- Cross-check against the existing route/class/database/sequence documentation.
- Trace of the main write paths: registration, login, upload, batch upload, moderation, association, subscription, ban, favorite, read, progress, heartbeat, audit.
- Review of schema indexes, uniqueness constraints, nullability, and delete behavior.
- Review of error handling, configuration, startup/shutdown, and test assets.

No production database, execution plan, or traffic profile was available. Database recommendations are therefore **candidates** and must be validated with `EXPLAIN` and representative data.

### 2.2 Severity scale

| Severity | Criteria |
|---|---|
| Critical | Directly exploitable, causes data loss/corruption, or breaks a core security boundary. |
| High | Likely to cause incidents, authorization bypass, privacy exposure, or severe performance degradation. |
| Medium | Causes incorrect behavior in edge cases, makes changes risky, or creates avoidable operational cost. |
| Low | Code hygiene, naming, documentation, or minor resilience issue. |

### 2.3 Effort scale

| Effort | Approximate size |
|---|---|
| S | Hours |
| M | 1–3 days |
| L | 1–2 weeks |
| XL | Multi-sprint |

---

## 3. Security Findings

### 3.1 Security register

| ID | Severity | Finding | Evidence | Recommendation | Effort |
|---|---|---|---|---|---|
| SEC-01 | Critical | JWT secret falls back to a known literal and is defined twice. | `AuthService.js:23`, `authMiddleware.js:8` | Require `JWT_SECRET` at startup; fail closed; centralize in a validated config module; rotate the current secret. | S |
| SEC-02 | Critical | JWT verification does not reload the user or check `estado`; tokens survive ban, soft delete, password change, and role change. | `authMiddleware.js:14-29`, `AuthService.js:201-205`, `AuthService.js:345-367` | Add `token_version`/`session_version` to users; include it in JWT; verify on each request; increment on ban, delete, password change, and role change. | M |
| SEC-03 | High | Any professor can edit any material uploaded by any student, regardless of subject ownership. | `MaterialService.js:65-76` | Replace with a policy: professor may manage materials associated with subjects they teach, or uploaded by them; admin may manage all. | M |
| SEC-04 | High | No rate limiting, lockout, or captcha on login, registration, password reset, verification, or resend. | `authRoutes.js`; only upload routes use `uploadRateLimit`. | Add per-IP + per-account rate limits, progressive delays, lockout, and alerting; use Redis for multi-instance deployments. | M |
| SEC-05 | High | `cors()` allows every origin; JWT is stored in `localStorage`; no CSP or security headers. | `server.js:27`, `authHelper.js:9-12` | Restrict origins; add Helmet/CSP/HSTS/Referrer-Policy; prefer HttpOnly Secure SameSite cookies or short-lived tokens with refresh rotation. | M |
| SEC-06 | High | Raw verification/reset tokens are returned in API responses outside production. | `AuthService.js:28`, `160`, `237`, `290` | Gate behind an explicit test-only flag and never enable by default; never return tokens in production logs/responses. | S |
| SEC-07 | High | Public engagement endpoints expose profiles, favorites, reads, and backlog of any user; profile includes email, birthdate, city, social links. | `engagementRoutes.js:13-17`, `engagementController.js:33-62`, `GamificationService.js:54-99`, `User.js:116-119` | Define public/private projections; require ownership or explicit visibility; remove email/birthdate from public responses. | M |
| SEC-08 | Medium | Material author endpoint returns the author's email publicly. | `materialController.js` author action; `AuthService.getUserById` returns safe user including email. | Return a public author DTO (name, avatar, bio only). | S |
| SEC-09 | High | Upload validation trusts MIME and extension; no magic-byte validation, malware scan, or content disarm. | `multerConfig.js:91-101`, `mediaValidator.js` | Validate file signatures; quarantine/scan uploads; reject `application/octet-stream` unless verified; store outside web root or serve through an authorized handler. | M |
| SEC-10 | High | Multer accepts up to 220 files × 100 MB before the service-level 100-item batch limit; disk exhaustion is possible. | `multerConfig.js:19`, `106`; `MaterialService.js:22`, `546` | Enforce total request size, file count, and per-user quota at the edge; stream to object storage; delete partial uploads on abort. | M |
| SEC-11 | High | Local uploads are hashed synchronously with `readFileSync`, blocking the event loop and allocating the full file in memory. | `hashHelper.js`; `materialController.js:27-31` | Stream hashing (`crypto.createHash` + pipeline); move hashing to a worker or pre-signed upload flow. | M |
| SEC-12 | Medium | `/uploads` is public and served without `Content-Disposition`, `X-Content-Type-Options`, or authorization. | `server.js:33-36` | Serve through a controller that checks material visibility; set `Content-Disposition: attachment` for downloads; add `nosniff`. | M |
| SEC-13 | Medium | Account activation is a state-changing GET route. | `viewRoutes.js:24-33`, `authRoutes.js` activation endpoints | Use POST for activation or require a confirmation page; keep `no-store` and `Referrer-Policy`; consider one-time links with short TTL. | S |
| SEC-14 | Medium | No Helmet/security headers, no explicit body-size limit, no request timeout. | `server.js:26-30` | Add Helmet, `express.json({ limit: ... })`, request timeouts, and proxy timeouts. | S |
| SEC-15 | Critical | `init.sql` drops/recreates the database and creates a known DB user with broad grants; seed accounts have known passwords. | `init.sql:1-22`, seed section | Split bootstrap from destructive reset; use migrations; create least-privilege DB users; force seed password change or disable seed accounts in production. | M |
| SEC-16 | High | JWT has no issuer, audience, algorithm restriction, or clock tolerance policy. | `AuthService.js:201-205`, `authMiddleware.js:17` | Sign/verify with explicit `algorithms: ['HS256']`, `issuer`, `audience`; use asymmetric keys if multiple services appear. | S |
| SEC-17 | Medium | Password policy is only 8 characters with one letter and one digit; no breached-password check or MFA for admins. | `Password.js:12-15` | Raise minimum length, check breached passwords, add MFA for `Superadmin`, and add re-authentication for sensitive actions. | M |
| SEC-18 | Medium | Password reset/change does not invalidate existing sessions. | `AuthService.js:301-343`, `userRepository.updatePassword` | Increment `token_version` and clear active refresh tokens; notify the user by email. | M |
| SEC-19 | Medium | Ban/unban/soft-delete can target privileged accounts; no last-admin or self-ban guard. | `AuthService.js:345-367` | Add role/self/last-admin invariants and require a reason for bans. | S |
| SEC-20 | Medium | `uploadRateLimit` is in-memory, keyed by user/IP, never swept, and disabled entirely in testing. | `uploadRateLimitMiddleware.js:7-31` | Use a shared Redis store with TTL, per-route budgets, and metrics; do not disable in a way that can leak to production. | M |
| SEC-21 | Low | Error logging can include sensitive provider/DB messages; no structured redaction. | `errorMiddleware.js`, `AuditLogService.js:21-23` | Add structured logging with redaction and correlation IDs; keep client messages generic. | S |
| SEC-22 | Low | Email normalization is inconsistent: registration/login lowercase, professor creation does not. | `AuthService.js:130`, `190`, `165-180` | Normalize email in one domain helper/DB generated column; enforce case-insensitive uniqueness. | S |

### 3.2 Detailed remediation: authorization policy

Current logic in `MaterialService.assertCanManage`:

```js
if (ctx.rol === 'Superadmin') return;
if (ctx.rol !== 'Profesor') throw forbidden;
const uploaderId = Number(material.uploadedBy || material.autorId);
const uploaderRol = material.uploaderRol || material.autorRol;
if (uploaderId === Number(ctx.usuarioId)) return;
if (uploaderRol === 'Alumno') return;
throw forbidden;
```

The last condition grants every professor access to every student upload. Replace it with an explicit policy object:

```text
canManageMaterial(actor, material, subjects):
  if actor.role == Superadmin: true
  if actor.role != Profesor: false
  if material.uploadedBy == actor.id: true
  if material.autorId == actor.id: true
  if any(subject in material.subjects where actor teaches subject): true
  false
```

The policy must be evaluated with the **material's current associations**, not with a global role. It should be unit-tested for:

- professor owns the subject;
- professor teaches another subject;
- professor is not assigned to any subject;
- student uploads to a subject the professor teaches;
- material has no subjects;
- admin override;
- banned/inactive actor.

### 3.3 Detailed remediation: token lifecycle

Add to `users`:

```sql
ALTER TABLE users
  ADD COLUMN token_version INT NOT NULL DEFAULT 0,
  ADD COLUMN password_changed_at DATETIME NULL;
```

JWT payload:

```json
{ "sub": 42, "role": "Profesor", "tv": 3, "iat": 1700000000, "exp": 1700007200 }
```

Verification:

1. Verify signature with explicit algorithm/issuer/audience.
2. Load a minimal auth projection (`id`, `role`, `estado`, `token_version`) from a cache or DB.
3. Reject if user is missing, not `Activo`, or `tv` does not match.
4. Attach `req.usuarioId`, `req.rol`, and the loaded auth record.

Increment `token_version` on:

- ban/unban (ban only, but bump on both for clarity);
- soft delete;
- password reset;
- password change;
- role change;
- explicit "log out all devices".

This closes the gap without requiring a full session table. For stronger requirements, add a `sessions` table with refresh-token rotation and revocation.

---

## 4. Data Integrity and Concurrency Findings

### 4.1 Data register

| ID | Severity | Finding | Evidence | Recommendation | Effort |
|---|---|---|---|---|---|
| DATA-01 | Critical | Material upload creates material, associations, mandatory flags, tags, notifications, and audit as independent autocommit statements. | `MaterialService.js:220-260`, repositories | Introduce a transaction boundary around the use case; pass a transaction context to repositories; roll back DB writes on failure; clean files after rollback. | L |
| DATA-02 | Critical | Batch upload is a loop of independent saves; a later failure leaves earlier rows committed while the controller deletes all files. | `MaterialService.js:543-594`, `materialController.js:141-239` | One transaction for all DB rows, or per-item transactions with explicit partial-success reporting; never delete files for committed rows. | L |
| DATA-03 | High | File cleanup lives in the controller, not in the service/transaction; DB row and file can diverge. | `materialController.js:132-138`, `233-239`; `MaterialService.deleteStoredFiles` | Use a storage abstraction with a compensation log; delete files only after DB commit; add orphan reconciliation job. | M |
| DATA-04 | Critical | `materials.estado` and `material_subjects.estado_aprobacion` duplicate state and can contradict. | `MaterialService.approveMaterial:300-319`, `uploadOrSuggestMaterial:197-205`, `init.sql:183`, `198` | Define one source of truth. Either derive global state from associations or make global state an explicit moderation state with a documented invariant. | M |
| DATA-05 | High | Approving an association does not verify the association exists or belongs to the subject; affected rows are ignored. | `MaterialService.js:307-308`, `MaterialRepository.updateAssociationState:295-300` | Check affected rows; require the material-subject row; validate material is pending; use a conditional update. | S |
| DATA-06 | High | Duplicate professor upload associates an existing material as approved but leaves its global state `Pendiente`. | `MaterialService.js:191-205` | Recompute global state or set it consistently; test duplicate flows for student and professor. | S |
| DATA-07 | High | Subject creation and professor replacement are not transactional. | `SubjectService.js:22-45`, `SubjectRepository.replaceProfessors:123-134` | Transaction around subject + professor assignments; bulk insert; audit within the same transaction or via outbox. | M |
| DATA-08 | High | Read/unread toggle grants 100 XP on every read and never subtracts on unread. | `GamificationService.js:188-210` | Make read completion idempotent; award XP once per user/material; use an XP ledger; never award on toggle. | M |
| DATA-09 | High | Reading progress and total pages are accepted from the client; completion and XP follow directly. | `GamificationService.js:218-248`, `MariaDBGamificationRepository.updateProgress:131-147` | Validate `currentPage`/`totalPages` against material metadata and monotonic progress; award completion once; consider server-side page events. | M |
| DATA-10 | High | Heartbeat trusts `activeSeconds` and keeps sessions in process memory; no persistence or multi-instance coordination. | `GamificationService.js:319-370` | Store session windows in Redis/DB; derive elapsed time server-side; cap deltas; expire sessions. | M |
| DATA-11 | High | `registerActivity` is a read-modify-write race; two concurrent heartbeats can lose a streak increment or duplicate it. | `MariaDBGamificationRepository.registerActivity:271-306` | Use an atomic upsert with date comparison, or `SELECT ... FOR UPDATE` inside a transaction; unique day ledger. | M |
| DATA-12 | High | Pending-upload limit is checked with `COUNT` then inserted; concurrent requests can exceed 3. | `MaterialService.js:218`, `268-273` | Enforce with a transaction and `SELECT ... FOR UPDATE`, or a dedicated quota row; add a DB constraint if feasible. | M |
| DATA-13 | High | Favorite toggle is select/delete/insert plus counter update, not atomic; counter can drift and concurrent toggles can duplicate or lose updates. | `MaterialRepository.toggleFavorite:379-395` | Use a transaction and `INSERT IGNORE`/`DELETE`; derive count or update atomically; return the authoritative count. | M |
| DATA-14 | Medium | `subjects.profesor_id` is a cache of the first professor and can drift from `subject_professors`. | `SubjectRepository.syncPrimaryProfessor:93-103`, `requestAssociation:174-181`, `replaceProfessors` | Remove the cache or make it a generated/read-only projection maintained by one transaction; never use it for authorization. | M |
| DATA-15 | Medium | `materials.contador_favoritos` and `users.xp`/`rank_level` are denormalized without reconciliation. | `init.sql:184-185`, `MariaDBUserRepository.addXp` | Add reconciliation jobs, use ledger tables for XP, or compute counters from source tables for correctness-critical reads. | M |
| DATA-16 | Medium | `file_hash` unique violation is not caught; concurrent duplicate uploads can return 500 instead of a clean duplicate response. | `MaterialRepository.save:50-68`, `findByHash:75-78` | Catch `ER_DUP_ENTRY`; re-query by hash; return 409 or associate existing; add a unique index test. | S |
| DATA-17 | Medium | Notification unique key includes nullable `subject_id`/`material_id`; MariaDB permits multiple NULLs, so duplicates are possible. | `init.sql:271`, `NotificationRepository.createMany:10-25` | Use sentinel `0` or generated columns, or split notification types; test null combinations. | S |
| DATA-18 | Medium | `createMany` resets `read_at` on duplicate, resurrecting read notifications. | `NotificationRepository.js:21` | Decide semantics: keep read state on duplicate, or create a new notification ID; document it. | S |
| DATA-19 | Medium | `toggleRead`, `addToBacklog`, and `toggleFavorite` do not check material visibility/state; any authenticated user can act on pending/canceled material by ID. | `GamificationService.js:188-210`, `267-272`; `MaterialRepository.toggleFavorite` | Add a visibility policy and return 404/403 for non-visible materials. | S |
| DATA-20 | Medium | `banStudent` does not validate that the target is a student; `subscribe` can race with a ban and re-activate a banned subscription. | `SubscriptionService.js:21-58`, `SubscriptionRepository.subscribe:35-42` | Validate target role; use a single atomic upsert that preserves `Baneado` unless an explicit unban occurs. | M |
| DATA-21 | Medium | `rejectAssociation` deletes all professor assignments for the subject, not just the requester. | `SubjectRepository.rejectAssociation:193-200` | Store the requester on the association request and delete only that request; keep existing professors. | M |
| DATA-22 | Medium | `confirmAssociation` with no professor can activate a subject with no professor. | `SubjectService.js:75-82`, `SubjectRepository.confirmAssociation:183-191` | Require at least one professor or an explicit "unassigned" state; validate before activation. | S |
| DATA-23 | Medium | Audit is best-effort and can be missing for successful actions; the table is mutable and has no append-only protection. | `AuditLogService.js:17-24`, `init.sql:222-229` | Write audit in the same transaction or via outbox; use append-only permissions, hash chaining, and retention policy. | M |
| DATA-24 | Medium | Streak date keys use UTC, while users expect local-day streaks; timezone behavior is undocumented. | `MariaDBGamificationRepository.registerActivity:276-293` | Store the user's timezone or compute day keys in a configured timezone; document DST behavior. | S |
| DATA-25 | Low | Registration is not transactional: a user can exist without a verification token if token persistence fails. | `AuthService.js:127-161` | Transaction around user + token; resend flow already provides recovery, but make it deterministic. | S |
| DATA-26 | Low | `createProfessor` relies on the DB default `Activo`; registration explicitly sets `PendienteVerificacion`. | `AuthService.js:165-183`, `UserRepository.save` | Set state explicitly and make the policy clear. | S |

### 4.2 Detailed remediation: material state model

There are two viable models.

**Model A — global state derived from associations (recommended for current product):**

- Remove `materials.estado` as an independent approval flag, or keep it only as a cached projection.
- Define:
  - material is visible if it has at least one `material_subjects` row with `estado_aprobacion = 'Aprobado'`;
  - material is pending if it has no approved association and at least one pending association;
  - material is rejected/canceled if all associations are removed and the upload was rejected/canceled.
- Recompute the cached `materials.estado` in the same transaction as association changes.

**Model B — global moderation plus per-subject approval:**

- Keep both states, but define invariants:
  - `Aprobado` global requires at least one approved association;
  - a pending association may exist while global is approved;
  - a global `Pendiente` cannot have an approved association;
  - rejection only changes global state when no approved association remains.
- Enforce with a transaction and conditional updates.

Whichever model is chosen, write it in an ADR and test the matrix:

| Global state | Association state | Valid? | Visible in catalog? | Visible in subject? |
|---|---|---|---|---|
| Pendiente | Pendiente | yes | no | no |
| Pendiente | Aprobado | no | no | yes (bug) |
| Aprobado | Pendiente | yes | yes | no |
| Aprobado | Aprobado | yes | yes | yes |
| Rechazado | none | yes | no | no |
| Cancelado | none | yes | no | no |

### 4.3 Detailed remediation: transaction boundary

Introduce a small transaction abstraction without rewriting every repository:

```js
// infrastructure/db/transaction.js
async function withTransaction(pool, work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const tx = { execute: (...args) => conn.execute(...args), query: (...args) => conn.query(...args) };
    const result = await work(tx);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
```

Then change repository methods used by a use case to accept an optional `tx`:

```js
async save(material, tx = db) {
  const [res] = await tx.execute(...);
}
```

Start with the highest-risk use cases:

1. `MaterialService.uploadOrSuggestMaterial`
2. `MaterialService.uploadBatch`
3. `MaterialService.approveMaterial` / `rejectMaterial`
4. `MaterialService.associateMaterialToSubjects`
5. `SubjectService.createSubject` / `updateSubject`
6. `AuthService.register` / `resetPassword`
7. `SubscriptionService.banStudent`
8. `GamificationService.toggleRead` / `updateProgress`

Use an outbox for side effects that must not be rolled back (email, notifications, audit) if the product requires guaranteed delivery. If eventual consistency is acceptable, keep them after commit but make them retryable.

---

## 5. Architecture and Design Findings

### 5.1 Architecture register

| ID | Severity | Finding | Evidence | Recommendation | Effort |
|---|---|---|---|---|---|
| ARCH-01 | High | Domain entities are anemic; business invariants live in services, controllers, and SQL. | `Material.js`, `User.js`, `Subject.js`; `MaterialService.js` | Move state transitions, visibility, and authorization rules into domain methods/policies; keep services as orchestration. | L |
| ARCH-02 | High | Controllers bypass application services for reads and directly use repositories. | `engagementController.js:9`, `33-62`; `materialController.js` | Add query services/read models; controllers should not know SQL shapes or repository methods. | M |
| ARCH-03 | High | `MaterialService` is a god service with nine dependencies and mixed concerns. | `container.js:80`, `MaterialService.js:1-30` | Split into upload, moderation, association, favorite, and catalog services; use a facade only if needed. | L |
| ARCH-04 | High | Observer pattern is an in-memory simulation; notifications are persisted separately and emails are not guaranteed. | `domain/observers/StudentObserver.js:13-31`, `MaterialService.notifyObservers:147-160` | Replace with domain events + outbox/worker; persist event payloads; add retries and dead-letter handling. | L |
| ARCH-05 | High | No transaction manager, unit of work, or outbox. | `container.js`, all services | Add transaction abstraction and outbox; make side effects explicit. | L |
| ARCH-06 | Medium | Configuration is read at module load with hardcoded fallbacks; no schema validation. | `AuthService.js:23-28`, `authMiddleware.js:8`, `db.js:14-27` | Central `config` module validated at startup; inject config; fail fast on missing secrets. | M |
| ARCH-07 | Medium | Ports are abstract classes but not enforced; repositories return raw rows and attach ad-hoc fields. | `MaterialRepository.js:39-47`, `141-195`; `MaterialRepositoryInterface.js` | Define DTOs/contract tests; keep domain entities clean; map at the adapter boundary. | M |
| ARCH-08 | Medium | No API contract, OpenAPI schema, or generated client. | `routes/*`, `controllers/*`, frontend `apiService` | Add OpenAPI 3.1, request/response schemas, examples, and contract tests. | M |
| ARCH-09 | Medium | Response envelopes and naming are inconsistent (`camelCase` vs raw snake_case; different wrappers). | `routes.txt` conventions; `SubscriptionRepository.findByAlumno`; controllers | Standardize `{ data, meta, error }` or document a single envelope; add serializers. | M |
| ARCH-10 | Medium | No pagination standard; frontend paginates after downloading everything. | `catalogFrontController.js:146-205`; repositories `findAllGlobal` | Add `page`/`pageSize` or cursor pagination with max limits; update frontend. | M |
| ARCH-11 | Medium | No read models; complex read joins run on every request. | `SELECT_MATERIAL`, `attachCareers`, `getProfileStats`, `audit findAll` | Introduce query objects/read models for catalog, profile, admin, audit. | L |
| ARCH-12 | Medium | No caching layer for reference data or public catalog. | `CareerRepository.findAll`, `SubjectRepository.findAll`, `MaterialRepository.findFilterOptions` | Cache careers/subjects/categories/ranks with short TTL and invalidation; cache public catalog pages. | M |
| ARCH-13 | Medium | No graceful shutdown, health, readiness, or pool close. | `server.js:60-66` | Handle SIGTERM/SIGINT; stop accepting; drain; close pool; add `/healthz` and `/readyz`. | S |
| ARCH-14 | Medium | No migration framework or version table; schema drift between `init.sql` and migrations. | `config/init.sql`, `migrate_*.sql`, `migrations/001_notifications.sql` | Adopt a migration tool (Knex, Umzug, Flyway, Liquibase); one ordered history; rollback policy. | M |
| ARCH-15 | Medium | Frontend uses global scripts and implicit dependencies (`LanguageManager`, `authHelper`, `apiService`, `el`). | `frontend/js/**` | Adopt ES modules and explicit imports; add a small bundler only if needed. | M |
| ARCH-16 | Medium | Backend `LanguageManager` is shared mutable state; concurrent requests can change the active language. | `languageMiddleware.js:20-23`, `LanguageManager.js:38-45` | Remove global language mutation; pass `lang` explicitly to validators/services; make `getThisMessage` pure. | S |
| ARCH-17 | Medium | No structured logging, request IDs, metrics, or tracing. | `server.js`, `errorMiddleware.js`, `console.*` usage | Add pino/winston, correlation IDs, request duration metrics, DB/email metrics, and tracing. | M |
| ARCH-18 | Medium | No backend unit tests or lint/format configuration; only API tests. | `backend/package.json`; no ESLint/Prettier/Jest config found | Add unit tests for domain/services, lint, format, coverage thresholds, and CI. | M |
| ARCH-19 | Low | No ADRs for major decisions. | repository docs | Add short ADRs for state model, auth, transactions, search, storage, audit. | S |
| ARCH-20 | Low | `README` claims a strict hexagonal architecture and MongoDB interchangeability that the code does not fully support. | `README.md` | Align documentation with reality; state current constraints and planned work. | S |

### 5.2 Detailed remediation: split `MaterialService`

A pragmatic split:

| New service | Responsibilities |
|---|---|
| `MaterialUploadService` | File/link validation, hashing, duplicate detection, creation, storage compensation. |
| `MaterialModerationService` | Approve/reject/cancel, state invariants, professor authorization. |
| `MaterialAssociationService` | Associate/dissociate subjects, mandatory flags, notifications. |
| `MaterialCatalogService` | Global/subject/author reads, filters, pagination, favorite flags. |
| `FavoriteService` | Toggle favorite, count, user favorite list. |
| `MaterialDeletionService` | Global delete, subject removal, file cleanup, audit. |

Shared policies:

- `MaterialVisibilityPolicy`
- `MaterialManagementPolicy`
- `MaterialStatePolicy`

This reduces constructor arity and makes each service testable without a full container.

### 5.3 Detailed remediation: durable notifications and audit

Current flow:

```text
service -> notifyObservers -> StudentObserver.update -> in-memory array
service -> notificationRepository.createMany -> DB
service -> auditLogService.record -> DB (swallowed)
service -> mailer (in some flows)
```

Recommended flow:

```text
service -> transaction:
  write material/association
  insert outbox_event(type, aggregate_id, payload)
commit
worker:
  claim event
  create notifications
  send email
  write audit
  mark event processed
  retry with backoff; dead-letter after N attempts
```

This provides at-least-once delivery and decouples request latency from email/notification work. Audit can remain synchronous in the same transaction if the requirement is "no successful action without audit"; otherwise use the outbox with a strict monitoring alert.

---

## 6. API, Validation, and HTTP Findings

### 6.1 API register

| ID | Severity | Finding | Evidence | Recommendation | Effort |
|---|---|---|---|---|---|
| API-01 | High | No pagination on most list endpoints. | `routes.txt`; repositories | Add pagination and max limits; return `meta`. | M |
| API-02 | Medium | Query parameters are parsed ad hoc; no max for `subjects`, `tags`, `careerId`, `yearId`, `limit`, `offset`. | `materialController.js:60-75`, `MaterialRepository.findFavorites:404-408` | Use a schema validator (Zod/Joi/express-validator) and clamp limits. | M |
| API-03 | Medium | Toggle endpoints (`POST /favorite`, `POST /reads/:id/toggle`) are non-idempotent; retries flip state. | `materialRoutes.js:34`, `engagementRoutes.js:24` | Replace with explicit `PUT`/`DELETE` or accept an idempotency key/desired state. | S |
| API-04 | High | Approve/reject accept `subjectId` from the body without validation; missing/NaN IDs can produce SQL errors or unintended updates. | `materialController.js` approve/reject; `MaterialService.js:300-340` | Validate positive integer; verify association exists; return 404/422. | S |
| API-05 | Low | `DELETE /materials/:id` is overloaded: with `subjectId` it removes an association; without it, deletes globally. | `materialRoutes.js:31-32`, `MaterialService.delete:511-537` | Use distinct routes: `DELETE /materials/:id` and `DELETE /materials/:id/subjects/:subjectId`. | S |
| API-06 | Medium | Inconsistent status codes and envelopes; duplicate tag creation returns 201 for an existing resource. | controllers; `ThematicTagService.create` | Define status semantics; return 200 for existing, 201 only for new. | S |
| API-07 | Medium | `GET /api/profile/:id` and `/users/:id/*` are public by default with no visibility model. | `engagementRoutes.js:13-17` | Require auth or explicit public profile flag; separate private fields. | M |
| API-08 | Medium | No request/response schema validation for body types beyond selected services. | controllers/services | Add schema validation at the edge; keep business validation in services. | M |
| API-09 | Low | `ok()` only translates `message` if it contains a dot; raw messages bypass localization. | `respond.js:7-12` | Always use keys or explicit localized text; avoid heuristic detection. | S |
| API-10 | Low | Batch metadata length is not checked against file count; extra/missing metadata silently ignored. | `materialController.js:159-210` | Validate metadata length and report per-item errors. | S |
| API-11 | Low | `parseBatchLinks` accepts arbitrary strings and infers type; error messages are not per line. | `materialController.js:35-54` | Return structured per-item validation errors with line numbers. | S |
| API-12 | Low | No `ETag`/`If-None-Match` or cache headers for public reads. | controllers | Add cache validators for public catalog/reference data. | S |

### 6.2 Detailed remediation: pagination contract

Recommended default:

```http
GET /api/materials/global?page=1&pageSize=20&sort=createdAt:desc
```

Response:

```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1532,
    "totalPages": 77,
    "hasNext": true
  }
}
```

For large or frequently changing lists, prefer cursor pagination:

```http
GET /api/materials/global?limit=20&cursor=eyJjcmVhdGVkQXQiOiIyMDI2LTEwLTMwVDEyOjAwOjAwWiIsImlkIjoxMjM0fQ
```

Rules:

- `pageSize` default 20, max 100.
- Never allow unlimited `pageSize`.
- Stable sort: `created_at DESC, id DESC`.
- Count queries are optional; use `hasNext` by fetching `limit + 1`.
- Frontend must stop downloading the entire collection.

### 6.3 Detailed remediation: validation layers

| Layer | Responsibility |
|---|---|
| HTTP schema | Types, required fields, string lengths, enums, array sizes, numeric ranges. |
| Application service | Business invariants (pending limit, ownership, state transitions). |
| Domain entity | Local invariants (valid state transition, non-negative XP, valid page range). |
| Database | Uniqueness, foreign keys, check constraints where supported, nullability. |

Do not rely on the frontend or on `Number(x) || fallback` for validation.

---

## 7. Performance and Scalability Findings (Code Level)

The database-specific analysis is in [`database_performance.md`](database_performance.md). This section records the code-level causes.

### 7.1 Performance register

| ID | Severity | Finding | Evidence | Recommendation | Effort |
|---|---|---|---|---|---|
| PERF-01 | High | No server-side pagination; all matching rows are fetched. | `findAllGlobal:197-206`, `findBySubject:208-222`, `findByAuthor:224-237` | Add pagination and indexes; update frontend. | M |
| PERF-02 | High | `SELECT_MATERIAL` runs three correlated subqueries per material row. | `MaterialRepository.js:11-35` | Replace with aggregated joins or a second batch query; measure with `EXPLAIN`. | M |
| PERF-03 | High | Every material list triggers `attachCareers` as an extra query; favorite IDs and flags add more. | `attachCareers:141-195`, `attachFavoriteFlag`, `getFlagsForMaterials` | Use a single read model/view or batch queries with covering indexes. | M |
| PERF-04 | Medium | Profile stats use six correlated subqueries. | `MariaDBGamificationRepository.js:28-38` | Use separate indexed counts or a summary table; cache profile stats. | M |
| PERF-05 | Medium | `assertProfessorOwnsSubjects` and `ownedSubjectIds` perform sequential `findById` calls, each with multiple queries. | `MaterialService.js` helper methods; `SubjectRepository.findById:136-141` | One query for all subject IDs + professor assignments; batch validation. | M |
| PERF-06 | Medium | Batch upload performs per-item category lookup, hash lookup, insert, tag creation, and audit. | `MaterialService.js:543-594` | Bulk lookup and bulk insert; transaction; process in chunks. | L |
| PERF-07 | High | Search uses `LIKE '%term%'` across six columns; tag filters use `%tag%` on comma text. | `MaterialRepository.buildFilters:83-87`, `129-133` | FULLTEXT or search engine; normalized tags; prefix search where possible. | L |
| PERF-08 | Medium | `YEAR(created_at)` prevents index use on the upload-year filter. | `MaterialRepository.js:101-104` | Store/generated `created_year` or use range predicates. | S |
| PERF-09 | Medium | Audit listing joins six polymorphic tables with no pagination. | `MariaDBAuditLogRepository.js:41-80` | Paginate; store target type; split joins or use a read model. | M |
| PERF-10 | High | Missing composite indexes for common predicates. | `init.sql` index list | Add indexes listed in `database_performance.md`. | M |
| PERF-11 | Medium | Offset pagination in favorites only; no standard for others. | `MaterialRepository.findFavorites:404-408` | Use cursor pagination for large lists. | S |
| PERF-12 | High | Synchronous file hashing blocks the event loop. | `hashHelper.js`, `materialController.js:27-31` | Stream hash in a worker; avoid full-file buffer. | M |
| PERF-13 | Medium | Notification inbox is limited to 30 but unread count and list are separate queries; no caching. | `NotificationRepository.js:31-60` | Combine or cache unread count; add pagination. | S |
| PERF-14 | Medium | Counter reads (favorites, followers) run separately from the toggle/follow response. | `MaterialRepository.toggleFavorite`, `GamificationService.follow` | Return authoritative counts in the same transaction; cache hot counters. | S |
| PERF-15 | Medium | No cache for reference data or public catalog. | repositories | Cache careers/subjects/categories/ranks and public pages. | M |
| PERF-16 | Low | `findFilterOptions` uses `SELECT DISTINCT YEAR(created_at)` over all approved materials. | `MaterialRepository.js:468-482` | Maintain a years table or cache the distinct years. | S |
| PERF-17 | Low | `findByIds` builds a dynamic `IN` list without a cap; very large read/backlog lists can create huge queries. | `MaterialRepository.findByIds:457-466` | Cap and paginate; chunk if needed. | S |

### 7.2 Detailed remediation: catalog read path

Current path for `GET /api/materials/global`:

1. `findAllGlobal` executes `SELECT_MATERIAL` with filters and three correlated subqueries.
2. `attachCareers` executes a second query for all material IDs.
3. `attachFavoriteFlag` executes a query for all favorites of the current user.
4. `attachUserFlags` executes a query for reads/backlog of the current user.
5. The frontend stores all results and paginates locally.

For 10,000 approved materials, this can mean:

- 10,000 rows × several joins/subqueries;
- a large `IN` list in `attachCareers`;
- all favorite IDs for the user;
- all read/backlog flags for the user;
- a large JSON payload.

Recommended read model:

```sql
-- One page of materials, no per-row subqueries.
SELECT m.id, m.titulo, m.tipo, m.url_or_path, m.portada, m.pages,
       m.estado, m.created_at, m.category_id,
       c.slug AS category_slug, c.nombre AS category_nombre,
       u.id AS autor_id, CONCAT(u.nombre, ' ', u.apellido) AS autor_nombre
FROM materials m
JOIN users u ON u.id = m.autor_id
JOIN categories c ON c.id = m.category_id
WHERE m.estado = 'Aprobado'
ORDER BY m.created_at DESC, m.id DESC
LIMIT 20 OFFSET 0;
```

Then batch-load associations for those 20 IDs:

```sql
SELECT ms.material_id, ms.is_mandatory, s.id AS subject_id, s.nombre AS subject_nombre,
       cy.id AS year_id, cy.nombre AS year_nombre, ca.id AS career_id,
       ca.nombre AS career_nombre, ca.color AS career_color
FROM material_subjects ms
JOIN subjects s ON s.id = ms.subject_id
LEFT JOIN career_years cy ON cy.id = s.career_year_id
LEFT JOIN careers ca ON ca.id = cy.career_id
WHERE ms.material_id IN (?, ..., ?)
  AND ms.estado_aprobacion = 'Aprobado';
```

Then batch-load user flags for those 20 IDs. This keeps query count constant and result size bounded.

---

## 8. Frontend Findings

### 8.1 Frontend register

| ID | Severity | Finding | Evidence | Recommendation | Effort |
|---|---|---|---|---|---|
| FE-01 | High | Catalog downloads all materials and filters/sorts/paginates client-side. | `catalogFrontController.js:146-205` | Server-side pagination/filtering; keep URL state. | M |
| FE-02 | High | JWT and user object are stored in `localStorage`; any XSS becomes account takeover. | `authHelper.js:7-12` | Prefer HttpOnly Secure SameSite cookies; if bearer tokens remain, add strict CSP and short TTL. | M |
| FE-03 | Medium | Global scripts and implicit dependencies; load order is fragile. | `frontend/js/**` | ES modules with explicit imports; bundle only if performance requires it. | M |
| FE-04 | Medium | `apiService` has no abort/cancel, timeout, retry, or deduplication. | `apiService.js:10-50` | Add `AbortController`, timeout, retry for idempotent GETs, and request de-duplication. | S |
| FE-05 | Medium | Filter/sort logic is duplicated between pages; catalog and subject pages may diverge. | `catalogFrontController.js`, other front controllers | Extract shared query/filter utilities or use server-driven filters. | S |
| FE-06 | Medium | Frontend role checks use `localStorage` and are not authoritative. | `authHelper.js:21-25` | Treat as UX only; ensure every backend route enforces authorization. | S |
| FE-07 | Medium | Client sends arbitrary progress/heartbeat values. | `materialViewer.js:208-243`, heartbeat component | Send page events only; server validates and computes completion/streak. | M |
| FE-08 | Low | `apiService` appends `lang` to every endpoint, including endpoints that do not use it. | `apiService.js:14` | Append only where supported or standardize `Accept-Language`. | S |
| FE-09 | Low | No loading/error boundary pattern beyond per-page try/catch. | front controllers | Add a shared async state helper and consistent empty/error states. | S |
| FE-10 | Low | Some UI strings and messages are constructed in controllers rather than localization keys. | front controllers | Centralize keys; keep translations complete for both locales. | S |

### 8.2 Detailed remediation: safe session handling

Short term:

- Add a strict CSP (`script-src 'self'`, no inline scripts).
- Remove any inline event handlers.
- Keep access tokens short-lived.
- Store the token in memory and use a refresh cookie if possible.
- Add `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.

Long term:

- HttpOnly, Secure, SameSite=Lax refresh cookie.
- Short-lived access token in memory.
- Refresh rotation with reuse detection.
- Server-side session list and "log out all devices".

---

## 9. Operations, Testing, and Documentation Findings

### 9.1 Operations register

| ID | Severity | Finding | Evidence | Recommendation | Effort |
|---|---|---|---|---|---|
| OPS-01 | High | No graceful shutdown or pool close. | `server.js:60-66` | Handle SIGTERM/SIGINT; stop accepting; drain; close pool. | S |
| OPS-02 | High | No health or readiness endpoint. | `server.js` | Add `/healthz` (liveness) and `/readyz` (DB/storage/mail readiness). | S |
| OPS-03 | Medium | No structured logs, request IDs, or log levels. | `console.*` usage | Adopt pino/winston; include request ID, user ID, route, status, duration. | M |
| OPS-04 | Medium | No metrics or tracing for HTTP, DB, email, uploads, or queue. | none | Add Prometheus metrics and OpenTelemetry tracing; dashboard p95/p99. | M |
| OPS-05 | Medium | No migration runner or version table. | SQL files | Use a migration tool; run migrations as a deploy step. | M |
| OPS-06 | Medium | No CI pipeline, lint, format, or coverage gate. | no CI config found | Add CI: install, lint, unit tests, integration tests, migration check, security audit. | M |
| OPS-07 | Medium | No container/process manager definition or documented deployment. | repository | Add Dockerfile/compose for local; document production process manager and reverse proxy. | M |
| OPS-08 | Medium | No backup/restore, retention, or disaster recovery documentation. | none | Document RPO/RTO, backups, restore drills, retention for uploads/audit. | M |
| OPS-09 | Medium | No startup validation for required env vars or provider connectivity. | config modules | Fail fast with a clear list of missing/invalid variables. | S |
| OPS-10 | Medium | Test suite is API-level; no unit tests for domain/services and no coverage report. | `frontend/js/tests/*`, `backend/package.json` | Add unit tests and coverage; keep API tests as integration. | M |
| OPS-11 | Low | No dependency update policy or security audit. | package files | Add `npm audit`/Dependabot/Renovate and a patch SLA. | S |
| OPS-12 | Low | Documentation and code can drift; no docs CI. | docs | Add link checks and a docs update checklist for API/schema changes. | S |

### 9.2 Test strategy

Recommended pyramid:

| Layer | What to test | Examples |
|---|---|---|
| Unit | Domain invariants, policies, validators, mappers | `MaterialStatePolicy`, `MaterialManagementPolicy`, page normalization, auth token version. |
| Service | Use cases with fake repositories | upload duplicate, approve last association, pending limit race, ban vs subscribe. |
| Repository integration | SQL against a real MariaDB container | filters, pagination, unique constraints, transaction rollback, index usage smoke tests. |
| API contract | Routes, status codes, auth, validation | 401/403/404/409/422, pagination meta, idempotency. |
| End-to-end | Critical journeys | register → verify → login → upload → approve → read → XP. |
| Performance | Query plans and load tests | catalog p95, upload throughput, audit pagination. |

---

## 10. Positive Practices Worth Keeping

1. **Explicit dependency container** makes the graph inspectable.
2. **Repository ports** provide a seam for tests and future adapters.
3. **Centralized `apiService`** avoids scattered fetch logic.
4. **Safe DOM helpers** and avoidance of `innerHTML` reduce XSS risk.
5. **Localized validation** is a strong foundation for a bilingual product.
6. **Audit operation constants** make critical actions visible.
7. **Existing documentation** is detailed and should be maintained.
8. **Role-based route middleware** is a good coarse-grained first line of defense.
9. **File hash duplicate detection** is a useful product feature when made race-safe.
10. **No framework frontend** keeps the runtime small and understandable.

---

## 11. Suggested Definition of Done for Fixes

A finding is not "done" until:

- the behavior is covered by an automated test;
- authorization is enforced server-side and tested for allowed and denied roles;
- multi-step writes are transactional or explicitly documented as eventual;
- errors are mapped to stable status codes and localized messages;
- logs include a correlation ID and do not contain secrets;
- database changes include an `EXPLAIN` before/after and a rollback path;
- documentation and OpenAPI are updated;
- the change is observable in metrics or logs.

---

## 12. Traceability to Roadmap

The roadmap groups these IDs into phases:

- **Phase 0 — safety net:** SEC-01, SEC-02, SEC-04, SEC-05, SEC-15, OPS-01, OPS-02, OPS-09.
- **Phase 1 — correctness:** DATA-01 through DATA-13, API-04, SEC-03, ARCH-05.
- **Phase 2 — performance:** PERF-01 through PERF-12, API-01, ARCH-10, ARCH-12.
- **Phase 3 — durability:** ARCH-04, ARCH-05, DATA-23, OPS-03, OPS-04.
- **Phase 4 — structure:** ARCH-01, ARCH-02, ARCH-03, ARCH-07, ARCH-08, ARCH-15.
- **Continuous:** tests, docs, dependency updates, observability, and security review.

See [`refactoring_roadmap.md`](refactoring_roadmap.md) for sequencing, acceptance criteria, and effort estimates.
