const { getConfig } = require('../config/env');
const AppError = require('../utils/AppError');
const metrics = require('../utils/metrics');
const { createRateLimiter, clientIp, normalizeEmail } = require('./rateLimit');

function accountKey(req) {
    const email = normalizeEmail(req.body?.email);
    return email ? `account:${email}` : `ip:${clientIp(req)}`;
}

function loginRateLimit() {
    const config = getConfig().rateLimit;
    const ipLimiter = createRateLimiter({
        windowMs: config.authIpWindowMs,
        max: config.authIpMax,
        keyGenerator: req => `ip:${clientIp(req)}`,
        scope: 'login_ip'
    });

    const failures = new Map();
    const accountLimiter = (req, res, next) => {
        const key = accountKey(req);
        const now = Date.now();
        let entry = failures.get(key);
        if (!entry || now >= entry.resetAt) {
            entry = { count: 0, resetAt: now + config.authAccountWindowMs };
            failures.set(key, entry);
        }

        const remaining = Math.max(0, config.authAccountMax - entry.count);
        res.setHeader('RateLimit-Limit', String(config.authAccountMax));
        res.setHeader('RateLimit-Remaining', String(Math.max(0, remaining - 1)));
        res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

        if (entry.count >= config.authAccountMax) {
            const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
            res.setHeader('Retry-After', String(retryAfter));
            metrics.recordRateLimit('login_account');
            return next(new AppError('errors.tooManyRequests', {
                status: 429, params: { seconds: retryAfter }
            }));
        }

        res.on('finish', () => {
            if (res.statusCode === 401) entry.count += 1;
            else if (res.statusCode === 200) failures.delete(key);
        });
        return next();
    };

    accountLimiter.reset = () => failures.clear();
    return [ipLimiter, accountLimiter];
}

function recoveryRateLimit() {
    const config = getConfig().rateLimit;
    const ipLimiter = createRateLimiter({
        windowMs: config.recoveryWindowMs,
        max: config.recoveryMax,
        keyGenerator: req => `recovery:ip:${clientIp(req)}`,
        scope: 'recovery_ip'
    });
    const accountLimiter = createRateLimiter({
        windowMs: config.recoveryWindowMs,
        max: config.recoveryMax,
        keyGenerator: req => `recovery:${normalizeEmail(req.body?.email) || clientIp(req)}`,
        scope: 'recovery_account'
    });
    return [ipLimiter, accountLimiter];
}

module.exports = { loginRateLimit, recoveryRateLimit };
