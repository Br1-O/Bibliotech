const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { getConfig } = require('../config/env');

async function main() {
    const config = getConfig().db;
    const directory = path.join(__dirname, '..', 'config', 'migrations');
    const files = fs.readdirSync(directory)
        .filter(file => file.endsWith('.sql'))
        .sort((a, b) => a.localeCompare(b));

    const connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        charset: 'utf8mb4',
        multipleStatements: true,
        ...(config.ssl ? { ssl: { rejectUnauthorized: false } } : {})
    });

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version     VARCHAR(255) PRIMARY KEY,
                applied_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        const [appliedRows] = await connection.query('SELECT version FROM schema_migrations');
        const applied = new Set(appliedRows.map(row => row.version));

        for (const file of files) {
            if (applied.has(file)) {
                console.log(`SKIP ${file}`);
                continue;
            }
            const sql = fs.readFileSync(path.join(directory, file), 'utf8');
            await connection.query(sql);
            await connection.execute('INSERT INTO schema_migrations (version) VALUES (?)', [file]);
            console.log(`APPLIED ${file}`);
        }
    } finally {
        await connection.end();
    }
}

main().catch(error => {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
});
