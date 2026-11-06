# ADR 0003: Contrato HTTP descriptivo y puertas de CI

- Estado: aceptado
- Fecha: 2026-11-05
- Actualizado: 2026-11-06

## Contexto

La API no tenia contrato publicado, las respuestas de exito variaban y los
errores no siempre compartian forma. Las unicas pruebas automaticas eran de
integracion contra una base remota lenta, sin lint ni validacion del frontend.

## Decision

- Documentar todas las rutas de API y los endpoints de salud en
  `docs/openapi.yaml` (OpenAPI 3.0.3).
- Mantener el payload plano de exito por compatibilidad, agregando `requestId`
  a todas las respuestas JSON. Los errores conservan `message`, `code`,
  `requestId` y, cuando aplica, `errors`/`fields`.
- Exponer los materiales mediante `application/dto/materialDto.js`.
- Enforzar puertos con `backend/tests/repositoryPorts.test.js` y ofrecer
  `npm run test:contract` para formas de lectura contra MariaDB.
- Validar el contrato con `npm run check:openapi`: compara cada ruta de Express
  contra la especificacion, exige `operationId`, resuelve `$ref` y valida los
  ejemplos de request/response con Ajv.
- Ejecutar en CI `npm run test:ci`, que encadena lint, formato, OpenAPI,
  cobertura y chequeo de modulos del frontend.

## Consecuencias

- El contrato cubre todas las rutas y falla si se agrega una ruta sin
  documentarla.
- Los ejemplos se mantienen validos contra sus esquemas, aunque no hay
  validacion de requests en runtime.
- El envelope no es un wrapper `{data, meta}`; cambiarlo requeriria una version
  nueva de la API y tocar todos los clientes.
- La cobertura tiene umbrales bajos pero bloqueantes; deben subir con nuevas
  pruebas, no bajar.

## Verificacion

`.github/workflows/ci.yml` ejecuta `npm run test:ci` en Node 24. La suite
unitaria incluye DTO, respuesta, politica, servicios, puertos y contrato de
repositorios.
