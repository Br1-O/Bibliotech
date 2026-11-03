# Phase 0 acceptance audit

> Historical note: Phase 1 was implemented and verified on 2026-10-31.
> See `docs/phase1_acceptance.md`.

Fecha de verificacion: 2026-10-30

## Resultado

Phase 0 (`P0-01` a `P0-11`) queda implementada y verificada. No se inicio
ninguna fase posterior del roadmap.

## Evidencia por item

| ID | Estado | Evidencia |
|---|---|---|
| P0-01 | Cumplido | `backend/config/env.js` valida longitud, entropia y valores conocidos de `JWT_SECRET`; el arranque con secreto debil termina con exit code 1. El secreto local fue rotado. |
| P0-02 | Cumplido | `token_version` revoca tokens en baneo, desbaneo, baja, cambio de clave y cambio de rol. Pruebas de integracion: `securityTests.js`. |
| P0-03 | Cumplido | Limites por IP y cuenta en login, recuperacion, verificacion, activacion y reenvio; respuestas `429` con `Retry-After`; metricas de rate limit. Prueba manual con limite 3: tercer fallo `401`, cuarto `429`. |
| P0-04 | Cumplido | CORS por allowlist, Helmet/CSP, HSTS en produccion, `Referrer-Policy` y `nosniff`. Smoke test de produccion verificado. |
| P0-05 | Cumplido | Los tokens de desarrollo solo se exponen con `EXPOSE_DEV_TOKENS=true`; produccion rechaza el flag. |
| P0-06 | Cumplido | DTO publico sin email, nacimiento, telefono, genero ni redes; ownership en favoritos/lecturas/backlog. Pruebas de integracion de seguridad. |
| P0-07 | Cumplido | `/healthz`, `/readyz`, cierre ordenado de HTTP y pool; smoke test con `SIGTERM` registra `server.shutdown_complete`. |
| P0-08 | Cumplido | Configuracion invalida falla al arrancar con mensaje no secreto y exit code 1. |
| P0-09 | Cumplido | `init.sql` no destructivo, reset separado, seed demo aislado y migraciones ordenadas. Migraciones `001`-`003` aplicadas en la base remota. |
| P0-10 | Cumplido | Request ID, logs estructurados con redaccion, metricas HTTP/rate-limit/upload/DB/mail. `/metrics` protegido por token en produccion. |
| P0-11 | Cumplido con residual | Cuotas de request/archivo/cantidad, validacion de extension/MIME/firmas, descarga controlada (aprobados publicos; pendientes autenticados), `/uploads` solo imagenes, `nosniff` y `Content-Disposition`. |

## Verificacion ejecutada

- `npm run test:backend`: 13/13.
- `npm test`: 74/74.
- `npm audit`: 0 vulnerabilidades.
- `npm ci --dry-run`: sin conflictos de dependencias.
- Smoke test de produccion: `/healthz` 200, `/readyz` 200, `/metrics` 401 sin token y 200 con token, `/uploads/test.pdf` 404, CSP/HSTS/Referrer-Policy presentes.
- Arranque con `JWT_SECRET` debil: exit code 1.

## Riesgos residuales

- No se integro un antivirus/scanning asincrono; la validacion actual es por firma de archivo. El archivo se escribe en almacenamiento antes de validar y se elimina si falla; los documentos se sirven por API (aprobados publicos, pendientes restringidos), mientras una portada valida es accesible como imagen.
- Cloudinary se verifico a nivel de carga del modulo y compatibilidad de API, no con una subida real en esta sesion.
- La suite de integracion usa una base remota compartida; los tests generan datos y requieren limites de rate limit altos via variables de entorno.
