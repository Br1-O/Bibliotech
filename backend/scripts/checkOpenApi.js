const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const Ajv = require('ajv');
const { allRoutes } = require('./openApiRoutes');

const SPEC_PATH = path.join(__dirname, '..', '..', 'docs', 'openapi.yaml');
const JSON_SPEC_PATH = path.join(__dirname, '..', '..', 'docs', 'openapi.json');
const spec = YAML.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
const errors = [];

try {
    const jsonSpec = JSON.parse(fs.readFileSync(JSON_SPEC_PATH, 'utf8'));
    if (JSON.stringify(jsonSpec) !== JSON.stringify(spec)) {
        errors.push('docs/openapi.json is stale; run npm run generate:openapi');
    }
} catch (error) {
    errors.push('docs/openapi.json is missing or invalid; run npm run generate:openapi');
}

function resolveRef(ref) {
    if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref: ${ref}`);
    let node = spec;
    for (const part of ref.slice(2).split('/')) {
        node = node?.[part.replace(/~1/g, '/').replace(/~0/g, '~')];
        if (node === undefined) throw new Error(`Unresolved $ref: ${ref}`);
    }
    return node;
}

function checkRefs(node, location = 'spec') {
    if (!node || typeof node !== 'object') return;
    if (typeof node.$ref === 'string') {
        try {
            resolveRef(node.$ref);
        } catch (error) {
            errors.push(`${location}: ${error.message}`);
        }
    }
    for (const [key, value] of Object.entries(node)) checkRefs(value, `${location}/${key}`);
}

function dereference(schema, seen = new Set()) {
    if (!schema || typeof schema !== 'object') return schema;
    if (schema.$ref) {
        if (seen.has(schema.$ref)) return {};
        return dereference(resolveRef(schema.$ref), new Set([...seen, schema.$ref]));
    }
    if (Array.isArray(schema)) return schema.map((item) => dereference(item, seen));
    const result = {};
    for (const [key, value] of Object.entries(schema)) {
        if (['example', 'examples', 'nullable', 'xml', 'discriminator', 'deprecated', 'externalDocs'].includes(key)) {
            continue;
        }
        result[key] = dereference(value, seen);
    }
    return result;
}

function validateExamples(node, location) {
    if (!node || typeof node !== 'object') return;
    if (node.content && !Array.isArray(node.content)) {
        for (const [mediaType, media] of Object.entries(node.content)) {
            if (!media?.schema) continue;
            if (media.example === undefined) {
                errors.push(`${location} ${mediaType}: missing example`);
                continue;
            }
            if (mediaType !== 'application/json') continue;
            const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
            let validate;
            try {
                validate = ajv.compile(dereference(media.schema));
            } catch (error) {
                errors.push(`${location} ${mediaType}: invalid schema (${error.message})`);
                continue;
            }
            if (!validate(media.example)) {
                errors.push(`${location} ${mediaType}: example invalid (${ajv.errorsText(validate.errors)})`);
            }
        }
    }
    for (const [key, value] of Object.entries(node)) {
        if (key === 'examples') continue;
        validateExamples(value, `${location}/${key}`);
    }
}

checkRefs(spec);
validateExamples(spec.components, 'components');

const specRoutes = new Set();
const operationIds = new Set();
for (const [routePath, pathItem] of Object.entries(spec.paths || {})) {
    if (!routePath.startsWith('/api/') && !['/healthz', '/readyz', '/metrics'].includes(routePath)) {
        errors.push(`Unexpected non-API path in spec: ${routePath}`);
    }
    const declaredParams = [...routePath.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();
    for (const [method, operation] of Object.entries(pathItem || {})) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        specRoutes.add(`${method} ${routePath}`);
        if (!operation.operationId) {
            errors.push(`${method.toUpperCase()} ${routePath}: missing operationId`);
        } else if (operationIds.has(operation.operationId)) {
            errors.push(`${method.toUpperCase()} ${routePath}: duplicate operationId ${operation.operationId}`);
        } else {
            operationIds.add(operation.operationId);
        }
        const parameterNames = (operation.parameters || [])
            .map((parameter) => (parameter.$ref ? resolveRef(parameter.$ref) : parameter))
            .filter((parameter) => parameter.in === 'path')
            .map((parameter) => parameter.name)
            .sort();
        if (JSON.stringify(parameterNames) !== JSON.stringify(declaredParams)) {
            errors.push(
                `${method.toUpperCase()} ${routePath}: path parameters ${declaredParams.join(',')} != ${parameterNames.join(',')}`
            );
        }
        const route = allRoutes().find((candidate) => candidate.method === method && candidate.path === routePath);
        if (route) {
            const security = operation.security !== undefined ? operation.security : spec.security || [];
            if (route.auth === 'required' && !security.some((scheme) => scheme.bearerAuth)) {
                errors.push(`${method.toUpperCase()} ${routePath}: missing bearerAuth security`);
            }
            if (route.auth === 'optional' && !security.some((scheme) => Object.keys(scheme).length === 0)) {
                errors.push(`${method.toUpperCase()} ${routePath}: optional auth must allow anonymous access`);
            }
        }
        const success = Object.keys(operation.responses || {}).find((status) => /^2\d\d$/.test(status));
        if (!success) errors.push(`${method.toUpperCase()} ${routePath}: missing 2xx response`);
        validateExamples(operation, `${method.toUpperCase()} ${routePath}`);
    }
}

for (const route of allRoutes()) {
    if (!specRoutes.has(`${route.method} ${route.path}`)) {
        errors.push(`Missing OpenAPI operation: ${route.method.toUpperCase()} ${route.path} (${route.file})`);
    }
}

for (const route of specRoutes) {
    const [method, routePath] = route.split(' ');
    if (!allRoutes().some((candidate) => candidate.method === method && candidate.path === routePath)) {
        errors.push(`OpenAPI operation has no route: ${method.toUpperCase()} ${routePath}`);
    }
}

if (errors.length) {
    console.error(`OpenAPI check failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(` - ${error}`);
    process.exit(1);
}

console.log(`OpenAPI check passed: ${specRoutes.size} operations, all route paths covered and examples valid`);
