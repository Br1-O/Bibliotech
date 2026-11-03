# Phase 1 acceptance audit

Fecha de verificacion: 2026-10-31

## Resultado

Phase 1 (`P1-01` a `P1-13`) queda implementada y verificada. Los residuales
listados al final no bloquean el cierre, pero deben considerarse antes de
exponer la aplicacion a produccion con trafico concurrente alto.

## Evidencia por item

| ID | Estado | Evidencia |
|---|---|---|
| P1-01 | Cumplido | `backend/config/db.js` expone `transaction` con una conexion y `AsyncLocalStorage`; upload, batch, moderacion, materias, suscripciones, registro, usuarios y roles usan transacciones. Las pruebas de integracion validan el estado final consistente de los flujos. |
| P1-02 | Cumplido | La limpieza ocurre despues del commit; una subida duplicada exitosa elimina el archivo recien guardado antes de responder; `scripts/reconcileFiles.js` elimina huerfanos locales fuera de la ventana de seguridad; `hashHelper.hashFile` usa stream SHA-256. Pruebas: `materialUploadCleanup.test.js`, `hashHelper.test.js`. |
| P1-03 | Cumplido | Estados `Pendiente`, `Aprobado`, `Rechazado`, `Cancelado` con transiciones validadas; aprobar/rechazar exige asociacion `Pendiente`; un upsert no degrada `Aprobado`; material terminal no se reabre. Pruebas: `refinementTests.js`, `materialTests.js`. |
| P1-04 | Cumplido | Un profesor solo gestiona subidas propias o materiales de materias que imparte; co-profesor permitido, profesor ajeno y alumno denegados; Superadmin habilitado. Pruebas: `refinementTests.js`, `materialTests.js`. |
| P1-05 | Cumplido | `xp_ledger` unico por `(user_id, source, source_id)`; desmarcar no resta XP y remarcar no lo duplica; progreso valida enteros y paginas contra `material.pages`. Pruebas: `gamificationTests.js`, `backend/tests/gamificationService.test.js`. |
| P1-06 | Cumplido | `reading_sessions` persiste el heartbeat; el servidor calcula el tiempo con reloj propio, tope de 120 s por intervalo, sesion obsoleta a 300 s, maximo diario y 300 s para racha. Pruebas: `gamificationTests.js`, `gamificationService.test.js`. |
| P1-07 | Cumplido | `toggleFavorite` bloquea material y fila de favorito, y recalcula `contador_favoritos` con `COUNT(*)` dentro de la transaccion. Prueba de integracion de favoritos/ownership. |
| P1-08 | Cumplido | El limite de 3 pendientes bloquea la fila del autor antes de contar; suscripcion y ban usan upsert que preserva `Baneado`, por lo que suscribirse no evade un ban. Pruebas: `materialTests.js`, `subscriptionTests.js`. |
| P1-09 | Cumplido | Crear materia sin profesor queda `Pendiente`; solicitar no asigna profesor; confirmar agrega solo la solicitud indicada y activa; rechazar elimina solo esa solicitud. Pruebas: `subjectTests.js`. |
| P1-10 | Cumplido | Columnas generadas `VIRTUAL` y `uq_notification_event` cubren combinaciones nulas; el upsert no resetea `read_at` ni `created_at`. Pruebas: `notificationTests.js`. |
| P1-11 | Cumplido | Auditoria estricta dentro de la transaccion de cada accion critica; `audit_logs` es append-only mediante triggers verificados. No se requiere outbox porque no hay efectos auditables posteriores al commit. |
| P1-12 | Cumplido con residual | IDs invalidos devuelven 422/404; metadata batch debe ser un array de objetos no nulos; enlaces y firmas se validan. El batch rechaza el conjunto completo sin devolver errores por item. Pruebas: `materialTests.js`, `refinementTests.js`. |
| P1-13 | Cumplido con residual | Matriz de permisos y estados cubierta por pruebas de integracion (`refinementTests.js`, `securityTests.js`, `materialTests.js`, `subjectTests.js`). No se migro esa matriz a pruebas unitarias. |

## Verificacion ejecutada

- `npm run test:backend`: 29/29.
- `npm test`: 74/74.
- Migraciones `001`-`006` aplicadas y registradas en `schema_migrations`.
- Trigger append-only verificado: UPDATE sobre `audit_logs` devuelve `ER_SIGNAL_EXCEPTION audit_logs is append-only`.
- `npm run db:reconcile-files -- --dry-run`: 511 archivos escaneados, 37 referenciados, 473 huerfanos detectados en uploads de desarrollo/pruebas (no se borraron).
- `node --check` sobre los archivos JS modificados.

## Entorno de integracion

La suite requiere un servidor con `NODE_ENV=development` (testing no monta
`viewRoutes`), `EXPOSE_DEV_TOKENS=true`, `FILES_MODE=local` y rate limits altos:

```sh
cd backend
NODE_ENV=development EXPOSE_DEV_TOKENS=true FILES_MODE=local \
AUTH_IP_RATE_LIMIT=10000 AUTH_ACCOUNT_RATE_LIMIT=10000 \
AUTH_RECOVERY_RATE_LIMIT=10000 UPLOAD_RATE_LIMIT=10000 \
nohup npm start > /tmp/bibliotech-server.log 2>&1 &
```

## Riesgos residuales

- El reconciliador cubre almacenamiento local; no enumera ni elimina assets
  huerfanos en Cloudinary. Los assets Cloudinary siguen siendo accesibles si se
  conoce la URL publica.
- No hay pruebas automatizadas de contencion de locks ni inyeccion de fallos de
  base de datos; las garantias de rollback se apoyan en `db.transaction` y en
  las pruebas de estado de los flujos.
- La suite de integracion usa una base compartida y genera datos; requiere los
  limites de rate limit indicados.
- `NotificationService.markRead` con un ID inexistente devuelve exito.
- `ThematicTagService` no registra auditoria; las operaciones de etiquetas no
  forman parte del catalogo actual de acciones criticas.
- El batch de materiales valida y rechaza de forma atomica, pero no entrega un
  arreglo de errores por item.
