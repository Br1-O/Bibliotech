# Bibliotech — Database and Query Performance Analysis

**Assessment date:** 2026-10-30  
**Database:** MariaDB/MySQL, InnoDB, `utf8mb4`  
**Method:** static analysis of schema, repositories, services, and query shapes. No production execution plans or workload traces were available.

> All indexes and rewrites below are **candidates**. Validate them with `EXPLAIN`/`EXPLAIN ANALYZE` on representative data before deploying. Indexes improve reads but add write cost, storage, and maintenance; do not add every index blindly.

---

## 1. Executive Summary

The schema is normalized enough for the product, but the read paths are not designed for growth.

The main database problems are:

1. **No server-side pagination** on the catalog, audit, users, notifications, or most lists.
2. **Per-row correlated subqueries** in the main material projection.
3. **Extra queries per list** for careers, favorites, and reading flags.
4. **`%LIKE%` search** across six columns and comma-separated tags.
5. **Missing composite indexes** for the actual predicates and sort orders.
6. **Loop-driven writes** in batch upload, subject assignment, and notifications.
7. **Duplicated state** (`materials.estado`, `material_subjects.estado_aprobacion`, counters, XP) without transactions or reconciliation.
8. **Audit queries** with six polymorphic joins and no pagination.
9. **No caching, read models, or queue boundary** for expensive side effects.
10. **No migration framework, statistics policy, or slow-query discipline**.

At small scale the application works because the dataset is small and the pool is local. At 10^5–10^6 rows, the catalog and admin pages will become the first visible bottlenecks, followed by audit and profile reads.

---

## 2. Schema at a Glance

| Group | Tables | Main access pattern |
|---|---|---|
| Identity | `roles`, `users` | Login by email, admin list, profile by id. |
| Academic | `careers`, `career_years`, `subjects`, `subject_professors` | Reference lists, subject pages, professor ownership. |
| Materials | `categories`, `materials`, `material_subjects` | Catalog, subject page, author page, moderation, duplicate hash. |
| Subscriptions | `subscriptions` | Student subscriptions, observers, bans. |
| Engagement | `material_favorites`, `thematic_tags`, `material_reads`, `reading_backlog` | Favorite toggles, read flags, progress. |
| Gamification | `ranks`, `user_badges`, `user_subscriptions`, `reading_streaks` | Profile stats, badges, follows, streaks. |
| Notifications/audit | `notifications`, `audit_logs` | Inbox, unread count, admin audit. |

The full ER model and data dictionary are in [`database_diagram.txt`](database_diagram.txt).

### 2.1 Current index inventory

| Table | Primary / unique | Secondary indexes |
|---|---|---|
| `roles` | `id` PK, `nombre` unique | none |
| `ranks` | `rank_id` PK, `title` unique | none |
| `users` | `id` PK, `email` unique | FK indexes on `role_id`, `rank_level` (InnoDB auto) |
| `careers` | `id` PK, `nombre` unique | none |
| `career_years` | `id` PK, `(career_id, nombre)` unique | FK index on `career_id` |
| `subjects` | `id` PK | FK indexes on `profesor_id`, `career_year_id` |
| `subject_professors` | `(subject_id, profesor_id)` PK | `idx_subject_professors_profesor (profesor_id)` |
| `categories` | `id` PK, `slug` unique | none |
| `materials` | `id` PK, `file_hash` unique | FK indexes on `autor_id`, `uploaded_by`, `category_id` |
| `material_subjects` | `(material_id, subject_id)` PK | FK index on `subject_id` |
| `subscriptions` | `id` PK, `(alumno_id, materia_id)` unique | FK index on `materia_id` |
| `audit_logs` | `id` PK | FK index on `usuario_id` |
| `thematic_tags` | `id` PK, `(nombre, categoria)` unique | FK index on `creado_por` |
| `material_favorites` | `id` PK, `(usuario_id, material_id)` unique | FK index on `material_id` |
| `notifications` | `id` PK, `(usuario_id, type, subject_id, material_id)` unique | `idx_notifications_inbox (usuario_id, read_at, created_at)`; FK indexes |
| `material_reads` | `(user_id, material_id)` PK | `idx_material_reads_material (material_id)` |
| `reading_backlog` | `(user_id, material_id)` PK | `idx_backlog_material (material_id)` |
| `user_subscriptions` | `(subscriber_id, target_user_id)` PK | `idx_user_subscriptions_target (target_user_id)` |
| `reading_streaks` | `user_id` PK | none |
| `user_badges` | `(user_id, badge_key)` PK | none |

InnoDB automatically creates indexes for foreign-key columns when an appropriate index does not exist. Those indexes are useful for joins but are not necessarily the right **composite** indexes for filters and sort orders.

---

## 3. Workload Model

### 3.1 Read-heavy paths

| Path | Frequency | Current query pattern | Risk |
|---|---:|---|---|
| Public catalog | Very high | 1 base query with 3 correlated subqueries + careers query + favorite IDs + read/backlog flags. | High |
| Subject page | High | Similar to catalog, filtered by subject. | High |
| Profile | High | User + six scalar count subqueries + badges + streak + ranks + follow state. | Medium |
| Pending review | Medium | Join `material_subjects` + subjects + users, filter by professor. | Medium |
| Notifications | High | Inbox list + unread count + mark read. | Medium |
| Admin audit | Medium | Six polymorphic left joins, no pagination. | High |
| Admin users | Medium | `SELECT_USER` for all users, no pagination. | Medium |
| Favorites/reads/backlog | Medium | IDs + `findByIds` + flags. | Medium |

### 3.2 Write-heavy paths

