const { AsyncLocalStorage } = require('async_hooks');
const mysql = require('mysql2');
const { getConfig } = require('./env');
const metrics = require('../utils/metrics');
const { logger } = require('../utils/logger');

const appConfig = getConfig();
const config = appConfig.db;

const POOL_KEY = Symbol.for('bibliotech.db.pool');

function effectiveMaxIdle() {
    return appConfig.isTest
        ? config.connectionLimit
        : Math.min(config.maxIdle, config.connectionLimit);
}

function createPool() {
    return mysql.createPool({
        host: config.host,
        user: config.user,
        password: config.password,
        database: config.database,
        port: config.port,
        waitForConnections: true,
        connectionLimit: config.connectionLimit,
        maxIdle: effectiveMaxIdle(),
        idleTimeout: config.idleTimeoutMs,
        queueLimit: config.queueLimit,
        connectTimeout: config.connectTimeout,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        charset: 'utf8mb4',
        ...(config.ssl ? { ssl: { rejectUnauthorized: false } } : {})
    });
}

// Vercel/Lambda can evaluate this module in several isolated instances. Keep
// exactly one pool per process even if the module is loaded through different
// paths (for example, a hot-reload wrapper).
if (!globalThis[POOL_KEY]) {
    const rawPool = createPool();
    globalThis[POOL_KEY] = { pool: rawPool, promisePool: rawPool.promise(), closed: false };
}
const pool = globalThis[POOL_KEY].pool;
const promisePool = globalThis[POOL_KEY].promisePool;
const transactionStorage = new AsyncLocalStorage();

const UNAVAILABLE_CODES = new Set([
    'ER_CON_COUNT_ERROR',
    'ER_TOO_MANY_USER_CONNECTIONS',
    'POOL_QUEUE_LIMIT',
    'POOL_CLOSED'
]);

function normalizeError(error) {
    if (error && !error.code && /Queue limit reached/i.test(String(error.message || ''))) {
        error.code = 'POOL_QUEUE_LIMIT';
    }
    return error;
}

function isUnavailableError(error) {
    return Boolean(error && (
        UNAVAILABLE_CODES.has(String(error.code || ''))
        || /Queue limit reached|No connections available/i.test(String(error.message || ''))
    ));
}

function currentConnection() {
    const context = transactionStorage.getStore();
    return context ? context.connection : promisePool;
}

function afterCommit(callback) {
    const context = transactionStorage.getStore();
    if (context) {
        context.afterCommit.push(callback);
        return undefined;
    }
    return Promise.resolve().then(callback);
}

function sqlText(sql) {
    return typeof sql === 'string' ? sql : String(sql?.sql || '');
}

function operationName(sql) {
    const match = sqlText(sql).match(/^\s*(SELECT|INSERT|UPDATE|DELETE|REPLACE|ALTER|CREATE|DROP|TRUNCATE|WITH|CALL)\b/i);
    return match ? match[1].toUpperCase() : 'OTHER';
}

function instrument(promise, sql) {
    const startedAt = process.hrtime.bigint();
    const operation = operationName(sql);
    return promise.then(
        result => {
            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
            metrics.observe('db_query_duration_ms', durationMs, { operation });
            metrics.increment('db_queries_total', { operation, status: 'ok' });
            return result;
        },
        error => {
            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
            metrics.observe('db_query_duration_ms', durationMs, { operation });
            metrics.increment('db_queries_total', { operation, status: 'error' });
            metrics.recordDbError(operation);
            throw normalizeError(error);
        }
    );
}

async function transaction(callback) {
    const active = transactionStorage.getStore();
    if (active) return callback(active.connection);

    let connection;
    try {
        connection = await promisePool.getConnection();
    } catch (error) {
        metrics.recordDbError('acquire');
        throw normalizeError(error);
    }
    const context = { connection, afterCommit: [] };
    let result;
    let committed = false;
    try {
        await connection.beginTransaction();
        result = await transactionStorage.run(context, () => callback(connection));
        await connection.commit();
        committed = true;
    } catch (error) {
        try { await connection.rollback(); } catch (rollbackError) { /* preserve original error */ }
        throw normalizeError(error);
    } finally {
        connection.release();
    }
    if (committed) {
        for (const hook of context.afterCommit) {
            try { await hook(); }
            catch (error) { logger.error('db.after_commit_failed', { error }); }
        }
    }
    return result;
}

const db = {
    execute(sql, params) {
        const connection = currentConnection();
        if (!config.preparedStatements) {
            if (config.queryTimeoutMs && typeof sql === 'string') {
                return instrument(connection.query({ sql, timeout: config.queryTimeoutMs }, params), sql);
            }
            return instrument(connection.query(sql, params), sql);
        }
        if (config.queryTimeoutMs && typeof sql === 'string') {
            return instrument(connection.execute({ sql, timeout: config.queryTimeoutMs }, params), sql);
        }
        return instrument(connection.execute(sql, params), sql);
    },

    query(sql, params) {
        const connection = currentConnection();
        if (config.queryTimeoutMs && typeof sql === 'string') {
            return instrument(connection.query({ sql, timeout: config.queryTimeoutMs }, params), sql);
        }
        return instrument(connection.query(sql, params), sql);
    },

    transaction,
    afterCommit,

    inTransaction() {
        return Boolean(transactionStorage.getStore());
    },

    async healthCheck() {
        const [rows] = await instrument(promisePool.query('SELECT 1 AS ok'), 'SELECT 1 AS ok');
        return Boolean(rows?.[0]?.ok === 1);
    },

    poolStats() {
        return {
            all: Number(pool._allConnections?.length) || 0,
            free: Number(pool._freeConnections?.length) || 0,
            queued: Number(pool._connectionQueue?.length) || 0,
            limit: config.connectionLimit,
        maxIdle: effectiveMaxIdle(),
            serverless: Boolean(config.serverless)
        };
    },

    async warmPool() {
        const count = Math.min(Number(config.poolWarmup) || 0, config.connectionLimit);
        if (!count) return;
        const results = await Promise.allSettled(
            Array.from({ length: count }, () => promisePool.getConnection())
        );
        results.forEach(result => {
            if (result.status === 'fulfilled') result.value.release();
        });
        const failure = results.find(result => result.status === 'rejected');
        if (failure) throw normalizeError(failure.reason);
    },

    isUnavailableError,

    close() {
        if (globalThis[POOL_KEY]?.closed) return Promise.resolve();
        if (globalThis[POOL_KEY]) globalThis[POOL_KEY].closed = true;
        return new Promise((resolve, reject) => {
            pool.end(error => (error ? reject(normalizeError(error)) : resolve()));
        });
    }
};

module.exports = db;
