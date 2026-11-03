#!/usr/bin/env node
/**
 * Elimina archivos locales de uploads que no estan referenciados por ningun
 * material y superan la edad minima de seguridad.
 *
 * Uso:
 *   node scripts/reconcileFiles.js --dry-run
 *   node scripts/reconcileFiles.js --min-age-hours=48
 */

const fs = require('fs/promises');
const path = require('path');
const db = require('../config/db');
const fileHelper = require('../utils/fileHelper');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const ageArgument = process.argv.find(argument => argument.startsWith('--min-age-hours='));
const minimumAgeHours = ageArgument ? Number(ageArgument.split('=')[1]) : 24;

if (!Number.isFinite(minimumAgeHours) || minimumAgeHours < 0) {
    console.error('--min-age-hours must be a non-negative number');
    process.exit(2);
}

async function walk(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...await walk(absolute));
        } else if (entry.isFile()) {
            files.push(absolute);
        }
    }
    return files;
}

async function main() {
    const [rows] = await db.execute('SELECT url_or_path AS urlOrPath, portada FROM materials');
    const referenced = new Set();
    for (const row of rows) {
        for (const value of [row.urlOrPath, row.portada]) {
            const local = fileHelper.resolveLocalPath(value);
            if (local) referenced.add(path.resolve(local));
        }
    }

    let scanned = 0;
    let removed = 0;
    let skipped = 0;
    const cutoff = Date.now() - minimumAgeHours * 60 * 60 * 1000;

    let files = [];
    try {
        files = await walk(fileHelper.UPLOAD_DIR);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }

    for (const absolute of files) {
        if (path.basename(absolute).startsWith('.')) continue;
        scanned += 1;
        if (referenced.has(path.resolve(absolute))) {
            skipped += 1;
            continue;
        }

        const stat = await fs.stat(absolute);
        if (stat.mtimeMs > cutoff) {
            skipped += 1;
            continue;
        }

        if (dryRun) {
            console.log(`orphan ${path.relative(fileHelper.UPLOAD_DIR, absolute)}`);
        } else {
            await fs.unlink(absolute);
            console.log(`removed ${path.relative(fileHelper.UPLOAD_DIR, absolute)}`);
        }
        removed += 1;
    }

    console.log(JSON.stringify({
        mode: dryRun ? 'dry-run' : 'delete',
        minimumAgeHours,
        scanned,
        referenced: referenced.size,
        skipped,
        orphans: removed
    }));
}

main()
    .catch(error => {
        console.error(`File reconciliation failed: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(() => db.close());