| Path | Writes | Risk |
|---|---|---|
| Upload | `materials` + N × `material_subjects` + N × mandatory updates + tags + notifications + audit. | High |
| Batch upload | Up to 100 × (hash lookup + insert + tags + audit). | High |
| Approve/reject | association update + material update + notifications + audit. | High |
| Favorite toggle | select + delete/insert + counter update + count. | Medium |
| Read toggle | material lookup + read insert/delete + XP + badges + notifications. | High |
| Progress | material lookup + read lookup + backlog upsert + read insert + XP + badges + notifications. | High |
| Subject assignment | delete all + N inserts + primary sync + audit. | Medium |
| Registration | user insert + token update + audit. | Medium |

### 3.3 Assumed growth dimensions

Use these for planning; replace with real measurements:

| Entity | Small | Medium | Large |
|---|---:|---:|---:|
| Users | 1k | 50k | 500k |
| Materials | 5k | 100k | 1M |
| Material-subject rows | 10k | 500k | 5M |
| Reads | 20k | 1M | 10M |
| Favorites | 10k | 500k | 5M |
| Notifications | 50k | 2M | 20M |
| Audit rows | 100k | 5M | 50M |

The design should remain usable at the "medium" column without a re-architecture.

---

## 4. Hot Query Analysis

### 4.1 `SELECT_MATERIAL` — three correlated subqueries per row

**Location:** `backend/infrastructure/repositories/MariaDBMaterialRepository.js:11-35`

```sql
SELECT ...,
       (SELECT GROUP_CONCAT(s.nombre)
          FROM material_subjects ms JOIN subjects s ON s.id = ms.subject_id
         WHERE ms.material_id = m.id AND ms.estado_aprobacion = 'Aprobado') AS materias,
       (SELECT GROUP_CONCAT(ms.subject_id)
          FROM material_subjects ms
         WHERE ms.material_id = m.id AND ms.estado_aprobacion = 'Aprobado') AS materiasIds,
       (SELECT GROUP_CONCAT(ms.subject_id)
          FROM material_subjects ms
         WHERE ms.material_id = m.id) AS materiasTodosIds
FROM materials m ...
```

**Problems:**

- Three subqueries execute per material row, even if the outer query returns 10,000 rows.
- `GROUP_CONCAT` has a default `group_concat_max_len` (often 1 MB) and can truncate silently for materials with many subjects.
- The third subquery includes pending associations, which leaks moderation state into a catalog DTO.
- The `materias` and `materiasIds` subqueries scan the same rows twice.

**Immediate rewrite options:**

1. **Batch-load associations after the page query** (recommended with pagination):

```sql
-- page query: no per-row subqueries
SELECT m.id, m.autor_id, m.titulo, m.tipo, m.url_or_path, m.portada,
       m.pages, m.estado, m.created_at, m.category_id,
       u.nombre, u.apellido, r.nombre AS autor_rol,
       ub.nombre AS uploader_nombre, ur.nombre AS uploader_rol,
       c.slug AS category_slug, c.nombre AS category_nombre
FROM materials m
JOIN users u ON u.id = m.autor_id
JOIN roles r ON r.id = u.role_id
LEFT JOIN users ub ON ub.id = m.uploaded_by
LEFT JOIN roles ur ON ur.id = ub.role_id
LEFT JOIN categories c ON c.id = m.category_id
WHERE m.estado = 'Aprobado'
ORDER BY m.created_at DESC, m.id DESC
LIMIT 20;
```

```sql
-- one batch query for the page's 20 IDs
SELECT ms.material_id, ms.is_mandatory,
       s.id AS subject_id, s.nombre AS subject_nombre,
       cy.id AS year_id, cy.nombre AS year_nombre,
       ca.id AS career_id, ca.nombre AS career_nombre, ca.color AS career_color
FROM material_subjects ms
JOIN subjects s ON s.id = ms.subject_id
LEFT JOIN career_years cy ON cy.id = s.career_year_id
LEFT JOIN careers ca ON ca.id = cy.career_id
WHERE ms.material_id IN (?, ..., ?)
  AND ms.estado_aprobacion = 'Aprobado'
ORDER BY ca.nombre, cy.orden, s.nombre;
```

2. **If the page query must stay single-statement**, use a derived aggregate joined once:

```sql
LEFT JOIN (
    SELECT ms.material_id,
           GROUP_CONCAT(s.nombre ORDER BY s.nombre SEPARATOR ',') AS materias,
           GROUP_CONCAT(ms.subject_id ORDER BY ms.subject_id SEPARATOR ',') AS materias_ids
    FROM material_subjects ms
    JOIN subjects s ON s.id = ms.subject_id
    WHERE ms.estado_aprobacion = 'Aprobado'
    GROUP BY ms.material_id
) sub ON sub.material_id = m.id
```

This still materializes the aggregate for all materials unless the optimizer pushes the predicate, so it is not a substitute for pagination.

**Index support:** `material_subjects (material_id, estado_aprobacion, subject_id)` and `(subject_id, estado_aprobacion, material_id, is_mandatory)`.

### 4.2 `buildFilters` — non-sargable search and tag filters

**Location:** `MariaDBMaterialRepository.js:80-135`

```sql
(m.titulo LIKE ? OR m.author LIKE ? OR m.categories LIKE ?
 OR m.descripcion LIKE ? OR u.nombre LIKE ? OR u.apellido LIKE ?)
```

with `%term%` parameters.

**Problems:**

- Leading wildcard prevents normal B-tree index use.
- Six `OR` predicates across multiple tables prevent a single index path.
- No relevance ranking; results are ordered only by date.
- `categories LIKE '%tag%'` produces false positives (`art` matches `article`, `cart`, etc.).
- `YEAR(m.created_at) = ?` is non-sargable.

**Recommendations:**

- Short term: add a **generated search column** and FULLTEXT index for the material-owned fields:

```sql
ALTER TABLE materials
  ADD COLUMN search_text TEXT
    AS (CONCAT_WS(' ', titulo, author, categories, descripcion)) STORED;

ALTER TABLE materials
  ADD FULLTEXT INDEX ft_materials_search (search_text);
```

