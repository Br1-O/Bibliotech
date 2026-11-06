const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', 'routes');

const MOUNTS = [
    ['/api/auth', 'authRoutes.js'],
    ['/api', 'engagementRoutes.js'],
    ['/api/streaks', 'streakRoutes.js'],
    ['/api/careers', 'careerRoutes.js'],
    ['/api/subjects', 'subjectRoutes.js'],
    ['/api/materials', 'materialRoutes.js'],
    ['/api/subscriptions', 'subscriptionRoutes.js'],
    ['/api/notifications', 'notificationRoutes.js'],
    ['/api/audit', 'auditRoutes.js'],
    ['/api/thematic-tags', 'thematicTagsRoutes.js']
];

const METHOD_PATTERN = /router\.(get|post|put|patch|delete)\(\s*(?:\[\s*)?['"]([^'"]+)['"]/g;

function taggedRoutes() {
    const routes = [];
    for (const [prefix, file] of MOUNTS) {
        const source = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
        const defaultsToAuth = /router\.use\(\s*verifyToken\s*\)/.test(source);
        let match;
        METHOD_PATTERN.lastIndex = 0;
        while ((match = METHOD_PATTERN.exec(source))) {
            const method = match[1];
            const routePath = match[2];
            const suffix = prefix === '/api' ? routePath : routePath;
            const fullPath = (prefix + (suffix === '/' ? '' : suffix)).replace(/\/+$/, '') || '/';
            const lineEnd = source.indexOf('\n', match.index);
            const line = source.slice(match.index, lineEnd === -1 ? source.length : lineEnd);
            routes.push({
                method,
                path: fullPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}'),
                file,
                prefix,
                auth:
                    /verifyToken/.test(line) || defaultsToAuth
                        ? 'required'
                        : /optionalAuth/.test(line)
                          ? 'optional'
                          : 'public'
            });
        }
    }
    return routes;
}

const STATIC_ROUTES = [
    { method: 'get', path: '/healthz', file: 'server.js', prefix: '/', auth: 'public' },
    { method: 'get', path: '/readyz', file: 'server.js', prefix: '/', auth: 'public' },
    { method: 'get', path: '/metrics', file: 'server.js', prefix: '/', auth: 'public' }
];

function allRoutes() {
    return [...taggedRoutes(), ...STATIC_ROUTES];
}

module.exports = { MOUNTS, allRoutes, taggedRoutes, STATIC_ROUTES };
