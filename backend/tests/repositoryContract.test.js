const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../config/db');
const MaterialRepository = require('../infrastructure/repositories/MariaDBMaterialRepository');

const enabled = process.env.RUN_DB_CONTRACT_TESTS === '1';

test('read contracts return the documented shapes against MariaDB', { skip: !enabled }, async () => {
    const repository = new MaterialRepository();
    try {
        const options = await repository.findFilterOptions();
        assert.ok(Array.isArray(options.years));
        assert.ok(Array.isArray(options.categories));
        for (const category of options.categories) {
            assert.equal(typeof category.id, 'number');
            assert.equal(typeof category.slug, 'string');
            assert.equal(typeof category.nombre, 'string');
        }

        const [rows] = await db.execute('SELECT id FROM materials ORDER BY id DESC LIMIT 1');
        if (rows.length) {
            const source = await repository.findFileSourceById(rows[0].id);
            assert.ok(source);
            assert.equal(typeof source.id, 'number');
            assert.ok(Object.prototype.hasOwnProperty.call(source, 'urlOrPath'));
            assert.ok(Object.prototype.hasOwnProperty.call(source, 'estado'));
            assert.ok(Object.prototype.hasOwnProperty.call(source, 'autorId'));
        }
    } finally {
        await db.close();
    }
});
