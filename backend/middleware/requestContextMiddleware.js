const crypto = require('crypto');
const { logger } = require('../utils/logger');
const metrics = require('../utils/metrics');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function requestContext(req, res, next) {
    const incoming = String(req.headers['x-request-id'] || '').trim();
    req.id = REQUEST_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    req.log = logger.child({ requestId: req.id });
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        const route = req.route?.path
            ? `${req.baseUrl || ''}${req.route.path}`
            : 'unmatched';
        const fields = {
            method: req.method,
            route,
            status: res.statusCode,
            durationMs: Math.round(durationMs * 100) / 100,
            userId: req.usuarioId || null
        };
        metrics.recordHttp(fields);
        if (res.statusCode === 401) metrics.recordSecurityEvent('auth_failure', route);
        else if (res.statusCode === 403) metrics.recordSecurityEvent('permission_denied', route);
        else if (res.statusCode === 429) metrics.recordSecurityEvent('rate_limited', route);
        else if (res.statusCode >= 500) metrics.recordSecurityEvent('server_error', route);
        if (res.statusCode >= 500) req.log.error('http.request', fields);
        else if (res.statusCode >= 400) req.log.warn('http.request', fields);
        else req.log.info('http.request', fields);
    });

    next();
}

module.exports = requestContext;
