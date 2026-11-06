# ADR 0008: Almacenamiento local o Cloudinary segun el entorno

- Estado: aceptado
- Fecha: 2026-11-06

## Contexto

El desarrollo local no debe depender de un servicio externo, pero un despliegue
serverless no tiene disco persistente. Los materiales incluyen PDF, EPUB,
documentos, presentaciones y portadas de imagen.

## Decision

- `FILES_MODE=local` guarda en `backend/uploads` con Multer. Es el modo por
  defecto en desarrollo.
- `FILES_MODE=cloud` usa Cloudinary con `resource_type` segun el archivo
  (`raw` para PDF/EPUB, `image` para portadas, `auto` para documentos).
- El hash SHA-256 se calcula mientras se transmite el archivo para detectar
  duplicados, tambien en modo Cloudinary.
- La base guarda la ruta o URL; el tipo de material indica si es archivo o
  enlace externo.
- Los archivos aprobados son publicos; los pendientes usan la politica de
  acceso. `/file` y `/download` transmiten con soporte de `Range`.
- La eliminacion de archivos ignora URLs externas y solo borra uploads locales o
  activos Cloudinary conocidos.
- No se agrega antivirus/escaneo de malware en esta fase.

## Consecuencias

- El mismo contrato de material funciona en local y en la nube.
- Cloudinary requiere credenciales y ancho de banda; los archivos `raw` no se
  sirven mediante transformaciones de imagen.
- La eliminacion es best-effort: un fallo se registra y no revierte la fila.
- El escaneo de malware sigue siendo un riesgo residual documentado.

## Verificacion

`backend/tests/fileHelper.test.js`, `backend/tests/materialFile.test.js` y las
pruebas de integracion de subida, descarga y carga masiva.
