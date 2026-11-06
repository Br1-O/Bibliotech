# ADR 0006: Transacciones por caso de uso con AsyncLocalStorage

- Estado: aceptado
- Fecha: 2026-11-06

## Contexto

Subida, carga masiva, moderacion, asociacion y registro escriben varias tablas.
Sin un limite transaccional quedaban filas huerfanas, asociaciones parciales y
contadores desviados.

## Decision

- `backend/config/db.js` expone `db.transaction(callback)`.
- El contexto de la transaccion se guarda en `AsyncLocalStorage`. Las llamadas
  anidadas a `db.transaction` reutilizan la misma conexion en lugar de abrir otra.
- `db.execute` y `db.query` usan la conexion activa del contexto; fuera de una
  transaccion usan el pool.
- Los servicios abren una transaccion por caso de uso. Los repositorios no
  abren transacciones propias.
- `afterCommit` registra efectos que solo deben ejecutarse tras el commit.
- Los archivos se eliminan fuera de la transaccion, despues del commit, para no
  borrar contenido que luego se revierte.
- Las notificaciones y la auditoria usan la outbox para no depender de una
  escritura sincronica adicional dentro del camino critico.

## Consecuencias

- Un fallo en cualquier paso revierte las escrituras de la misma transaccion.
- El callback debe usar solo repositorios, no servicios que abran transacciones
  independientes fuera del contexto.
- Las operaciones de red (SMTP, Cloudinary) no deben ejecutarse dentro de la
  transaccion.
- El borrado de archivos y el envio de correo son efectos posteriores con sus
  propios reintentos o registro de fallo.

## Verificacion

Pruebas de subida, carga masiva, moderacion, asociacion y registro; pruebas de
integracion de `Carga masiva` y seguridad; `npm run test:contract`.
