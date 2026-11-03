# Bibliotech

**Bibliotech** es un sistema de gestion de material educativo y aulas virtuales. Permite administrar usuarios y roles, crear materias (que funcionan como categorias de agrupacion transversales), subir y compartir material educativo etiquetado por palabras clave, suscribir alumnos mediante el patron **Observer**, moderar contenido sugerido y auditar cada accion critica del sistema.

El proyecto esta construido con **Arquitectura Hexagonal** estricta: el dominio de negocio es independiente de la base de datos, el framework web y la interfaz. La persistencia se resuelve mediante el **patron Repository** sobre interfaces (puertos), de modo que el motor de base de datos puede intercambiarse (MariaDB / MongoDB) sin tocar las reglas de negocio.

---

## Caracteristicas principales

- **Gestion de usuarios, roles y autenticacion** con JWT + BCrypt y recuperacion de contrasena por token temporal.
- **Materias** como categorias de agrupacion asociadas a profesores (con confirmacion del superadministrador).
- **Vista general global** de todo el contenido con busqueda transversal y filtrado por materias y etiquetas tematicas.
- **Suscripcion de alumnos** a materias mediante el patron **Observer** (la materia es el sujeto observable; los alumnos, observadores).
- **Material educativo** con control de unicidad por **hash** y asociacion a multiples materias simultaneas.
- **Moderacion y baneo** de alumnos por parte de los profesores titulares.
- **Validacion multilenguaje** orientada al modelo de negocio (modulo Filter/Validator) con mensajes localizados.
- **Registro de auditoria (Log)** inalterable para acciones criticas.

## Tecnologias

### Backend
- **Node.js + Express**: servidor y API REST.
- **MySQL / MariaDB** via `mysql2`: persistencia relacional (adaptador intercambiable).
- **Multer**: subida de archivos binarios.
- **JWT + BCrypt**: sesiones seguras y hashing irreversible de contrasenas.

### Frontend
- **JavaScript Vanilla**: sin frameworks; manipulacion del DOM nativa (zero `innerHTML`).
- **W3.CSS**: utilidades de layout responsivo.
- **CSS con variables**: sistema de diseno facilmente re-tematizable.
- **Web Components nativos**: navbar, tarjetas, botones, loader, modales y notificaciones reutilizables.
- **i18n propio**: `LanguageManager` con locales `es` / `en` para contenido y validaciones.

## Arquitectura

```text
backend/
├── config/            # Conexion a DB, init.sql, configuracion de Multer.
├── domain/
│   ├── entities/      # Entidades puras de negocio (User, Role, Subject, Material, ...).
│   ├── ports/         # Interfaces de repositorios (puertos de salida).
│   └── observers/     # Patron Observer (materia observable / alumno observador).
├── application/
│   └── services/      # Casos de uso (AuthService, SubjectService, ...).
├── infrastructure/
│   └── repositories/  # Adaptadores concretos (MariaDB), inyeccion de dependencias.
├── validator/         # Modulo Filter/Validator multilenguaje + locales.
├── controllers/       # Adaptadores de entrada (REST).
├── middleware/        # Autenticacion y autorizacion por rol.
├── routes/            # Definicion de endpoints y navegacion del frontend.
├── utils/             # Helpers (hash de archivos, manejo de filesystem).
└── server.js          # Punto de entrada.

frontend/
├── css/               # Sistema de diseno modular (shared/, components/, pages/).
├── html/              # Pantallas.
├── js/
│   ├── components/    # Componentes de UI reutilizables.
│   ├── frontControllers/  # Controladores de las pantallas.
│   ├── services/      # Cliente HTTP centralizado.
│   ├── i18n/          # LanguageManager + locales.
│   └── utils/         # Sesion, helpers, observers.
```

## Puesta en marcha

1. **Base de datos**: `init.sql` es no destructivo para bases existentes.
   ```bash
   # Base nueva (esquema + datos de referencia)
   mysql -u root -p < backend/config/init.sql

   # Base existente: aplica migraciones ordenadas
   cd backend && npm run db:migrate

   # Solo desarrollo: reinicio destructivo + cuentas demo
   cd backend/config && mysql -u root -p < reset_dev.sql
   ```

