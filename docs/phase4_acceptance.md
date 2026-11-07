# Phase 4 Acceptance — Structural Cleanup

**Date:** 2026-11-06
**Scope:** `P4-01` to `P4-10` of `docs/refactoring_roadmap.md`
**Result:** implemented. Backend unit suite `74/75` passed (`1` skipped database contract test), coverage thresholds passed, OpenAPI covers `89` operations, and the frontend module graph evaluates `34` modules without implicit globals.

---

## Verification commands

```bash
cd backend
npm run test:ci
npm run test:contract
```

```bash
# API integration server (already running during verification)
curl -fsS http://localhost:3000/healthz
curl -fsS http://localhost:3000/readyz

# targeted integration checks
BT_TEST_FILTER='descargas de aprobados' node frontend/js/tests/runNode.mjs
BT_TEST_FILTER='Carga masiva' node frontend/js/tests/runNode.mjs
```

Observed results:

- `npm run test:coverage`: **75 tests, 74 passed, 1 skipped** (the DB contract test is skipped by default).
- Coverage: **57.91% lines, 38.07% functions, 67.41% branches**; thresholds are `50/28/60`.
- `npm run lint`: **0 errors, 21 warnings**.
- `npm run format:check`: all targeted files formatted.
- `npm run check:openapi`: **89 operations**, all Express routes covered, all JSON examples valid.
- `npm run check:modules`: **34 modules** linked and evaluated, no implicit globals.
- `npm run test:contract`: **1/1** against MariaDB.
- Targeted integration: security files **1/1**, batch upload **2/2**.
- Full integration suite was not rerun end-to-end because it exceeds the 10-minute command timeout.

---

## P4-01 — Material service decomposition

`backend/application/services/MaterialService.js` remains the facade with the
same constructor and public methods. The implementation lives in:

- `MaterialServiceContext`;
- `MaterialUploadService`;
- `MaterialModerationService`;
- `MaterialAssociationService`;
- `MaterialManagementService`;
- `MaterialCatalogService`;
- `MaterialFavoriteService`;
- `MaterialAccessService`.

Shared cache and reference lookups live in the context. `backend/tests/materialServices.test.js`
adds focused coverage for upload, moderation, association, management, catalog,
favorites and access. Routes and the DI container were not changed.

## P4-02 — Policies

`backend/domain/policies/MaterialPolicy.js` is the single source for file
visibility, management, cancellation, association, moderation, global deletion
and final-state checks. `backend/tests/materialPolicy.test.js` covers the rules;
all material services use the policy.

## P4-03 — Read logic and DTOs

`AuthService.listUsers(filters)` keeps `authController` out of the user
repository. `backend/application/dto/materialDto.js` provides `toMaterialDto`
and `toMaterialListDto`; the material controller delegates presentation to it.
`backend/tests/authService.test.js` and `backend/tests/materialDto.test.js`
cover both paths.

## P4-04 — Ports and contract tests

`MaterialRepositoryInterface` documents the extended methods used by the new
services. `backend/tests/repositoryPorts.test.js` checks nine port/adapter pairs,
and `backend/tests/repositoryContract.test.js` runs against MariaDB through
`npm run test:contract`.

## P4-05 — OpenAPI and examples

`docs/openapi.yaml` is OpenAPI 3.0.3 and covers:

- all API routes from `backend/routes/*.js` and the `/healthz`, `/readyz` and
  `/metrics` endpoints;
- path parameters, auth requirements, request bodies for mutations and common
  error responses;
- request/response examples for JSON media types.

`backend/scripts/checkOpenApi.js` compares the Express route inventory with the
spec, requires unique `operationId`s, resolves every `$ref`, and validates every
example with Ajv. `npm run check:openapi` runs in CI through `test:ci`.

## P4-06 — Response envelope