Query:

```sql
SELECT ...
FROM materials m
WHERE m.estado = 'Aprobado'
  AND MATCH(m.search_text) AGAINST (? IN BOOLEAN MODE)
ORDER BY m.created_at DESC
LIMIT 20;
```

- For author names and subject names, maintain a **material_search** read model (material_id, title, author_name, subject_names, tags, search_text) via triggers/outbox, or use a search engine (Meilisearch/OpenSearch) when relevance and typo tolerance matter.
- Replace tag `LIKE` with a normalized `material_tags(material_id, tag_id)` table.
- Replace `YEAR(created_at) = ?` with:

```sql
m.created_at >= '2026-01-01' AND m.created_at < '2027-01-01'
```

or add a stored `created_year SMALLINT AS (YEAR(created_at)) STORED` with an index.

### 4.3 `attachCareers` — extra query per list

**Location:** `MariaDBMaterialRepository.js:141-195`

This is a good batch query in isolation, but it is executed on every material list and builds an `IN` list from every returned material. Without pagination, the `IN` list grows with the catalog.

**Recommendations:**

- Paginate first, then attach for at most `pageSize` IDs.
- Add `(material_id, estado_aprobacion, subject_id)` index.
- Consider a material catalog read model that stores subject/career names as denormalized fields if read latency matters more than write complexity.
- Do not run `attachCareers` for moderation/admin lists that do not need career colors.

### 4.4 Favorites — toggle and list

**Location:** `MariaDBMaterialRepository.js:379-431`

Toggle:

```sql
SELECT id FROM material_favorites WHERE material_id = ? AND usuario_id = ?;
-- then DELETE or INSERT
UPDATE materials SET contador_favoritos = ... WHERE id = ?;
SELECT COUNT(*) FROM material_favorites WHERE material_id = ?;
```

**Problems:**

- Three to four round trips per toggle.
- Race between select and insert/delete.
- Counter update can drift; `GREATEST(..., 0)` hides negative drift.
- Count query is separate.

**Recommendations:**

- Transaction with `INSERT IGNORE`/`DELETE` and atomic counter update.
- Return the count from the same transaction.
- Add `(material_id, usuario_id)` index (the unique key is `(usuario_id, material_id)`, so a material-first lookup needs a secondary index).
- For the favorites list, add `(usuario_id, created_at, material_id)` to support `ORDER BY mf.created_at DESC` without filesort.
- Consider removing `materials.contador_favoritos` and computing `COUNT` for low-traffic reads, or maintain it via a ledger/reconciliation job.

### 4.5 Profile statistics — six scalar subqueries

**Location:** `MariaDBGamificationRepository.js:28-38`

```sql
SELECT
  (SELECT COUNT(*) FROM user_subscriptions WHERE target_user_id = ?) AS followers,
  (SELECT COUNT(*) FROM user_subscriptions WHERE subscriber_id = ?) AS following,
  (SELECT COUNT(*) FROM material_reads WHERE user_id = ?) AS read_count,
  (SELECT COUNT(*) FROM material_favorites WHERE usuario_id = ?) AS favorites,
  (SELECT COUNT(*) FROM materials WHERE uploaded_by = ? AND estado = 'Aprobado') AS uploads,
  (SELECT COUNT(*) FROM reading_backlog WHERE user_id = ?) AS backlog
```

Each subquery can use an index, but the profile endpoint runs this on every load, and `getProfile` also loads badges, streak, ranks, and follow state.

**Recommendations:**

- Add the missing indexes listed below.
- Cache profile stats for 30–60 seconds (keyed by user + version) if slight staleness is acceptable.
- Or maintain a `user_stats` summary row updated by the same transaction/outbox that changes reads/favorites/follows/uploads.
- Do not run `listRanks()` on every profile request; cache the small `ranks` table.

### 4.6 Pending review

**Location:** `MariaDBMaterialRepository.js:248-275`

```sql
FROM material_subjects ms
JOIN materials m ...
JOIN subjects s ...
WHERE ms.estado_aprobacion = 'Pendiente'
  AND EXISTS (SELECT 1 FROM subject_professors sp
              WHERE sp.subject_id = s.id AND sp.profesor_id = ?)
```

**Recommendations:**

- Add `material_subjects (estado_aprobacion, subject_id, material_id)`.
- `subject_professors` already has `(profesor_id)`; a composite `(profesor_id, subject_id)` would be covering for the `EXISTS` lookup. The PK is `(subject_id, profesor_id)`, so a professor-first index is needed.
- Paginate; a professor with many pending items should not load all of them.
- Return only the columns the review UI needs.

### 4.7 Audit listing

**Location:** `MariaDBAuditLogRepository.js:41-80`

```sql
FROM audit_logs l
LEFT JOIN users u ON u.id = l.usuario_id
LEFT JOIN users u2 ON u2.id = l.registro_id
LEFT JOIN materials m ON m.id = l.registro_id
LEFT JOIN subjects s ON s.id = l.registro_id
LEFT JOIN roles r ON r.id = l.registro_id
LEFT JOIN careers c ON c.id = l.registro_id
LEFT JOIN career_years cy ON cy.id = l.registro_id
ORDER BY l.timestamp DESC, l.id DESC
```

**Problems:**

- `registro_id` is `VARCHAR`; joining numeric IDs requires implicit conversion and can prevent index use.
- Six joins for every row; many are NULL for each row.
- No pagination, no date range, no operation filter, no user filter.
- `ORDER BY timestamp DESC, id DESC` needs an index to avoid filesort.

**Recommendations:**

- Add `registro_tipo` (`ENUM`/`TINYINT`) and store `registro_id` as `BIGINT` where possible; keep a legacy text column only if required.
- Paginate with `(timestamp, id)` cursor.
- Add indexes: `(timestamp, id)`, `(usuario_id, timestamp, id)`, `(tipo_operacion, timestamp, id)`, `(registro_tipo, registro_id, timestamp)`.
- Query the target table only for the page's rows (application-side join) or use a read model.
- For compliance, make the table append-only and archive partitions.

