const db = require('../config/db');
const { getConfig } = require('../config/env');
const MariaDBOutboxRepository = require('../infrastructure/repositories/MariaDBOutboxRepository');

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
    const days = positiveInteger(readArg('days', config.retention.outboxDays), config.retention.outboxDays);
    const batchSize = positiveInteger(readArg('batch', 500), 500);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const repository = new MariaDBOutboxRepository();
    const summary = {
        mode: execute ? 'prune' : 'dry-run',
        cutoff: cutoff.toISOString(),
        retentionDays: days,
        batchSize,
        deleted: 0
    };
    console.log(JSON.stringify(summary));
    if (!execute) return;

    for (;;) {
        const deleted = await repository.deleteDoneBefore(cutoff, batchSize);
        summary.deleted += deleted;
        if (deleted < batchSize) break;
    }
    console.log(JSON.stringify({ ...summary, mode: 'prune' }));
}

main()
    .catch(error => {
        console.error(`Outbox retention failed: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(() => db.close().catch(() => {}));
