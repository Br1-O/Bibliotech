const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const { allRoutes } = require('./openApiRoutes');

const SPEC_PATH = path.join(__dirname, '..', '..', 'docs', 'openapi.yaml');

const TAG_BY_FILE = {
    'authRoutes.js': 'Auth',
    'materialRoutes.js': 'Materials',
    'careerRoutes.js': 'Careers',
    'subjectRoutes.js': 'Subjects',
    'engagementRoutes.js': 'Engagement',
    'streakRoutes.js': 'Streaks',
    'subscriptionRoutes.js': 'Subscriptions',
    'notificationRoutes.js': 'Notifications',
    'auditRoutes.js': 'Audit',
    'thematicTagsRoutes.js': 'ThematicTags',
    'server.js': 'Health'
};

const SUMMARIES = {
    'post /api/auth/register': 'Registra un alumno',
    'post /api/auth/verify-account': 'Verifica una cuenta con codigo',
    'get /api/auth/verify-account': 'Verifica una cuenta con codigo por query',
    'post /api/auth/activate': 'Activa una cuenta con token',
    'get /api/auth/activate/{token}': 'Activa una cuenta desde el enlace del correo',
    'post /api/auth/resend-verification': 'Reenvia el codigo de verificacion',
    'post /api/auth/logout': 'Cierra la sesion y elimina la cookie de archivos',
    'post /api/auth/forgot-password': 'Solicita el reseteo de clave',
    'get /api/auth/reset-password/{token}/validate': 'Valida un token de reseteo',
    'post /api/auth/reset-password': 'Restablece la clave con token',
    'get /api/auth/roles': 'Lista los roles disponibles',
    'put /api/auth/password': 'Cambia la clave del usuario autenticado',
    'post /api/auth/professors': 'Crea una cuenta de profesor (Superadmin)',
    'get /api/auth/users': 'Lista usuarios con filtros (Superadmin)',
    'put /api/auth/users/{id}/ban': 'Banea a un usuario (Superadmin)',
    'put /api/auth/users/{id}/unban': 'Desbanea a un usuario (Superadmin)',
    'put /api/auth/users/{id}/role': 'Cambia el rol de un usuario (Superadmin)',
    'delete /api/auth/users/{id}': 'Da de baja a un usuario (Superadmin)',
    'get /api/materials/author/{id}': 'Materiales publicados por un autor',
    'get /api/materials/pending': 'Sugerencias pendientes del usuario',
    'get /api/materials/pending-review': 'Bandeja de revision del profesor',
    'post /api/materials/batch': 'Carga masiva de materiales (Superadmin)',
    'put /api/materials/{id}': 'Actualiza un material',
    'delete /api/materials/{id}/subjects/{subjectId}': 'Quita un material de una materia',
    'get /api/careers': 'Lista carreras',
    'get /api/careers/{id}': 'Obtiene una carrera',
    'post /api/careers': 'Crea una carrera (Superadmin)',
    'put /api/careers/{id}': 'Actualiza una carrera (Superadmin)',
    'post /api/careers/{id}/years': 'Agrega un anio a una carrera (Superadmin)',
    'put /api/careers/years/{yearId}': 'Actualiza un anio (Superadmin)',
    'get /api/subjects': 'Lista materias',
    'get /api/subjects/{id}': 'Obtiene una materia',
    'get /api/subjects/{id}/materials': 'Materiales de una materia',
    'post /api/subjects': 'Crea una materia (Superadmin)',
    'post /api/subjects/{id}/request-association': 'Solicita asociar una materia (Profesor)',
    'post /api/subjects/{id}/confirm-association': 'Confirma una asociacion (Superadmin)',
    'post /api/subjects/{id}/reject-association': 'Rechaza una asociacion (Superadmin)',
    'put /api/subjects/{id}': 'Actualiza una materia (Superadmin)',
    'get /api/profile/{id}': 'Perfil publico de un usuario',
    'get /api/users/{id}/favorites': 'Favoritos de un usuario',
    'get /api/users/{id}/uploads': 'Subidas de un usuario',
    'get /api/users/{id}/reads': 'Lecturas de un usuario',
    'get /api/users/{id}/backlog': 'Pendientes de lectura de un usuario',
    'put /api/profile': 'Actualiza el perfil propio',
    'get /api/profile-pictures': 'Lista avatares disponibles',
    'get /api/reads': 'Lista las lecturas propias',
    'get /api/reads/{materialId}': 'Obtiene el progreso de lectura',
    'post /api/reads/{materialId}/toggle': 'Marca o desmarca una lectura',
    'put /api/reads/{materialId}/progress': 'Actualiza el progreso de lectura',
    'get /api/backlog': 'Lista los pendientes de lectura',
    'post /api/backlog/{materialId}': 'Agrega un material a pendientes',
    'delete /api/backlog/{materialId}': 'Quita un material de pendientes',
    'post /api/subscriptions/{userId}': 'Sigue a un autor',
    'delete /api/subscriptions/{userId}': 'Deja de seguir a un autor',
    'get /api/streaks': 'Consulta la racha de lectura',
    'post /api/streaks/heartbeat': 'Registra actividad de lectura',
    'post /api/streaks/reset': 'Reinicia la racha',
    'get /api/subscriptions/mine': 'Lista las suscripciones propias',
    'post /api/subscriptions/subscribe/{subjectId}': 'Se suscribe a una materia',
    'delete /api/subscriptions/subscribe/{subjectId}': 'Cancela la suscripcion a una materia',
    'get /api/subscriptions/subject/{subjectId}/observers': 'Lista observadores de una materia',
    'post /api/subscriptions/ban/{alumnoId}/{subjectId}': 'Banea a un alumno de una materia',
    'get /api/notifications': 'Lista notificaciones',
    'post /api/notifications/read-all': 'Marca todas las notificaciones como leidas',
    'post /api/notifications/{id}/read': 'Marca una notificacion como leida',
    'get /api/audit': 'Consulta la auditoria (Superadmin)',
    'get /api/audit/user/{id}': 'Consulta la auditoria de un usuario (Superadmin)',
    'get /api/thematic-tags': 'Lista etiquetas tematicas',
    'post /api/thematic-tags': 'Crea una etiqueta tematica',
    'put /api/thematic-tags/{id}/ban': 'Banea una etiqueta (Superadmin)',
    'delete /api/thematic-tags/{id}': 'Elimina una etiqueta (Superadmin)',
    'get /healthz': 'Comprueba que el proceso responde',
    'get /readyz': 'Comprueba la disponibilidad de la base de datos',
    'get /metrics': 'Expone metricas Prometheus'
};