### 4.8 Notifications

**Location:** `MariaDBNotificationRepository.js:10-80`

- `createMany` builds a multi-row `INSERT ... ON DUPLICATE KEY UPDATE`; this is efficient for bulk notifications, but `affectedRows` semantics are tricky.
- `findByUser` is limited to 30, which is good, but `countUnread` is a separate query.
- The unique key `(usuario_id, type, subject_id, material_id)` includes nullable columns; MariaDB allows multiple NULLs, so duplicate "follow" or "streak" notifications can be inserted.
- `ON DUPLICATE KEY UPDATE ... read_at = NULL` resurrects read notifications.

**Recommendations:**

- Fix uniqueness with sentinel values (`0` instead of NULL) or generated columns:

```sql
ALTER TABLE notifications
  ADD COLUMN subject_key INT AS (COALESCE(subject_id, 0)) STORED,
  ADD COLUMN material_key INT AS (COALESCE(material_id, 0)) STORED,
  ADD UNIQUE KEY uq_notification_identity
    (usuario_id, type, subject_key, material_key);
```

- Decide whether a duplicate should preserve `read_at` or create a new notification; document it.
- Add `(usuario_id, created_at, id)` for inbox pagination and keep the unread index.
- Cache the unread count or combine it with the inbox query using a window function if supported.

### 4.9 Gamification writes

**Locations:** `GamificationService.js`, `MariaDBGamificationRepository.js`

- `registerActivity` does `SELECT` then `UPDATE`/`INSERT`; concurrent heartbeats can race.
- `updateProgress` does an upsert and then a `SELECT` to return the row; two round trips.
- `toggleRead` does material lookup, read lookup, insert/delete, XP update, badge evaluation, follower notifications, and user lookup.
- `addXp` likely does multiple queries; inspect and make it atomic.

**Recommendations:**

- Use `INSERT ... ON DUPLICATE KEY UPDATE` with conditional date logic for streaks, or a transaction with `SELECT ... FOR UPDATE`.
- Use an XP ledger (`xp_events`) with a unique key on `(user_id, source_type, source_id)` so each read awards once.
- Update `users.xp` and `rank_level` in the same transaction as the ledger insert.
- Store heartbeat sessions in Redis/DB with TTL, not process memory.
- Validate page ranges and monotonic progress server-side.

### 4.10 Subject ownership and N+1

**Locations:** `MaterialService` helper methods; `MariaDBSubjectRepository.findById`

`findById` runs `SUBJECT_SELECT` plus `attachProfessors` (two queries). `assertProfessorOwnsSubjects` loops over subject IDs and calls `findById` for each, so a material with 10 subjects can trigger 20 queries.

**Recommendations:**

- Add `findByIds(ids)` to `SubjectRepository` with one query for subjects and one for professors.
- Add `(profesor_id, subject_id)` to `subject_professors`.
- Validate ownership in one query:

```sql
SELECT s.id
FROM subjects s
JOIN subject_professors sp ON sp.subject_id = s.id
WHERE s.id IN (?, ..., ?) AND sp.profesor_id = ?;
```

Compare the returned set with the requested set.

### 4.11 Batch upload loops

**Location:** `MaterialService.uploadBatch:543-594`

For each item:

- `resolveCategory` may query `findFilterOptions` (years + categories) each time;
- `findByHash` queries;
- `save` inserts;
- `thematicTagService.create` queries/inserts per tag;
- `auditLogService.record` inserts.

For 100 items, this can be hundreds of round trips.

**Recommendations:**

- Load categories and existing hashes once for the batch.
- Bulk insert materials in chunks.
- Bulk insert tags and associations.
- Insert audit rows in bulk.
- Use a transaction or per-chunk transaction.
- Process in chunks of 25–50 to bound lock time.

### 4.12 `findFilterOptions`

**Location:** `MariaDBMaterialRepository.js:468-482`

`SELECT DISTINCT YEAR(created_at)` scans all approved materials. It is called by the catalog filter loader and on some refresh paths.

**Recommendations:**

- Cache the result for minutes/hours.
- Or maintain a `material_years` summary table updated when a material is created/approved.
- Use a generated `created_year` column with an index.

---

## 5. Index Strategy

### 5.1 Principles

1. Index the **predicate + sort** order used by the query, not just the foreign key.
2. Put equality columns first, then range/sort columns.
3. Prefer covering indexes for hot read paths.
4. Avoid indexing low-selectivity columns alone (for example, `estado` with 4 values).
5. Every index adds write cost; measure write throughput after adding.
6. Use `EXPLAIN` to confirm `key`, `rows`, `filtered`, `Extra` (no `Using filesort`/`Using temporary` for hot paths).
7. Keep statistics fresh (`ANALYZE TABLE`, persistent stats).

### 5.2 Candidate DDL

> Review for duplicate indexes before applying. Some indexes may already be implied by a primary/unique key. Apply in a staging database first.