2. **Variables de entorno**: crear `backend/.env` a partir de `.env.example`.
   ```bash
   cp backend/.env.example backend/.env
   ```
   `JWT_SECRET` debe tener al menos 32 caracteres y 128 bits de entropia.
   En produccion `CORS_ORIGINS` es obligatorio y `EXPOSE_DEV_TOKENS=false`.

3. **Backend**:
   ```bash
   cd backend
   npm install
   npm start
   ```

4. Abrir `http://localhost:3000`.

### Operacion y seguridad

- `GET /healthz`: liveness. `GET /readyz`: readiness con `SELECT 1` a la base.
- `GET /metrics`: metricas Prometheus; en produccion requiere `METRICS_TOKEN`.
- `/uploads` solo sirve imagenes publicas. Los materiales aprobados se abren
  con `GET /api/materials/:id/file` y se descargan con `.../download`; los
  pendientes o no aprobados exigen sesion del autor o staff. El login deja una
  cookie `HttpOnly` de archivos con alcance `/api`, y el visor usa peticiones
  `Range` para paginar PDFs sin descargarlos completos.
- El servidor cierra ordenadamente con `SIGTERM`/`SIGINT` y drena la base.
- Las cuentas demo de `seed_dev.sql` nunca deben cargarse en produccion.

### Credenciales de prueba

| Rol          | Email                    | Contrasena |
| ------------ | ------------------------ | ---------- |
| Superadmin   | `admin@bibliotech.edu`   | `Admin123` |
| Profesor     | `profesor@bibliotech.edu`| `Profesor123` |
| Alumno       | `alumno@bibliotech.edu`  | `Alumno123` |

## Pruebas

La suite de pruebas de la API vive en `frontend/js/tests/` y se ejecuta desde la
pantalla `http://localhost:3000/tests` (o `http://localhost:3000/` con
`NODE_ENV=testing`). Cubre RF-01 a RF-05, perfil/gamificacion, validacion
multilenguaje (RNF-06) y seguridad (inyeccion SQL).

| Archivo             | Cobertura                                             |
| ------------------- | ----------------------------------------------------- |
| `testUtils.js`      | Utilidades, cliente HTTP, aserciones y runner headless.|
| `authTests.js`      | Registro, login, perfil, roles e i18n de mensajes.     |
| `subjectTests.js`   | Materias y asociacion de profesores (RF-02).           |
| `materialTests.js`  | Subida, hash, vista global, moderacion y borrado.      |
| `subscriptionTests.js` | Suscripcion (Observer) y baneo (RF-03 / RF-05).     |
| `adminTests.js`     | Usuarios, auditoria y recuperacion de contrasena.      |
| `gamificationTests.js` | Perfil publico, rango/foto, lectura XP, backlog con auto-completado, rachas y seguidores. |
| `refinementTests.js` | Cargas masivas, permisos, cancelacion/rechazo y portadas. |
| `securityTests.js`  | DTOs publicos, revocacion, ownership y descargas seguras. |
| `sqlTests.js`       | Intentos de inyeccion SQL.                             |

Para correrla sin navegador, levantar el servidor en modo desarrollo con
tokens de prueba y limites altos (la suite crea muchos usuarios desde la misma IP):

```bash
cd backend
NODE_ENV=development EXPOSE_DEV_TOKENS=true FILES_MODE=local \
  AUTH_IP_RATE_LIMIT=10000 AUTH_ACCOUNT_RATE_LIMIT=10000 \
  AUTH_RECOVERY_RATE_LIMIT=10000 UPLOAD_RATE_LIMIT=10000 npm start
# En otra terminal, desde la raiz del proyecto:
node frontend/js/tests/runNode.js
# Filtrar por nombre de prueba:
BT_TEST_FILTER='Test Seguridad' node frontend/js/tests/runNode.js
```

Pruebas unitarias del backend (no requieren servidor):

```bash
cd backend
npm run test:backend
```

Presupuesto de rendimiento de consultas calientes (requiere base de datos):

```bash
cd backend
npm run test:perf
```

## Roles

- **Superadmin**: crea cuentas de profesor, materias y roles; confirma asociaciones.
- **Profesor**: administra el contenido de sus materias, aprueba material sugerido y modera el acceso.
- **Alumno**: se suscribe a materias, consulta el catalogo y sugiere material (maximo 3 pendientes).
- **Visitante**: lectura publica del catalogo global y de las materias.

## Licencia

GNU GPL 3.0. Ver `LICENSE`.