function operationId(method, routePath) {
    return (
        method +
        routePath
            .split('/')
            .filter(Boolean)
            .map((part) =>
                part.replace(/[{}]/g, '').replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
            )
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join('')
    );
}

function pathParameters(routePath) {
    return [...routePath.matchAll(/\{([^}]+)\}/g)].map((match) => ({
        name: match[1],
        in: 'path',
        required: true,
        schema: match[1] === 'token' ? { type: 'string' } : { type: 'integer', minimum: 1 }
    }));
}

const DETAILED_OPERATIONS = new Set([
    'post /api/auth/login',
    'get /api/auth/me',
    'get /api/materials/global',
    'get /api/materials/filters',
    'get /api/materials/mine',
    'post /api/materials/upload',
    'get /api/materials/{id}/file',
    'get /api/materials/{id}/download',
    'post /api/materials/{id}/favorite',
    'get /api/materials/favorites/mine',
    'post /api/materials/{id}/approve',
    'post /api/materials/{id}/reject',
    'post /api/materials/{id}/associate',
    'post /api/materials/{id}/cancel',
    'delete /api/materials/{id}'
]);

function securityFor(route) {
    if (route.auth === 'required') return [{ bearerAuth: [] }];
    if (route.auth === 'optional') return [{ bearerAuth: [] }, {}];
    return [];
}

function generatedOperation(route) {
    const tag = TAG_BY_FILE[route.file] || 'General';
    const key = `${route.method} ${route.path}`;
    const success = route.method === 'post' ? '200' : '200';
    const operation = {
        tags: [tag],
        summary: SUMMARIES[key] || `${route.method.toUpperCase()} ${route.path}`,
        operationId: operationId(route.method, route.path),
        security: securityFor(route),
        parameters: pathParameters(route.path)
    };
    if (!operation.parameters.length) delete operation.parameters;

    if (['post', 'put', 'patch'].includes(route.method) && !key.includes('/materials/upload')) {
        operation.requestBody = {
            required: false,
            content: {
                'application/json': {
                    schema: { type: 'object', additionalProperties: true }
                }
            }
        };
    }

    const response = { description: 'Operacion correcta' };
    if (route.path === '/metrics') {
        response.content = { 'text/plain': { schema: { type: 'string' } } };
    } else if (route.path === '/healthz' || route.path === '/readyz') {
        response.content = {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: { status: { type: 'string' } }
                }
            }
        };
    } else {
        response.content = {
            'application/json': {
                schema: { type: 'object', additionalProperties: true }
            }
        };
    }
    operation.responses = { [success]: response };
    if (route.auth === 'required') operation.responses['401'] = { $ref: '#/components/responses/Unauthorized' };
    operation.responses['400'] = { $ref: '#/components/responses/BadRequest' };
    if (route.method !== 'get' && route.path !== '/metrics') {
        operation.responses['422'] = { $ref: '#/components/responses/UnprocessableEntity' };
    }
    return operation;
}