```sql
-- Materials: catalog filters, author pages, admin lists, year filter.
ALTER TABLE materials
  ADD INDEX idx_materials_estado_created (estado, created_at, id),
  ADD INDEX idx_materials_autor_estado_created (autor_id, estado, created_at, id),
  ADD INDEX idx_materials_uploader_estado_created (uploaded_by, estado, created_at, id),
  ADD INDEX idx_materials_category_estado_created (category_id, estado, created_at, id),
  ADD INDEX idx_materials_tipo_estado_created (tipo, estado, created_at, id);

-- If the YEAR(created_at) filter remains, use a stored generated column.
ALTER TABLE materials
  ADD COLUMN created_year SMALLINT AS (YEAR(created_at)) STORED,
  ADD INDEX idx_materials_year_estado_created (created_year, estado, created_at, id);

-- Material-subject: subject page, pending review, material hydration.
ALTER TABLE material_subjects
  ADD INDEX idx_ms_subject_state_material (subject_id, estado_aprobacion, material_id, is_mandatory),
  ADD INDEX idx_ms_material_state_subject (material_id, estado_aprobacion, subject_id);

-- Subjects: reference lists, career/year filters, professor dashboards.
-- The profesor_id FK already has an auto-created index; verify before adding another.
ALTER TABLE subjects
  ADD INDEX idx_subjects_career_year_nombre (career_year_id, nombre),
  ADD INDEX idx_subjects_estado_career_year (estado_asociacion, career_year_id);

-- Career years: ordered lists.
ALTER TABLE career_years
  ADD INDEX idx_career_years_career_orden (career_id, orden, nombre);

-- Professor assignments: professor-first ownership checks are already covered
-- by idx_subject_professors_profesor (profesor_id), whose InnoDB secondary
-- index includes the primary key columns (subject_id, profesor_id).
-- No additional index is required here.

-- Subscriptions: observers and per-subject moderation.
ALTER TABLE subscriptions
  ADD INDEX idx_subscriptions_materia_estado_alumno (materia_id, estado, alumno_id);

-- Favorites: material-first counts and user-first ordered lists.
ALTER TABLE material_favorites
  ADD INDEX idx_favorites_material_user (material_id, usuario_id),
  ADD INDEX idx_favorites_user_created (usuario_id, created_at, material_id);

-- Notifications: all-notifications pagination.
-- The existing idx_notifications_inbox (usuario_id, read_at, created_at)
-- already covers unread counts; do not add a duplicate (usuario_id, read_at).
ALTER TABLE notifications
  ADD INDEX idx_notifications_user_created (usuario_id, created_at, id);

-- Audit: pagination and filters.
-- Prerequisite: add registro_tipo first (see 4.7); validate/backfill it
-- before creating the polymorphic index. Keep registro_id as VARCHAR until
-- existing values are proven numeric.
ALTER TABLE audit_logs
  ADD COLUMN registro_tipo VARCHAR(50) NULL AFTER usuario_id,
  ADD INDEX idx_audit_timestamp_id (timestamp, id),
  ADD INDEX idx_audit_user_timestamp (usuario_id, timestamp, id),
  ADD INDEX idx_audit_operation_timestamp (tipo_operacion, timestamp, id),
  ADD INDEX idx_audit_registro (registro_tipo, registro_id, timestamp);

-- Reading backlog: ordered "continue reading" lists.
ALTER TABLE reading_backlog
  ADD INDEX idx_backlog_user_updated (user_id, updated_at, material_id);

-- Users: admin filters.
ALTER TABLE users
  ADD INDEX idx_users_role_estado (role_id, estado),
  ADD INDEX idx_users_estado (estado);

-- Tags: moderated vocabulary lists.
ALTER TABLE thematic_tags
  ADD INDEX idx_tags_baneado_categoria_nombre (baneado, categoria, nombre);
```

### 5.3 Covering index examples

| Query | Covering index |
|---|---|
| Approved materials newest-first | `materials (estado, created_at, id)` |
| Author's approved materials | `materials (autor_id, estado, created_at, id)` |
| Subject's approved materials | `material_subjects (subject_id, estado_aprobacion, material_id, is_mandatory)` |
| Pending review for professor | `material_subjects (estado_aprobacion, subject_id, material_id)` + `subject_professors (profesor_id, subject_id)` |
| User favorites newest-first | `material_favorites (usuario_id, created_at, material_id)` |
| Unread notifications | `notifications (usuario_id, read_at, created_at)` |
| Audit newest-first | `audit_logs (timestamp, id)` |
| User reads | `material_reads (user_id, material_id)` (PK) |
| User backlog newest-first | `reading_backlog (user_id, updated_at, material_id)` |

### 5.4 Index anti-patterns to avoid

- Indexing `estado` alone; it has low selectivity.
- Adding `(created_at)` alone when every query filters `estado`; the composite order matters.
- Indexing `categories` text; use FULLTEXT or a normalized tag table.
- Adding indexes on every column "just in case"; write amplification and optimizer confusion.
- Using `LIKE '%...%'` and expecting a B-tree index to help.
- Using `YEAR(created_at)` in the predicate; use a range or generated column.
- Using `ORDER BY` on a column not in the index prefix; expect filesort.
- Forgetting that InnoDB secondary indexes include the primary key, which can make some indexes implicitly covering.

---

## 6. Query Rewrite Patterns

### 6.1 Pagination: offset vs cursor

**Offset:**

```sql
SELECT ...
FROM materials m
WHERE m.estado = 'Aprobado'
ORDER BY m.created_at DESC, m.id DESC
LIMIT 20 OFFSET 200;
```

Offset still scans and discards `OFFSET` rows. Fine for shallow pages; degrades for deep pages and large catalogs.

**Cursor (keyset):**

```sql
SELECT ...
FROM materials m
WHERE m.estado = 'Aprobado'
  AND (m.created_at, m.id) < (?, ?)
ORDER BY m.created_at DESC, m.id DESC
LIMIT 20;
```

Use a composite index `(estado, created_at, id)`. Return the next cursor from the last row. This is stable and efficient for infinite scroll and audit logs.

### 6.2 Exists vs join

For "materials in subject X", both can work:

```sql
-- EXISTS: good when the outer result is small and the index is selective
WHERE EXISTS (
  SELECT 1 FROM material_subjects ms
  WHERE ms.material_id = m.id
    AND ms.subject_id = ?
    AND ms.estado_aprobacion = 'Aprobado'
)
```

```sql
-- JOIN: can duplicate rows if multiple associations match; use DISTINCT or a derived table
JOIN material_subjects ms
  ON ms.material_id = m.id
 AND ms.subject_id = ?
 AND ms.estado_aprobacion = 'Aprobado'
```

