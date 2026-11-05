const { AsyncLocalStorage } = require('async_hooks');
const mysql = require('mysql2');
const { getConfig } = require('./env');
const metrics = require('../utils/metrics');
const { logger } = require('../utils/logger');

const config = getConfig().db;

const pool = mysql.createPool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database,
    port: config.port,
    waitForConnections: true,
    connectionLimit: config.connectionLimit,
    maxIdle: config.connectionLimit,
    idleTimeout: config.idleTimeoutMs,
    queueLimit: config.queueLimit,
    connectTimeout: config.connectTimeout,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: 'utf8mb4',
    ...(config.ssl ? { ssl: { rejectUnauthorized: false } } : {})
});

const promisePool = pool.promise();
const transactionStorage = new AsyncLocalStorage();

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
            throw error;
        }
    );
}

async function transaction(callback) {
    const active = transactionStorage.getStore();
    if (active) return callback(active.connection);

    const connection = await promisePool.getConnection();
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
        throw error;
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
            limit: config.connectionLimit
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
        if (failure) throw failure.reason;
    },

    close() {
        return new Promise((resolve, reject) => {
            pool.end(error => (error ? reject(error) : resolve()));
        });
    }
};

module.exports = db;