function resolveRef(ref, spec) {
    if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref: ${ref}`);
    return ref
        .slice(2)
        .split('/')
        .reduce((node, part) => node[part.replace(/~1/g, '/').replace(/~0/g, '~')], spec);
}

function sample(schema, spec, seen = new Set()) {
    if (!schema || typeof schema !== 'object') return null;
    if (schema.$ref) {
        if (seen.has(schema.$ref)) return null;
        return sample(resolveRef(schema.$ref, spec), spec, new Set([...seen, schema.$ref]));
    }
    if (schema.oneOf?.length) return sample(schema.oneOf[0], spec, seen);
    if (schema.anyOf?.length) return sample(schema.anyOf[0], spec, seen);
    if (schema.allOf?.length) {
        return schema.allOf.reduce((result, part) => {
            const value = sample(part, spec, seen);
            return value && typeof value === 'object' && !Array.isArray(value) ? { ...result, ...value } : result;
        }, {});
    }
    if (schema.enum?.length) return schema.enum[0];
    if (schema.type === 'array') return [sample(schema.items || {}, spec, seen)];
    if (schema.type === 'object' || schema.properties) {
        const result = {};
        for (const [key, prop] of Object.entries(schema.properties || {})) {
            if (prop.format === 'binary') continue;
            const value = sample(prop, spec, seen);
            if (value !== null && value !== undefined) result[key] = value;
        }
        return result;
    }
    if (schema.type === 'integer' || schema.type === 'number') return schema.minimum ?? 1;
    if (schema.type === 'boolean') return true;
    if (schema.type === 'string') {
        if (schema.format === 'email') return 'user@example.com';
        if (schema.format === 'date-time') return '2026-01-01T00:00:00.000Z';
        if (schema.format === 'uri') return 'https://example.com/recurso';
        if (schema.format === 'password') return 'Password123';
        return 'string';
    }
    return {};
}

function addExamples(node, spec, location = '') {
    if (!node || typeof node !== 'object') return;
    if (node.content && !Array.isArray(node.content)) {
        for (const media of Object.values(node.content)) {
            if (media?.schema && !media.example && !media.examples) {
                const value = sample(media.schema, spec);
                if (value !== null && value !== undefined) media.example = value;
            }
        }
    }
    for (const [key, value] of Object.entries(node)) {
        if (key === 'examples') continue;
        addExamples(value, spec, `${location}/${key}`);
    }
}

function main() {
    const spec = YAML.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
    spec.tags = spec.tags || [];
    const knownTags = new Set(spec.tags.map((tag) => tag.name));
    for (const name of Object.values(TAG_BY_FILE)) {
        if (!knownTags.has(name)) {
            spec.tags.push({ name });
            knownTags.add(name);
        }
    }

    const existing = new Set();
    for (const [routePath, pathItem] of Object.entries(spec.paths || {})) {
        for (const method of Object.keys(pathItem || {})) existing.add(`${method} ${routePath}`);
    }

    for (const route of allRoutes()) {
        spec.paths[route.path] = spec.paths[route.path] || {};
        if (!spec.paths[route.path][route.method]) {
            spec.paths[route.path][route.method] = generatedOperation(route);
        }
    }

    for (const route of allRoutes()) {
        const key = `${route.method} ${route.path}`;
        const operation = spec.paths[route.path]?.[route.method];
        if (!operation) continue;
        if (!operation.operationId) operation.operationId = operationId(route.method, route.path);
        if (!DETAILED_OPERATIONS.has(key)) {
            operation['x-generated'] = true;
            operation.security = securityFor(route);
        }
    }

    addExamples(spec.paths, spec);
    addExamples(spec.components, spec);

    fs.writeFileSync(SPEC_PATH, YAML.stringify(spec));
    console.log(`OpenAPI regenerated: ${Object.keys(spec.paths).length} paths`);
}

main();