Prefer `EXISTS` for filters, and ensure the index starts with the correlated column used by the optimizer (`material_id` or `subject_id` depending on the plan). Validate with `EXPLAIN`.

### 6.3 Count queries

Avoid `COUNT(*)` on every page if the UI can use "has next":

```sql
SELECT ... LIMIT 21;
-- if 21 rows, hasNext = true; return first 20
```

For exact totals, cache them or use a summary table. `COUNT(*)` with a wide `WHERE` can be expensive.

### 6.4 Aggregates

Instead of three correlated `GROUP_CONCAT` subqueries, fetch associations for the page in one query and group in application code. This is usually faster and avoids `group_concat_max_len` truncation.

If you must aggregate in SQL, use one derived table with `GROUP BY material_id`, not three separate subqueries.

### 6.5 Search

Use FULLTEXT for natural-language search:

```sql
SELECT m.id, m.titulo, MATCH(m.search_text) AGAINST (? IN NATURAL LANGUAGE MODE) AS score
FROM materials m
WHERE m.estado = 'Aprobado'
  AND MATCH(m.search_text) AGAINST (? IN NATURAL LANGUAGE MODE)
ORDER BY score DESC, m.created_at DESC
LIMIT 20;
```

For exact tags, use a normalized `material_tags` join:

```sql
SELECT DISTINCT m.id
FROM materials m
JOIN material_tags mt ON mt.material_id = m.id
JOIN tags t ON t.id = mt.tag_id
WHERE t.slug IN (?, ?, ?)
  AND m.estado = 'Aprobado';
```

For multi-tag "all of" semantics, use `GROUP BY m.id HAVING COUNT(DISTINCT t.id) = ?`.

---

## 7. Schema and Data Model Improvements

### 7.1 Material state

Choose one model and enforce it:

**Option A: associations are authoritative**

- `material_subjects.estado_aprobacion` determines visibility per subject.
- Global catalog visibility is `EXISTS (approved association)`.
- `materials.estado` is a cached projection, updated in the same transaction.

**Option B: global moderation + per-subject approval**

- `materials.estado` is the global moderation state.
- Invariant: global `Aprobado` requires at least one approved association; global `Pendiente` forbids any approved association.
- Enforce with conditional updates and tests.

Do not leave both as independent sources of truth.

### 7.2 Tags

Current `materials.categories` is comma-separated text, and `thematic_tags` is a separate catalog. This causes:

- false-positive tag filters;
- no referential integrity;
- duplicate/typo tags;
- expensive `LIKE` filters;
- two taxonomies (`categories` table and `thematic_tags`).

Recommended:

