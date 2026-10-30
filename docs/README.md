# Bibliotech — Documentation and Engineering Assessment

**Project:** Bibliotech — educational material management and virtual classroom platform  
**Assessment date:** 2026-10-30  
**Scope:** current implementation in `bibliotech/backend` and `bibliotech/frontend`  
**Constraint:** this documentation was produced without modifying application code, configuration, schema, or assets.

---

## 1. Purpose of This Documentation Set

This set has two goals:

1. **Describe the system as it is implemented**, not an idealized version of it.
2. **Identify concrete problems, bottlenecks, risks, and optimization opportunities**, with recommendations that can be executed incrementally.

The existing documents cover routes, classes, entity relationships, and professor workflows in detail. This set adds the architectural view, the engineering assessment, the database/query performance analysis, and an executable refactoring roadmap.

---

## 2. Document Map

| Document | What it answers | Best for |
|---|---|---|
| [`architecture.md`](architecture.md) | How the system is structured, how a request flows, which patterns are actually used, and where the architecture diverges from its stated hexagonal design. | New maintainers, architects, technical reviewers |
| [`code_analysis.md`](code_analysis.md) | What is wrong or risky in the code: security, correctness, design, API, frontend, operations, and maintainability. Each finding has evidence, impact, and a concrete recommendation. | Developers, reviewers, technical debt planning |
| [`database_performance.md`](database_performance.md) | How the database is queried, why it will degrade, which indexes and rewrites are needed, and which MariaDB engine and operational strategies apply. | Backend and database engineers, SREs |
| [`refactoring_roadmap.md`](refactoring_roadmap.md) | In what order to fix the findings, with phases, dependencies, acceptance criteria, and migration strategy. | Tech leads, product owners, sprint planning |
| [`routes.txt`](routes.txt) / [`routes.pdf`](routes.pdf) | Complete HTTP route inventory (82 API endpoints and 24 frontend routes), inputs, outputs, access rules, and side effects. | API consumers, QA, security review |
| [`class_diagram.txt`](class_diagram.txt) / [`class_diagram.pdf`](class_diagram.pdf) | Domain, application, infrastructure, adapter, and frontend class/component model. | Developers, design reviews |
| [`database_diagram.txt`](database_diagram.txt) / [`database_diagram.pdf`](database_diagram.pdf) | ER model and data dictionary for the 20 tables and 30 foreign keys. | Backend and database work |
| [`professor_sequence_diagrams.txt`](professor_sequence_diagrams.txt) / [`professor_sequence_diagrams.pdf`](professor_sequence_diagrams.pdf) | Runtime sequences for the main professor workflows. | QA, onboarding, workflow analysis |
| [`diagrams/`](diagrams/) | Mermaid sources and rendered PDFs for context, layers, deployment, request pipeline, material lifecycle, authentication, gamification, database hotspots, data flow, and target architecture. | Architecture communication |

---

## 3. System at a Glance

| Dimension | Current implementation |
|---|---|
| Domain | Educational material, subjects, careers/years, professor assignments, student subscriptions, moderation, favorites, reading progress, gamification, notifications, audit. |
| Roles | `Superadmin`, `Profesor`, `Alumno`, plus anonymous visitors. |
| Backend | Node.js, CommonJS, Express 5, layered as routes → controllers → application services → repository ports → MariaDB adapters. |
| Frontend | Vanilla JavaScript, Web Components, page controllers, centralized `apiService`, custom i18n, no framework and no build step. |
| Database | MariaDB/MySQL, InnoDB, `utf8mb4`, 20 tables, 30 foreign keys, custom SQL migrations. |
| Authentication | JWT bearer tokens (2-hour default), bcrypt password hashes, email verification and password-reset tokens. |
| File storage | Local disk under `backend/uploads` by default; optional Cloudinary mode. |
| Email | Nodemailer transport selected by environment. |
| Deployment shape | Single Node.js process serving both API and static frontend; one relational database; local or cloud file storage. |
| API surface | 82 API endpoints; no version prefix; mixed response envelopes. |
| Testing | Browser/Node API test suite under `frontend/js/tests`; no unit-test runner or coverage gate in the backend package. |

### Architecture in one sentence

Bibliotech has a credible hexagonal/ports-and-adapters skeleton, but several controllers bypass application services, domain entities are mostly data holders, business rules are spread across services and SQL, and there is no transaction/unit-of-work boundary around multi-step operations.

---

## 4. Top Risks and Opportunities

The full analysis is in [`code_analysis.md`](code_analysis.md). The highest-impact items are:

| Priority | Finding | Why it matters |
|---:|---|---|
| 1 | No transaction boundary around material upload, batch upload, subject assignment, registration, or moderation | Partial writes leave orphan files, broken material rows, inconsistent associations, and counters that drift. |
| 2 | Global material state and per-subject approval state are duplicated without an invariant | A material can be globally `Aprobado` while another subject association is still `Pendiente`, or globally `Pendiente` while an association is already approved. |
| 3 | Any professor can edit any student-uploaded material (`MaterialService.assertCanManage`) | Cross-subject authorization bypass and unintended content changes. |
| 4 | Gamification is client-trusting and reversible without XP reversal | Users can farm XP by toggling reads, reporting arbitrary progress, or sending heartbeat values. |
| 5 | No server-side pagination on catalog, audit, notifications, users, or most lists | Response size and query cost grow with the entire dataset; frontend paginates after downloading everything. |
| 6 | Search and tag filtering use `%LIKE%` on multiple columns and comma-separated text | Non-sargable scans, false positives, no relevance ranking, and no scalable tag model. |
| 7 | JWT fallback secret, open CORS, no login rate limiting, no token revocation | Account takeover and token replay risk; banning or password changes do not invalidate existing tokens. |
| 8 | Public endpoints expose profile, favorites, reads, backlog, and author email | Privacy exposure that is not required by the visible product workflows. |
| 9 | Audit is best-effort and not immutable | Critical actions can occur without an audit row; rows can be altered or deleted by a privileged database user. |
| 10 | No graceful shutdown, health checks, readiness checks, or pool lifecycle management | Deployments can drop requests; orchestrators cannot detect unhealthy instances. |
| 11 | `init.sql` drops and recreates the database and creates a known database user | Running it against the wrong environment is destructive; the seeded credentials are not production-safe. |
| 12 | No caching, queue, outbox, or read-model strategy | Email, notifications, audit, hashing, and aggregate counters run synchronously inside request paths. |

