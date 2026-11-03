const AppError = require('../utils/AppError');
const metrics = require('../utils/metrics');

function createRateLimiter({
    windowMs,
    max,
    keyGenerator,
    scope,
    skip = null,
    messageKey = 'errors.tooManyRequests'
}) {
    const store = new Map();

    const middleware = (req, res, next) => {
        if (skip && skip(req)) return next();
        const key = String(keyGenerator(req) || req.ip || 'unknown');
        const now = Date.now();
        let entry = store.get(key);
        if (!entry || now >= entry.resetAt) {
            entry = { count: 0, resetAt: now + windowMs };
            store.set(key, entry);
        }

        const remaining = Math.max(0, max - entry.count);
        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(Math.max(0, remaining - 1)));
        res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

        if (entry.count >= max) {
            const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
            res.setHeader('Retry-After', String(retryAfter));
            metrics.recordRateLimit(scope);
            return next(new AppError(messageKey, { status: 429, params: { seconds: retryAfter } }));
        }

        entry.count += 1;
        return next();
    };

    middleware.reset = () => store.clear();
    middleware.store = store;
    return middleware;
}

function clientIp(req) {
    return req.ip || req.socket?.remoteAddress || 'unknown';
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase().slice(0, 254);
}

module.exports = { createRateLimiter, clientIp, normalizeEmail };