`utils/respond.js` adds `requestId` to success payloads. Errors already carry
`message`, `code`, `requestId` and the `X-Request-Id` header. The flat success
payload is retained for compatibility; no `{data, meta}` wrapper was introduced.
`backend/tests/responseContract.test.js` covers both success and error shapes.

## P4-07 — Frontend ES modules

- Every application page loads only `<script type="module" src="/js/bootstrap.mjs">`.
- Utilities, components and controllers use explicit imports/exports.
- No `globalThis` bridge remains for application modules.
- `theme-init.js` is the only classic script, used to avoid a theme flash.
- `tests.html` remains classic for the VM test runner.
- `npm run check:modules` verifies linkage, evaluation, globals and page events.
- Firefox headless smoke tests covered the public, student, professor and admin pages without console errors.

## P4-08 — Tests, lint, format, coverage and CI

- Added `backend/tests/materialServices.test.js` and the new policy, DTO, auth,
  ports, contract and response tests.
- Added ESLint 9 with `backend/eslint.config.js`.
- Added Prettier config and `format`/`format:check`.
- Added `test:coverage` with blocking thresholds.
- Added `test:ci`: lint, format check, OpenAPI check, coverage, module check.
- `.github/workflows/ci.yml` runs `npm run test:ci` on Node 24.

## P4-09 — Documentation and ADRs

Updated `README.md`, `docs/README.md` and `docs/architecture.md`. Added ADRs:

- `0004-state-model.md`
- `0005-auth-session.md`
- `0006-transactions.md`
- `0007-search.md`
- `0008-storage.md`
- `0009-audit.md`

ADR `0002` was corrected to reflect the final no-globals ESM model. ADR `0003`
was updated with full route coverage, example validation and the new CI gates.

## P4-10 — Extraction decision

`docs/adr/0010-extraction.md` keeps search, media and notifications inside the
modular monolith. The decision lists measurable triggers for revisiting
extraction and rejects extraction without evidence.

---

## Residual items

- OpenAPI has no runtime request validation; it is descriptive plus CI-checked.
- Generated operations for secondary endpoints use generic request/response
  schemas; high-risk flows have detailed schemas.
- Prettier is enforced on Phase 4 files and documentation, not the entire
  historical codebase.
- Coverage thresholds are intentionally low and should rise with new tests.
- The full integration suite remains too slow for the current command timeout;
  only targeted filters were rerun.
- Frontend visual permission checks still duplicate some policy rules; the
  backend remains authoritative.
- ADRs for configuration/secrets, migration rollback and observability/SLOs are
  still pending.
- Audit rows remain mutable by a database administrator; retention is not
  automated.
- Search uses FULLTEXT plus a short-token `LIKE` fallback; no external engine.

---

## Files of record

- `backend/application/services/MaterialService.js`
- `backend/application/services/material/*.js`
- `backend/application/dto/materialDto.js`
- `backend/domain/policies/MaterialPolicy.js`
- `backend/domain/ports/MaterialRepositoryInterface.js`
- `backend/controllers/authController.js`
- `backend/controllers/materialController.js`
- `backend/utils/respond.js`
- `backend/tests/materialPolicy.test.js`
- `backend/tests/materialServices.test.js`
- `backend/tests/materialDto.test.js`
- `backend/tests/authService.test.js`
- `backend/tests/repositoryPorts.test.js`
- `backend/tests/repositoryContract.test.js`
- `backend/tests/responseContract.test.js`
- `backend/scripts/checkFrontendModules.js`
- `backend/scripts/openApiRoutes.js`
- `backend/scripts/generateOpenApi.js`
- `backend/scripts/checkOpenApi.js`
- `backend/eslint.config.js`
- `backend/.prettierrc.json`
- `backend/package.json`
- `.github/workflows/ci.yml`
- `docs/openapi.yaml`
- `docs/architecture.md`
- `docs/adr/*.md`
- `frontend/js/bootstrap.mjs`
- `frontend/js/theme-init.js`
- `frontend/html/*.html`
