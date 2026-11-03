const { AsyncLocalStorage } = require('async_hooks');
const mysql = require('mysql2');
const { getConfig } = require('./env');

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
    return transactionStorage.getStore() || promisePool;
}

async function transaction(callback) {
    const active = transactionStorage.getStore();
    if (active) return callback(active);

    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await transactionStorage.run(connection, () => callback(connection));
        await connection.commit();
        return result;
    } catch (error) {
        try { await connection.rollback(); } catch (rollbackError) { /* preserve original error */ }
        throw error;
    } finally {
        connection.release();
    }
}

const db = {
    execute(sql, params) {
        const connection = currentConnection();
        if (!config.preparedStatements) {
            if (config.queryTimeoutMs && typeof sql === 'string') {
                return connection.query({ sql, timeout: config.queryTimeoutMs }, params);
            }
            return connection.query(sql, params);
        }
        if (config.queryTimeoutMs && typeof sql === 'string') {
            return connection.execute({ sql, timeout: config.queryTimeoutMs }, params);
        }
        return connection.execute(sql, params);
    },

    query(sql, params) {
        const connection = currentConnection();
        if (config.queryTimeoutMs && typeof sql === 'string') {
            return connection.query({ sql, timeout: config.queryTimeoutMs }, params);
        }
        return connection.query(sql, params);
    },

    transaction,

    inTransaction() {
        return Boolean(transactionStorage.getStore());
    },

    async healthCheck() {
        const [rows] = await promisePool.query('SELECT 1 AS ok');
        return Boolean(rows?.[0]?.ok === 1);
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
