/**
* Project     : Bibliotech
* Author      : Bruno O. Ortuno
* License     : http://www.gnu.org/licenses/gpl.txt  GNU GPL 3.0
* Date        : 2026
*
* Punto de entrada. Ensambla la arquitectura hexagonal:
*   Adaptadores de entrada (REST + navegacion) -> Servicios de aplicacion
*   -> Puertos de salida (repositorios) -> Adaptadores de infraestructura.
*/

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const { getConfig } = require('./config/env');
const db = require('./config/db');
const { buildContainer } = require('./infrastructure/container');
const requestContext = require('./middleware/requestContextMiddleware');
const languageMiddleware = require('./middleware/languageMiddleware');
const errorMiddleware = require('./middleware/errorMiddleware');
const metrics = require('./utils/metrics');
const { logger } = require('./utils/logger');
const { EmailDispatcher } = require('./infrastructure/mail/EmailDispatcher');

let config;
try {
    config = getConfig();
} catch (error) {
    console.error(error.message);
    throw error;
}

const container = buildContainer();
const app = express();
const uploadDir = path.join(__dirname, 'uploads');
const frontendDir = path.join(__dirname, '../frontend');
const imageFile = /\.(?:jpe?g|png|gif|webp)$/i;

let server = null;
let shuttingDown = false;

app.disable('x-powered-by');
app.set('trust proxy', config.security.trustProxy);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
            fontSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            upgradeInsecureRequests: config.isProduction ? [] : null
        }
    },
    crossOriginEmbedderPolicy: false,
    hsts: config.isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

const allowedOrigins = new Set(config.cors.origins);
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(null, false);
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Accept-Language', 'X-Language'],
    exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
    maxAge: 600
}));

app.use(requestContext);
app.use(express.json({ limit: config.security.bodyLimit, strict: true }));
app.use(express.urlencoded({ extended: true, limit: config.security.bodyLimit }));
app.use((req, res, next) => {
    req.setTimeout(config.security.requestTimeoutMs, () => {
        if (!res.headersSent) res.status(408).json({ message: req.t ? req.t('errors.requestTimeout') : 'Request timeout' });
    });
    next();
});
app.use(languageMiddleware(container));

app.get('/healthz', (req, res) => {
    res.status(shuttingDown ? 503 : 200).json({ status: shuttingDown ? 'shutting_down' : 'ok' });
});

app.get('/readyz', async (req, res) => {
    if (shuttingDown) return res.status(503).json({ status: 'shutting_down' });
    try {
        const healthy = await db.healthCheck();
        return res.status(healthy ? 200 : 503).json({ status: healthy ? 'ready' : 'unavailable' });
    } catch (error) {
        logger.error('health.ready_failed', { error });
        return res.status(503).json({ status: 'unavailable' });
    }
});

app.get('/metrics', (req, res) => {
    if (!config.logging.metricsEnabled) return res.status(404).end();
    if (config.isProduction && config.logging.metricsToken) {
        const authorization = String(req.headers.authorization || '');
        if (authorization !== `Bearer ${config.logging.metricsToken}`) {
            return res.status(401).end();
        }
    }
    const pool = db.poolStats();
    metrics.setGauge('db_pool_connections', { state: 'total' }, pool.all);
    metrics.setGauge('db_pool_connections', { state: 'free' }, pool.free);
    metrics.setGauge('db_pool_connections', { state: 'queued' }, pool.queued);
    metrics.setGauge('db_pool_connection_limit', {}, pool.limit);
    return res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8').send(metrics.toPrometheus());
});

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!imageFile.test(req.path)) return res.status(404).end();
    return next();
}, express.static(uploadDir, {
    index: false,
    dotfiles: 'deny',
    fallthrough: true,
    setHeaders: res => res.setHeader('Cache-Control', 'public, max-age=3600')
}));
app.use(express.static(frontendDir, {
    index: 'index.html',
    dotfiles: 'ignore',
    setHeaders: res => res.setHeader('X-Content-Type-Options', 'nosniff')
}));

app.use('/api/auth', require('./routes/authRoutes')(container));
app.use('/api', require('./routes/engagementRoutes')(container));
app.use('/api/streaks', require('./routes/streakRoutes')(container));
app.use('/api/careers', require('./routes/careerRoutes')(container));
app.use('/api/subjects', require('./routes/subjectRoutes')(container));
app.use('/api/materials', require('./routes/materialRoutes')(container));
app.use('/api/subscriptions', require('./routes/subscriptionRoutes')(container));
app.use('/api/notifications', require('./routes/notificationRoutes')(container));
app.use('/api/audit', require('./routes/auditRoutes')(container));
app.use('/api/thematic-tags', require('./routes/thematicTagsRoutes')(container));
app.use('/api', (req, res) => res.status(404).json({ message: req.t('errors.notFound') }));

if (config.isTest) {
    app.use('/', require('./routes/testsRoutes')());
} else {
    app.use('/', require('./routes/viewRoutes')(container));
}

app.use((req, res) => res.status(404).json({ message: req.t('errors.notFound') }));
app.use(errorMiddleware);

async function start() {
    if (server) return server;
    server = app.listen(config.port, () => {
        logger.info('server.started', { port: config.port, env: config.env });
    });
    server.requestTimeout = config.security.requestTimeoutMs;
    server.headersTimeout = config.security.requestTimeoutMs + 5000;
    db.warmPool().catch(error => logger.warn('db.pool_warm_failed', { error }));
    if (config.outbox.workerEnabled) {
        container.outboxWorker.start().catch(error => logger.error('outbox.worker_start_failed', { error }));
    }
    return server;
}

async function stop(signal = 'SIGTERM') {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('server.shutdown_started', { signal });

    const force = setTimeout(() => {
        logger.error('server.shutdown_timeout', { timeoutMs: config.security.shutdownTimeoutMs });
        process.exit(1);
    }, config.security.shutdownTimeoutMs);
    force.unref();

    try {
        await container.outboxWorker.stop().catch(error => logger.warn('outbox.worker_stop_failed', { error }));
        if (server) {
            await new Promise(resolve => server.close(resolve));
            if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
        }
        EmailDispatcher.closeAll();
        await db.close();
        logger.info('server.shutdown_complete');
    } finally {
        clearTimeout(force);
    }
}

if (require.main === module) {
    start().catch(error => {
        logger.error('server.start_failed', { error });
        process.exitCode = 1;
    });
    process.on('SIGTERM', () => stop('SIGTERM').then(() => process.exit(0)).catch(() => process.exit(1)));
    process.on('SIGINT', () => stop('SIGINT').then(() => process.exit(0)).catch(() => process.exit(1)));
}

if (process.env.EXPORT_SIMPLE_FOR_DEPLOY === "true") {
    module.exports = app;
} else {
    module.exports = { app, start, stop };
}