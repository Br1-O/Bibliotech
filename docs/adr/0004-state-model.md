# ADR 0004: Estado de material derivado de asociaciones y estado de UI local

- Estado: aceptado
- Fecha: 2026-11-06

## Contexto

Un material puede estar asociado a varias materias y cada asociacion tiene su
propio estado de aprobacion. El estado global del material y el estado por
materia se escribian en paralelo, lo que permitia combinaciones incoherentes:
un material `Aprobado` con una asociacion `Pendiente`, o un material
`Pendiente` ya visible en una materia.

En el frontend no existe un store global. Cada controlador de pagina mantiene
el estado de su vista y comparte solo sesion, idioma y tema.

## Decision

- `materials.estado` es el estado agregado del material. `Pendiente` significa
  que ninguna asociacion fue aprobada; `Aprobado` que al menos una lo fue;
  `Rechazado`/`Cancelado` son estados finales.
- `material_subjects.estado_aprobacion` es la fuente de verdad por materia.
- `MaterialPolicy` concentra las reglas de visibilidad, gestion, moderacion,
  cancelacion, asociacion y borrado global.
- Aprobar la primera asociacion marca el material como `Aprobado` y notifica.
- Rechazar la ultima asociacion de un material pendiente lo pasa a `Rechazado`.
- Un material en estado final no admite nuevas asociaciones.
- En el frontend, cada controlador posee su estado de pagina. `authHelper`
  persiste token/usuario en `localStorage`; `theme.js` y `LanguageManager`
  persisten solo preferencias. No se introduce un store global.

## Consecuencias

- Las transiciones de estado son verificables y no dependen de que cada
  controlador repita las reglas.
- El frontend sigue sin framework ni bundler; refrescar la pagina reconstruye
  el estado desde la API.
- Los permisos visuales del frontend pueden seguir divergiendo del backend;
  el backend es la autoridad final.

## Verificacion

`backend/tests/materialPolicy.test.js`, `backend/tests/materialServices.test.js`
y las pruebas de integracion de moderacion y seguridad.
