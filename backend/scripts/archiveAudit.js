const db = require('../config/db');
const { getConfig } = require('../config/env');

const LOCK_NAME = 'bibliotech:audit-archive';
const DELETE_TRIGGER = `CREATE TRIGGER audit_logs_no_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only'`;

function readArg(name, fallback) {
    const prefix = `--${name}=`;
    const found = process.argv.find(arg => arg.startsWith(prefix));
    if (found) return found.slice(prefix.length);
    const index = process.argv.indexOf(`--${name}`);
    if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
        return process.argv[index + 1];
    }
    return fallback;
}

function positiveInteger(value, fallback) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
}

async function main() {
    const config = getConfig();
    const execute = process.argv.includes('--execute');
    const verify = process.argv.includes('--verify');
    const days = positiveInteger(readArg('days', config.retention.auditDays), config.retention.auditDays);
    const batchSize = positiveInteger(readArg('batch', 500), 500);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [lockRows] = await db.query('SELECT GET_LOCK(?, 10) AS acquired', [LOCK_NAME]);
    if (Number(lockRows[0]?.acquired) !== 1) throw new Error('Another audit retention process is running');

    try {
        if (verify) {
            const [[archive]] = await db.query('SELECT COUNT(*) AS total FROM audit_logs_archive');
            const [[overlap]] = await db.query(
                `SELECT COUNT(*) AS total
                   FROM audit_logs a
                   JOIN audit_logs_archive ar ON ar.id = a.id`
            );
            const [[duplicates]] = await db.query(
                `SELECT COUNT(*) AS total FROM (
                    SELECT id FROM audit_logs_archive GROUP BY id HAVING COUNT(*) > 1
                 ) duplicated`
            );
            console.log(JSON.stringify({
                mode: 'verify',
                archiveRows: Number(archive.total) || 0,
                overlapWithLive: Number(overlap.total) || 0,
                duplicateArchiveIds: Number(duplicates.total) || 0
            }));
            if (Number(overlap.total) || Number(duplicates.total)) process.exitCode = 1;
            return;
        }

        const [[before]] = await db.query(
            'SELECT COUNT(*) AS total FROM audit_logs WHERE timestamp < ?',
            [cutoff]
        );
        const summary = {
            mode: execute ? 'archive' : 'dry-run',
            cutoff: cutoff.toISOString(),
            retentionDays: days,
            batchSize,
            candidates: Number(before.total) || 0,
            archived: 0
        };
        console.log(JSON.stringify(summary));
        if (!execute) return;

        await db.query('DROP TRIGGER IF EXISTS audit_logs_no_delete');
        let archived = 0;
        try {
            for (;;) {
                const [rows] = await db.query(
                    `SELECT id FROM audit_logs
                      WHERE timestamp < ?
                      ORDER BY id
                      LIMIT ?`,
                    [cutoff, batchSize]
                );
                if (!rows.length) break;
                const ids = rows.map(row => Number(row.id));
                const placeholders = ids.map(() => '?').join(',');
                await db.query(
                    `INSERT IGNORE INTO audit_logs_archive
                        (id, timestamp, tipo_operacion, usuario_id, registro_tipo, registro_id, idempotency_key)
                     SELECT id, timestamp, tipo_operacion, usuario_id, registro_tipo, registro_id, idempotency_key
                       FROM audit_logs
                      WHERE id IN (${placeholders})`,
                    ids
                );
                const [deleted] = await db.query(
                    `DELETE FROM audit_logs WHERE id IN (${placeholders})`,
                    ids
                );
                archived += Number(deleted.affectedRows) || 0;
                if (rows.length < batchSize) break;
            }
        } finally {
            await db.query(DELETE_TRIGGER).catch(error => {
                console.error(`Could not restore audit delete trigger: ${error.message}`);
            });
        }
        console.log(JSON.stringify({ ...summary, mode: 'archive', archived }));
    } finally {
        await db.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]).catch(() => {});
        await db.close();
    }
}

main().catch(error => {
    console.error(`Audit archival failed: ${error.message}`);
    process.exitCode = 1;
});
