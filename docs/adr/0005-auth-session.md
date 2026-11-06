# ADR 0005: JWT de corta duracion y cookie de archivos HttpOnly

- Estado: aceptado
- Fecha: 2026-11-06

## Contexto

La API se consume desde el mismo origen que sirve el frontend. El visor de PDF
abre `/api/materials/:id/file` en un iframe, donde no se puede adjuntar el header
`Authorization`. A la vez, guardar el JWT en una cookie de sesion amplia
aumentaria la superficie CSRF.

## Decision

- El login emite un JWT firmado con `issuer`, `audience`, algoritmo y expiracion
  configurados. El token incluye `id`, `role` y `ver`.
- El frontend guarda el JWT en `localStorage` y lo envia como
  `Authorization: Bearer`.
- Las rutas de archivo aceptan tambien la cookie HttpOnly `bt_file_access`,
  `SameSite=Lax`, `Secure` cuando la peticion es HTTPS y `Path=/api`. Se emite en
  login y en peticiones autenticadas, y se limpia en logout.
- `verifyToken` valida firma, expiracion, emisor, audiencia, usuario activo,
  `tokenVersion` y rol actual. Banear, desactivar o cambiar el rol invalida los
  tokens anteriores al incrementar `tokenVersion`.
- Las rutas de archivo resuelven el usuario de forma perezosa: un material
  aprobado se sirve sin autenticar y no consulta `users`.
- No hay refresh tokens ni sesiones en servidor; la reautenticacion es login.

## Consecuencias

- El iframe de PDF funciona sin exponer el token en la URL.
- El JWT en `localStorage` sigue siendo legible ante XSS; la cookie de archivos
  no se usa para mutaciones.
- Cambiar rol o banear exige incrementar `tokenVersion`; el flujo esta cubierto
  por `AuthService`.
- Multiples instancias comparten el secreto configurado; no hay estado de sesion
  que replicar.

## Verificacion

`backend/tests/authService.test.js`, `backend/tests/materialPolicy.test.js` y
las pruebas de integracion de login, logout, archivos y seguridad.
