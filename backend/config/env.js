const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const FALLBACK_SECRETS = new Set([
    'tu_clave_secreta_super_segura',
    'cambia_esta_clave_secreta_super_segura',
    'change-me',
    'changeme',
    'secret',
    'jwt-secret'
]);

const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'];
const FILE_MODES = ['local', 'cloud'];

function parseBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseInteger(value, fallback, { min = null, max = null, name = 'value' } = {}) {
    if (value === undefined || value === null || value === '') return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || (min !== null && number < min) || (max !== null && number > max)) {
        throw new Error(`${name} must be an integer between ${min ?? '-inf'} and ${max ?? 'inf'}`);
    }
    return number;
}

function parseList(value) {
    return String(value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

function estimateEntropyBits(value) {
    const text = String(value || '');
    if (!text.length) return 0;
    const counts = new Map();
    for (const char of text) counts.set(char, (counts.get(char) || 0) + 1);
    let entropyPerChar = 0;
    for (const count of counts.values()) {
        const probability = count / text.length;
        entropyPerChar -= probability * Math.log2(probability);
    }
    return entropyPerChar * text.length;
}

function validateJwtSecret(secret, errors) {
    const value = String(secret || '');
    if (!value) {
        errors.push('JWT_SECRET is required');
        return;
    }
    if (FALLBACK_SECRETS.has(value.toLowerCase())) {
        errors.push('JWT_SECRET must not use a known or default value');
    }
    if (value.length < 32) {
        errors.push('JWT_SECRET must contain at least 32 characters');
    }
    if (estimateEntropyBits(value) < 128) {
        errors.push('JWT_SECRET must provide at least 128 bits of estimated entropy');
    }
}

function validateOrigin(origin, errors) {
    if (origin === '*') {
        errors.push('CORS_ORIGINS must not contain a wildcard');
        return false;
    }
    try {
        const url = new URL(origin);
        if (!['http:', 'https:'].includes(url.protocol)) {
            errors.push(`CORS_ORIGINS contains an unsupported origin: ${origin}`);
            return false;
        }
        if (url.pathname !== '/' || url.search || url.hash) {
            errors.push(`CORS_ORIGINS must contain origins without paths: ${origin}`);
            return false;
        }
        return true;
    } catch (error) {
        errors.push(`CORS_ORIGINS contains an invalid origin: ${origin}`);
        return false;
    }
}

function isServerlessRuntime(env = process.env) {
    return parseBoolean(env.SERVERLESS, false)
        || Boolean(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME);
}

function validateConfig(env = process.env) {
    const errors = [];
    const nodeEnv = String(env.NODE_ENV || 'development').trim().toLowerCase();
    const isProduction = nodeEnv === 'production';
    const isTest = nodeEnv === 'testing' || nodeEnv === 'test';
    const serverless = isServerlessRuntime(env);

    const port = parseInteger(env.PORT, 3000, { min: 1, max: 65535, name: 'PORT' });
    const appUrl = String(env.APP_URL || `http://localhost:${port}`).replace(/\/+$/, '');
    if (!/^https?:\/\/[^\s]+$/i.test(appUrl)) {
        errors.push('APP_URL must be an absolute http(s) URL');
    }

    validateJwtSecret(env.JWT_SECRET, errors);

    for (const name of ['DB_HOST', 'DB_USER', 'DB_NAME']) {
        if (!String(env[name] || '').trim()) errors.push(`${name} is required`);
    }

    const dbPort = parseInteger(env.DB_PORT, 3306, { min: 1, max: 65535, name: 'DB_PORT' });
    const dbConnectionLimit = parseInteger(
        env.DB_CONNECTION_LIMIT,
        serverless ? 1 : 10,
        { min: 1, max: 100, name: 'DB_CONNECTION_LIMIT' }
    );
    const dbQueueLimit = parseInteger(
        env.DB_QUEUE_LIMIT,
        serverless ? 20 : 50,
        { min: 0, max: 10000, name: 'DB_QUEUE_LIMIT' }
    );
    const dbConnectTimeoutMs = parseInteger(env.DB_CONNECT_TIMEOUT_MS, 10000, { min: 1000, max: 120000, name: 'DB_CONNECT_TIMEOUT_MS' });
    const dbQueryTimeoutMs = parseInteger(env.DB_QUERY_TIMEOUT_MS, 15000, { min: 1000, max: 120000, name: 'DB_QUERY_TIMEOUT_MS' });
    const dbIdleTimeoutMs = parseInteger(
        env.DB_IDLE_TIMEOUT_MS,
        serverless ? 10000 : 300000,
        { min: 0, max: 3600000, name: 'DB_IDLE_TIMEOUT_MS' }
    );
    const dbMaxIdle = parseInteger(
        env.DB_MAX_IDLE,
        serverless ? 1 : Math.min(2, dbConnectionLimit),
        { min: 0, max: 100, name: 'DB_MAX_IDLE' }
    );
    if (dbMaxIdle > dbConnectionLimit) {
        errors.push('DB_MAX_IDLE must be less than or equal to DB_CONNECTION_LIMIT');
    }
    const dbPoolWarmup = parseInteger(
        env.DB_POOL_WARMUP,
        serverless ? 0 : 2,
        { min: 0, max: 100, name: 'DB_POOL_WARMUP' }
    );
    if (dbPoolWarmup > dbConnectionLimit) {
        errors.push('DB_POOL_WARMUP must be less than or equal to DB_CONNECTION_LIMIT');
    }
    const dbPreparedStatements = parseBoolean(env.DB_PREPARED_STATEMENTS, false);

    const defaultOrigins = [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
    const configuredOrigins = parseList(env.CORS_ORIGINS);
    if (isProduction && !configuredOrigins.length) {
        errors.push('CORS_ORIGINS is required in production');
    }
    const corsOrigins = configuredOrigins.length ? configuredOrigins : defaultOrigins;
    corsOrigins.forEach(origin => validateOrigin(origin, errors));

    const exposeDevTokens = parseBoolean(env.EXPOSE_DEV_TOKENS, false);
    if (isProduction && exposeDevTokens) {
        errors.push('EXPOSE_DEV_TOKENS must be false in production');
    }

    const fileMode = String(env.FILES_MODE || 'local').trim().toLowerCase();
    if (!FILE_MODES.includes(fileMode)) errors.push('FILES_MODE must be local or cloud');
    if (fileMode === 'cloud') {
        for (const name of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
            if (!String(env[name] || '').trim()) errors.push(`${name} is required when FILES_MODE=cloud`);
        }
    }

    const logLevel = String(env.LOG_LEVEL || 'info').trim().toLowerCase();
    if (!LOG_LEVELS.includes(logLevel)) {
        errors.push(`LOG_LEVEL must be one of: ${LOG_LEVELS.join(', ')}`);
    }

    const maxFileBytes = parseInteger(env.UPLOAD_MAX_FILE_BYTES, 100 * 1024 * 1024, {
        min: 1024, max: 1024 * 1024 * 1024, name: 'UPLOAD_MAX_FILE_BYTES'
    });
    const maxRequestBytes = parseInteger(env.UPLOAD_MAX_REQUEST_BYTES, 150 * 1024 * 1024, {
        min: 1024, max: 2 * 1024 * 1024 * 1024, name: 'UPLOAD_MAX_REQUEST_BYTES'
    });
    if (maxRequestBytes < maxFileBytes) {
        errors.push('UPLOAD_MAX_REQUEST_BYTES must be greater than or equal to UPLOAD_MAX_FILE_BYTES');
    }

    const metricsEnabled = parseBoolean(env.METRICS_ENABLED, !isProduction);
    if (metricsEnabled && isProduction && !String(env.METRICS_TOKEN || '').trim()) {
        errors.push('METRICS_TOKEN is required when METRICS_ENABLED=true in production');
    }

    const logRetentionDays = parseInteger(env.LOG_RETENTION_DAYS, 30, {
        min: 1, max: 3650, name: 'LOG_RETENTION_DAYS'
    });
    const outboxWorkerEnabled = parseBoolean(env.OUTBOX_WORKER_ENABLED, true);
    const outboxPollIntervalMs = parseInteger(env.OUTBOX_POLL_INTERVAL_MS, 1000, {
        min: 250, max: 60000, name: 'OUTBOX_POLL_INTERVAL_MS'
    });
    const outboxBatchSize = parseInteger(env.OUTBOX_BATCH_SIZE, 20, {
        min: 1, max: 1000, name: 'OUTBOX_BATCH_SIZE'
    });
    const outboxMaxAttempts = parseInteger(env.OUTBOX_MAX_ATTEMPTS, 5, {
        min: 1, max: 100, name: 'OUTBOX_MAX_ATTEMPTS'
    });
    const outboxBaseBackoffMs = parseInteger(env.OUTBOX_BASE_BACKOFF_MS, 5000, {
        min: 100, max: 3600000, name: 'OUTBOX_BASE_BACKOFF_MS'
    });
    const outboxMaxBackoffMs = parseInteger(env.OUTBOX_MAX_BACKOFF_MS, 300000, {
        min: 100, max: 86400000, name: 'OUTBOX_MAX_BACKOFF_MS'
    });
    if (outboxMaxBackoffMs < outboxBaseBackoffMs) {
        errors.push('OUTBOX_MAX_BACKOFF_MS must be greater than or equal to OUTBOX_BASE_BACKOFF_MS');
    }
    const outboxStaleMs = parseInteger(env.OUTBOX_STALE_MS, 300000, {
        min: 1000, max: 86400000, name: 'OUTBOX_STALE_MS'
    });
    const outboxRetentionDays = parseInteger(env.OUTBOX_RETENTION_DAYS, 30, {
        min: 1, max: 3650, name: 'OUTBOX_RETENTION_DAYS'
    });
    const auditRetentionDays = parseInteger(env.AUDIT_RETENTION_DAYS, 365, {
        min: 1, max: 36500, name: 'AUDIT_RETENTION_DAYS'
    });
    const notificationRetentionDays = parseInteger(env.NOTIFICATION_RETENTION_DAYS, 90, {
        min: 1, max: 36500, name: 'NOTIFICATION_RETENTION_DAYS'
    });

    const config = {
        env: nodeEnv,
        isProduction,
        isTest,
        serverless,
        port,
        appUrl,
        db: {
            host: String(env.DB_HOST || '').trim(),
            port: dbPort,
            user: String(env.DB_USER || '').trim(),
            password: String(env.DB_PASS || ''),
            database: String(env.DB_NAME || '').trim(),
            ssl: parseBoolean(env.DB_SSL, false),
            serverless,
            connectionLimit: dbConnectionLimit,
            queueLimit: dbQueueLimit,
            connectTimeout: dbConnectTimeoutMs,
            queryTimeoutMs: dbQueryTimeoutMs,
            idleTimeoutMs: dbIdleTimeoutMs,
            maxIdle: dbMaxIdle,
            poolWarmup: dbPoolWarmup,
            preparedStatements: dbPreparedStatements
        },
        jwt: {
            secret: String(env.JWT_SECRET || ''),
            expiresIn: String(env.JWT_EXPIRES || '2h').trim(),
            issuer: String(env.JWT_ISSUER || 'bibliotech').trim(),
            audience: String(env.JWT_AUDIENCE || 'bibliotech-api').trim(),
            algorithm: 'HS256'
        },
        cors: { origins: corsOrigins },
        security: {
            exposeDevTokens,
            trustProxy: parseBoolean(env.TRUST_PROXY, false),
            bodyLimit: String(env.BODY_LIMIT || '1mb').trim(),
            requestTimeoutMs: parseInteger(env.REQUEST_TIMEOUT_MS, 30000, {
                min: 1000, max: 300000, name: 'REQUEST_TIMEOUT_MS'
            }),
            shutdownTimeoutMs: parseInteger(env.SHUTDOWN_TIMEOUT_MS, 10000, {
                min: 1000, max: 120000, name: 'SHUTDOWN_TIMEOUT_MS'
            })
        },
        upload: {
            mode: fileMode,
            maxFileBytes,
            maxRequestBytes,
            maxFiles: parseInteger(env.UPLOAD_MAX_FILES, 20, { min: 1, max: 100, name: 'UPLOAD_MAX_FILES' }),
            maxBatchItems: parseInteger(env.UPLOAD_MAX_BATCH_ITEMS, 100, { min: 1, max: 500, name: 'UPLOAD_MAX_BATCH_ITEMS' }),
            maxCoverBytes: parseInteger(env.MAX_COVER_BYTES, 5 * 1024 * 1024, {
                min: 1024, max: 20 * 1024 * 1024, name: 'MAX_COVER_BYTES'
            }),
            rateLimit: parseInteger(env.UPLOAD_RATE_LIMIT, 50, { min: 1, max: 10000, name: 'UPLOAD_RATE_LIMIT' }),
            rateWindowMs: parseInteger(env.UPLOAD_RATE_WINDOW_MS, 60000, {
                min: 1000, max: 86400000, name: 'UPLOAD_RATE_WINDOW_MS'
            })
        },
        rateLimit: {
            authIpMax: parseInteger(env.AUTH_IP_RATE_LIMIT, 100, { min: 1, max: 100000, name: 'AUTH_IP_RATE_LIMIT' }),
            authIpWindowMs: parseInteger(env.AUTH_IP_RATE_WINDOW_MS, 15 * 60 * 1000, {
                min: 1000, max: 86400000, name: 'AUTH_IP_RATE_WINDOW_MS'
            }),
            authAccountMax: parseInteger(env.AUTH_ACCOUNT_RATE_LIMIT, 10, {
                min: 1, max: 10000, name: 'AUTH_ACCOUNT_RATE_LIMIT'
            }),
            authAccountWindowMs: parseInteger(env.AUTH_ACCOUNT_RATE_WINDOW_MS, 15 * 60 * 1000, {
                min: 1000, max: 86400000, name: 'AUTH_ACCOUNT_RATE_WINDOW_MS'
            }),
            recoveryMax: parseInteger(env.AUTH_RECOVERY_RATE_LIMIT, 20, {
                min: 1, max: 10000, name: 'AUTH_RECOVERY_RATE_LIMIT'
            }),
            recoveryWindowMs: parseInteger(env.AUTH_RECOVERY_RATE_WINDOW_MS, 60 * 60 * 1000, {
                min: 1000, max: 86400000, name: 'AUTH_RECOVERY_RATE_WINDOW_MS'
            })
        },
        logging: {
            level: logLevel,
            retentionDays: logRetentionDays,
            metricsEnabled,
            metricsToken: String(env.METRICS_TOKEN || '')
        },
        outbox: {
            workerEnabled: outboxWorkerEnabled,
            pollIntervalMs: outboxPollIntervalMs,
            batchSize: outboxBatchSize,
            maxAttempts: outboxMaxAttempts,
            baseBackoffMs: outboxBaseBackoffMs,
            maxBackoffMs: outboxMaxBackoffMs,
            staleMs: outboxStaleMs,
            retentionDays: outboxRetentionDays
        },
        retention: {
            auditDays: auditRetentionDays,
            notificationDays: notificationRetentionDays,
            outboxDays: outboxRetentionDays
        },
        language: {
            default: String(env.DEFAULT_LANGUAGE || 'es').trim().toLowerCase(),
            supported: parseList(env.SUPPORTED_LANGUAGES)
        },
        auth: {
            resetTokenMinutes: parseInteger(env.RESET_TOKEN_MINUTES, 60, {
                min: 1, max: 1440, name: 'RESET_TOKEN_MINUTES'
            }),
            verifyTokenMinutes: parseInteger(env.VERIFY_TOKEN_MINUTES, 60, {
                min: 1, max: 1440, name: 'VERIFY_TOKEN_MINUTES'
            })
        }
    };

    if (errors.length) {
        const error = new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
        error.code = 'INVALID_ENV';
        throw error;
    }
    return config;
}

let cachedConfig = null;

function getConfig() {
    if (!cachedConfig) cachedConfig = validateConfig(process.env);
    return cachedConfig;
}

function resetConfigForTests() {
    cachedConfig = null;
}

module.exports = {
    getConfig,
    validateConfig,
    estimateEntropyBits,
    isServerlessRuntime,
    resetConfigForTests,
    FALLBACK_SECRETS
};