---

## 5. Diagram Index

All new diagram sources are Mermaid files under [`diagrams/`](diagrams/). Each has a rendered PDF with the same base name.

| Diagram | Source | Rendered |
|---|---|---|
| System context | [`01_system_context.mmd`](diagrams/01_system_context.mmd) | [`01_system_context.pdf`](diagrams/01_system_context.pdf) |
| Backend layers and dependencies | [`02_backend_architecture.mmd`](diagrams/02_backend_architecture.mmd) | [`02_backend_architecture.pdf`](diagrams/02_backend_architecture.pdf) |
| Deployment topology | [`03_deployment.mmd`](diagrams/03_deployment.mmd) | [`03_deployment.pdf`](diagrams/03_deployment.pdf) |
| HTTP request pipeline | [`04_request_pipeline.mmd`](diagrams/04_request_pipeline.mmd) | [`04_request_pipeline.pdf`](diagrams/04_request_pipeline.pdf) |
| Material lifecycle and state model | [`05_material_lifecycle.mmd`](diagrams/05_material_lifecycle.mmd) | [`05_material_lifecycle.pdf`](diagrams/05_material_lifecycle.pdf) |
| Authentication and account states | [`06_auth_flow.mmd`](diagrams/06_auth_flow.mmd) | [`06_auth_flow.pdf`](diagrams/06_auth_flow.pdf) |
| Reading and gamification flow | [`07_gamification_flow.mmd`](diagrams/07_gamification_flow.mmd) | [`07_gamification_flow.pdf`](diagrams/07_gamification_flow.pdf) |
| Database hot paths | [`08_database_hotspots.mmd`](diagrams/08_database_hotspots.mmd) | [`08_database_hotspots.pdf`](diagrams/08_database_hotspots.pdf) |
| End-to-end data flow | [`09_data_flow.mmd`](diagrams/09_data_flow.mmd) | [`09_data_flow.pdf`](diagrams/09_data_flow.pdf) |
| Target architecture | [`10_target_architecture.mmd`](diagrams/10_target_architecture.mmd) | [`10_target_architecture.pdf`](diagrams/10_target_architecture.pdf) |

The existing ER, class, route, and professor sequence diagrams remain the authoritative detailed views for those areas.

---

## 6. How to Read the Findings

The register contains **119 findings**: 6 Critical, 36 High, 59 Medium, and 18 Low. Every finding in [`code_analysis.md`](code_analysis.md) uses this shape:

- **ID** — stable identifier, for example `SEC-03` or `DATA-07`.
- **Severity** — `Critical`, `High`, `Medium`, or `Low`.
- **Evidence** — file and line references in the current code.
- **Impact** — what can go wrong in production or maintenance.
- **Recommendation** — a concrete change, not a general aspiration.
- **Effort** — `S` (hours), `M` (days), `L` (weeks), `XL` (multi-sprint).

The roadmap groups these IDs by phase. Some findings have a short-term mitigation in an early phase and a structural follow-up in a later phase, as described in the register.

---

## 7. Boundaries and Assumptions

- The analysis is based on **static inspection** of the repository and the existing documentation. No production workload, execution plan, or benchmark was available.
- The database section gives **candidate indexes and rewrites**; they must be validated with `EXPLAIN`/`EXPLAIN ANALYZE` against representative data before deployment.
- The recommendations preserve the current product behavior unless explicitly described as a behavior change.
- The project directory is not a Git repository, so change verification is filesystem-based rather than diff-based.
- No secrets or `.env` values are reproduced in these documents.

---

## 8. Source-of-Truth Map

| Concern | Primary sources |
|---|---|
| Runtime assembly | `backend/server.js`, `backend/infrastructure/container.js` |
| Configuration | `backend/.env.example`, `backend/config/db.js`, `backend/config/multerConfig.js` |
| Schema | `backend/config/init.sql`, `backend/config/migrate_*.sql`, `backend/config/migrations/001_notifications.sql` |
| HTTP contract | `backend/routes/*.js`, `backend/controllers/*.js` |
| Business rules | `backend/application/services/*.js`, `backend/domain/entities/*.js`, `backend/domain/observers/*.js` |
| SQL and mappings | `backend/infrastructure/repositories/*.js` |
| Security | `backend/middleware/authMiddleware.js`, `backend/application/services/AuthService.js`, `backend/validators/*` |
| Frontend behavior | `frontend/js/frontControllers/*.js`, `frontend/js/services/apiService.js`, `frontend/js/components/*` |
| Existing detailed docs | `docs/routes.txt`, `docs/class_diagram.txt`, `docs/database_diagram.txt`, `docs/professor_sequence_diagrams.txt` |