```sql
CREATE TABLE tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  categoria VARCHAR(100) NOT NULL DEFAULT 'general',
  baneado TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE material_tags (
  material_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (material_id, tag_id),
  INDEX idx_material_tags_tag (tag_id, material_id),
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

Migrate existing comma-separated values into rows, deduplicate by slug, and keep the text column temporarily for backward compatibility.

### 7.3 Counters and XP

Replace mutable counters with either:

- **derived counts** for low-traffic values;
- **summary tables** for hot values, updated transactionally;
- **ledgers** for XP and other event-sourced values.

XP ledger example:

```sql
CREATE TABLE xp_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  source_type ENUM('read','upload','streak','badge','admin') NOT NULL,
  source_id BIGINT NULL,
  amount INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_xp_source (user_id, source_type, source_id),
  INDEX idx_xp_user_created (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

Then `users.xp` is a cached sum or a generated summary updated in the same transaction. The unique key makes read completion idempotent.

### 7.4 Notifications

Fix nullable uniqueness and add retention:

```sql
-- Option A: sentinel columns
ALTER TABLE notifications
  ADD COLUMN subject_key INT AS (COALESCE(subject_id, 0)) STORED,
  ADD COLUMN material_key INT AS (COALESCE(material_id, 0)) STORED,
  ADD UNIQUE KEY uq_notification_identity (usuario_id, type, subject_key, material_key);

-- Retention: archive or delete read notifications older than N days.
-- Do this in batches, not one huge DELETE.
```

### 7.5 Audit

- Add `registro_tipo` and use a numeric `registro_id`.
- Add `actor_ip`, `user_agent`, `request_id`, and `metadata JSON` only if needed and with a privacy policy.
- Make the table append-only: application user has `INSERT`/`SELECT`, not `UPDATE`/`DELETE`.
- Consider hash chaining (`prev_hash`, `row_hash`) for tamper evidence.
- Partition by month if retention is long; note that partitioning and foreign keys have restrictions in InnoDB, so test carefully.

### 7.6 Subject professor cache

`subjects.profesor_id` is a cached first professor. Either:

- remove it and derive from `subject_professors`; or
- keep it as a read-only cache updated only by `syncPrimaryProfessor` in the same transaction as assignment changes;
- never use it for authorization.

---

## 8. MariaDB Engine and Configuration Strategies

### 8.1 Storage engine

Use **InnoDB** for all transactional tables. Do not use MyISAM or Aria for user-facing transactional data:

- InnoDB provides row-level locking, transactions, crash recovery, foreign keys, and MVCC.
- Aria is not a drop-in transactional replacement for InnoDB.
- MEMORY tables are not durable and should not hold notifications, sessions, or counters that matter.

### 8.2 InnoDB buffer pool

The buffer pool is the most important memory setting:

- Start with **60–75% of dedicated database RAM** for `innodb_buffer_pool_size`, leaving room for the OS, connections, and per-query memory.
- Use `innodb_buffer_pool_instances` (often 1 per GB, capped at 8) to reduce contention.
- Monitor `Innodb_buffer_pool_read_requests` vs `Innodb_buffer_pool_reads`; a high disk-read ratio means the working set does not fit.
- Warm the pool after restart if latency matters; avoid full scans that evict hot pages.

### 8.3 Redo log and durability

- `innodb_flush_log_at_trx_commit = 1` for full durability; `2` trades a small crash window for throughput. Do not lower it without an explicit RPO decision.
- Size the redo log for write bursts (large batch uploads, notifications). Monitor checkpoint age and log waits.
- Use `innodb_flush_method = O_DIRECT` on Linux where appropriate to avoid double buffering.
- Set `innodb_io_capacity` and `innodb_io_capacity_max` according to the storage device (SSD/NVMe), not defaults.

### 8.4 Connections and pooling

- The app pool is hardcoded to `connectionLimit: 10`. With multiple app instances, total connections = instances × 10. Ensure `max_connections` has headroom.
- Use a pool per process; do not create a pool per request.
- Set `queueLimit` deliberately. `queueLimit: 0` means unlimited queueing, which can hide overload; use a finite queue and fail fast.
- Add `connectTimeout`, `acquireTimeout`, and query timeouts.
- Monitor `Threads_connected`, `Threads_running`, `Aborted_connects`, and pool wait time.

### 8.5 Optimizer statistics

- Enable persistent statistics (`innodb_stats_persistent = ON`) and auto recalculation.
- Run `ANALYZE TABLE` after large data changes or index creation.
- Use engine-independent statistics/histograms where available for skewed columns (for example, `estado`, `tipo`, `categoria`).
- Review `optimizer_switch`; do not disable index condition pushdown or batched key access without evidence.
- Use `EXPLAIN FORMAT=JSON` and `EXPLAIN ANALYZE` to inspect actual rows, loops, and temporary tables.

### 8.6 Slow query and performance schema

Enable and review:

```ini
slow_query_log = ON
long_query_time = 0.2
log_queries_not_using_indexes = ON
performance_schema = ON
```

Use:

- `performance_schema.events_statements_summary_by_digest` for top queries by total latency and rows examined;
- `performance_schema.table_io_waits_summary_by_table` for hot tables;
- `SHOW ENGINE INNODB STATUS` for lock waits and deadlocks;
- `SHOW PROCESSLIST` for long-running queries;
- `information_schema.innodb_trx` for open transactions.

Do not leave `log_queries_not_using_indexes` on forever in a busy system; it can create noise.

### 8.7 Query cache

MySQL's query cache is removed; MariaDB's query cache is deprecated/disabled by default and is not a solution for this workload. Use application-level caching (Redis) for reference data and hot read models instead.

### 8.8 FULLTEXT

- InnoDB FULLTEXT is suitable for moderate search volumes.
- Define the minimum token length and stopwords for Spanish/English.
- Use `BOOLEAN MODE` for required/excluded terms; `NATURAL LANGUAGE MODE` for relevance.
- FULLTEXT indexes add write cost; batch inserts are better than row-by-row.
- For typo tolerance, faceting, and cross-entity search, use a dedicated search engine later.

### 8.9 Partitioning

Partitioning is an advanced option, not a first fix.

Good candidates:

- `audit_logs` by month (`RANGE (TO_DAYS(timestamp))`) with retention/archival.
- `notifications` by month or user hash if the table becomes very large.

Constraints:

- InnoDB partitioned tables have restrictions on foreign keys; test before choosing.
- A unique/primary key must include the partitioning column.
- Partition pruning only works when queries filter on the partition key.
- Too many partitions increase metadata and optimizer overhead.

Do not partition `materials` or `material_subjects` prematurely; indexes and pagination come first.

### 8.10 Read replicas and MaxScale

When read traffic dominates:

- Add one or more MariaDB replicas.
- Route catalog/profile/audit reads to replicas.
- Keep writes and read-after-write paths on the primary.
- Use MaxScale (MariaDB) for read/write splitting and failover, or handle routing in the application.
- Monitor replication lag and define a maximum acceptable staleness.

Replicas do not fix bad queries; they only distribute load.

### 8.11 Caching

Use Redis (or Memcached) for:

- reference data: careers, career years, subjects, categories, ranks, tags;
- public catalog first pages;
- profile stats with short TTL;
- rate-limit counters;
- heartbeat/session windows;
- idempotency keys.

Cache rules:

- key includes language/role/visibility when output depends on it;
- TTL plus explicit invalidation on write;
- stampede protection (single-flight);
- never cache secrets or personalized data without a user-specific key;
- measure hit rate and eviction.

### 8.12 Object storage

Move uploads to S3-compatible object storage when possible:

- offloads disk and backup from the app server;
- supports lifecycle policies and CDN;
- enables pre-signed upload/download URLs;
- avoids serving user files from the Node process.

If files must remain private, use short-lived signed URLs and an authorization check before signing.

### 8.13 High availability

For production HA, consider:

- MariaDB primary/replica with automated failover (MaxScale, Orchestrator, or managed service);
- Galera cluster only if you need multi-primary and can handle certification conflicts and app retry semantics;
- regular backups and restore drills;
- a load balancer in front of stateless app instances;
- sticky sessions only if you keep in-memory state (which you should remove).

---

## 9. Scalability Plan by Stage

### Stage 1 — small (current)

- Single Node process, single MariaDB, local uploads.
- Add missing indexes, pagination, transactions, and auth hardening.
- Add slow-query logging and basic metrics.
- Fix the worst N+1 and correlated subqueries.

### Stage 2 — medium

- Add Redis for caching/rate limits/heartbeat sessions.
- Move uploads to object storage.
- Add background worker for email/notifications/audit.
- Add read model for catalog.
- Add read replica for reporting/audit if needed.
- Add connection pool tuning and query timeouts.

### Stage 3 — large

- Separate API and worker processes; multiple API instances behind a load balancer.
- Read replicas with routing; consider MaxScale.
- Dedicated search engine for cross-entity search.
- Partition/archive audit and notifications.
- Add CDN for static assets and public downloads.
- Add SLOs, tracing, and capacity planning.

### Stage 4 — very large / multi-tenant

- Consider service extraction only around clear boundaries (search, notifications, media).
- Introduce tenant-aware keys and row-level isolation if the product becomes multi-tenant.
- Formalize data retention and privacy workflows.

---

## 10. Benchmark and Validation Plan

### 10.1 Dataset

Generate representative data:

- 100k users (students, professors, admins);
- 100k materials, 500k material-subject rows;
- 1M reads, 500k favorites, 2M notifications, 5M audit rows;
- skewed distributions: a few popular subjects/materials, many inactive users.

### 10.2 Queries to benchmark

1. Catalog page 1, page 100, and cursor page.
2. Catalog search with one term and multiple terms.
3. Subject page with filters.
4. Pending review for a professor with many subjects.
5. Profile with stats/badges.
6. Notifications inbox + unread count.
7. Audit page with date range and operation filter.
8. Favorite toggle and read toggle under concurrency.
9. Batch upload of 100 items.
10. Notification fan-out to 10k subscribers.

### 10.3 Metrics

- p50/p95/p99 latency;
- rows examined vs rows returned;
- `Using filesort` / `Using temporary`;
- buffer pool hit ratio;
- disk reads per query;
- lock wait time and deadlocks;
- connection pool wait time;
- CPU and memory per query;
- write throughput and replication lag.

### 10.4 Acceptance targets (starting points)

| Path | Target p95 | Constraint |
|---|---:|---|
| Catalog page | < 150 ms | No full scan, bounded rows |
| Subject page | < 150 ms | Indexed subject filter |
| Profile | < 200 ms | Cached stats or indexed counts |
| Notifications | < 100 ms | Indexed inbox |
| Audit page | < 250 ms | Paginated, indexed |
| Favorite/read toggle | < 100 ms | Transactional, no lock contention |
| Batch 100 items | < 5 s | Chunked, bulk inserts |

These are engineering targets, not guarantees. Measure on production-like hardware.

---

## 11. Monitoring and Alerts

| Signal | Why | Suggested alert |
|---|---|---|
| Slow query count / p95 | Detect regressions | p95 > 500 ms for 5 min |
| Rows examined / returned | Detect missing indexes | Ratio > 1000 for hot queries |
| Buffer pool hit ratio | Memory pressure | < 99% sustained |
| Disk IOPS / latency | Storage bottleneck | Latency > 10 ms p95 |
| Connections / pool waits | Overload | > 80% of max or wait > 100 ms |
| Deadlocks / lock waits | Write contention | Any sustained increase |
| Replication lag | Stale reads | > 5 s |
| Table/index size | Capacity planning | Growth forecast |
| Backup success | Recovery | Any failure |
| Error rate / 5xx | Application health | > 1% for 5 min |

Dashboards should separate read and write latency, and show top queries by total time, not just average.

---

## 12. Migration and Rollout

### 12.1 Index rollout

1. Capture baseline `EXPLAIN` and p95 for the top 10 queries.
2. Add indexes in a staging copy with production-like data.
3. Measure query plans and write throughput.
4. Use online DDL (`ALGORITHM=INPLACE, LOCK=NONE`) where supported; otherwise schedule a maintenance window.
5. Deploy during low traffic; monitor replication lag and lock waits.
6. Remove redundant indexes after validation.

### 12.2 Query rollout

1. Add the new query behind a feature flag or repository method.
2. Compare results with the old query on a sample.
3. Shadow-read or dual-run in staging.
4. Switch reads gradually.
5. Keep a rollback path.

### 12.3 Schema rollout

1. Add nullable columns/indexes first (expand).
2. Backfill in batches.
3. Switch reads/writes.
4. Remove old columns/indexes later (contract).
5. Never run `init.sql` against an existing environment.

---

## 13. Appendix A — Query Review Checklist

For every new query:

- [ ] Is there a `WHERE` predicate on an indexed column?
- [ ] Does the index order match equality → range → sort?
- [ ] Is the query paginated with a bounded limit?
- [ ] Does it avoid `SELECT *` on wide tables?
- [ ] Does it avoid `%LIKE%` on large text columns?
- [ ] Does it avoid functions on indexed columns (`YEAR`, `LOWER`, etc.)?
- [ ] Does it avoid N+1 loops?
- [ ] Does it return only the columns the caller needs?
- [ ] Is `EXPLAIN` free of full scans, filesort, and temporary tables for hot paths?
- [ ] Is the query safe under concurrent writes?
- [ ] Is there a covering index if it runs frequently?
- [ ] Is the result cacheable, and is the cache key correct?
- [ ] Is there a timeout and a row limit?
- [ ] Is the query monitored in production?

---

## 14. Appendix B — Suggested Migration Order

1. Add missing indexes (low risk, high impact).
2. Add pagination to catalog, audit, notifications, users, and lists.
3. Replace correlated subqueries in the catalog read path.
4. Add transactions for upload, batch, moderation, subject assignment, registration.
5. Fix material state invariants and duplicate flows.
6. Add XP ledger and idempotent read completion.
7. Add notification uniqueness fix and retention.
8. Add audit pagination and target type.
9. Add normalized tags and search read model.
10. Add caching/read models and background workers.
11. Add replicas/partitioning only after the above.

---

## 15. Appendix C — What Not to Do First

- Do not add a read replica to hide full table scans.
- Do not add indexes on every column.
- Do not partition `materials` before fixing pagination and query shape.
- Do not introduce a search engine before normalizing tags and measuring FULLTEXT.
- Do not move to microservices to solve transaction problems.
- Do not cache personalized responses without a user/role/visibility key.
- Do not use `SELECT *` in new repository methods.
- Do not run `init.sql` on an existing database.
- Do not rely on the frontend to enforce limits or authorization.
- Do not add denormalized counters without a reconciliation strategy.
