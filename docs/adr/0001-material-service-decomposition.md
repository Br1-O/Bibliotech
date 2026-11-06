# ADR 0001: Descomponer MaterialService sin cambiar su contrato

- Estado: aceptado
- Fecha: 2026-11-05

## Contexto

`MaterialService` concentraba subida, deteccion de duplicados, moderacion,
asociacion a materias, edicion, borrado, catalogo, favoritos y acceso a
archivos. Tenia nueve dependencias y reglas de autorizacion duplicadas. Cambiar
un flujo obligaba a revisar un archivo de casi 800 lineas y las rutas dependian
de una unica clase.

## Decision

Mantener `backend/application/services/MaterialService.js` como fachada con la
misma firma de constructor y metodos publicos. La implementacion se divide en:

- `MaterialServiceContext`: dependencias comunes y helpers de validacion,
  ownership, notificaciones y archivos.
- `MaterialUploadService`: subida individual, sugerencias y carga masiva.
- `MaterialModerationService`: aprobacion, rechazo y bandejas pendientes.
- `MaterialAssociationService`: asociacion directa a materias.
- `MaterialManagementService`: edicion, cancelacion y borrado.
- `MaterialCatalogService`: lecturas y flags de usuario.
- `MaterialFavoriteService` y `MaterialAccessService`: favoritos y archivos.

Las reglas compartidas de estado y permisos viven en
`domain/policies/MaterialPolicy.js`.

## Consecuencias

- Rutas y contenedor no cambian; el riesgo de regresion se acota con pruebas.
- Cada flujo tiene dependencias explicitas y se puede probar por separado.
- La fachada sigue siendo el punto de entrada; no se introdujo un bus de casos
  de uso ni inyeccion por metodo.
- La autorizacion de material queda centralizada en la politica, aunque todavia
  existe duplicacion de permisos visuales en el frontend.

## Verificacion

`backend/tests/materialPolicy.test.js`, pruebas unitarias del backend y pruebas
de integracion de seguridad y carga masiva.
