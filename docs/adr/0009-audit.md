# ADR 0009: Auditoria mediante servicio, outbox e intencion append-only

- Estado: aceptado
- Fecha: 2026-11-06

## Contexto

Las acciones criticas deben quedar registradas (RD-06). La version anterior
hacia escrituras best-effort dentro del request, sin reintentos, y la tabla
permitia modificaciones.

## Decision

- Todo cambio critico llama a `AuditLogService.record` o `recordMany` con una
  operacion del catalogo `AuditLog.OPERACIONES`.
- Si hay outbox disponible, el registro se encola con `immediate: true` y el
  worker lo persiste con reintentos e idempotencia (`idempotencyKey`).
- Sin outbox, el servicio escribe directamente en el repositorio.
- La auditoria incluye tipo de operacion, usuario, registro afectado, tipo de
  registro y timestamp.
- La aplicacion no expone endpoints de actualizacion o borrado de auditoria; el
  listado es paginado y de solo lectura.
- La inmutabilidad fuerte depende de permisos de base de datos; no se agrega un
  trigger de bloqueo en esta fase.

## Consecuencias

- Una accion de negocio puede completarse aunque el worker tarde en escribir la
  auditoria; el evento queda en outbox y se reintenta.
- Los logs de auditoria no se pierden por un fallo transitorio de base de datos.
- No hay politica de retencion ni archivo historico; el crecimiento debe
  monitorearse.
- Un administrador de base de datos con permisos de escritura aun puede alterar
  filas.

## Verificacion

`backend/tests/responseContract.test.js`, pruebas de integracion de auditoria y
revision de que los servicios criticos llaman a `AuditLogService`.
