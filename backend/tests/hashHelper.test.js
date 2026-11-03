const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const hashHelper = require('../utils/hashHelper');

test('hashFile returns the SHA-256 of a streamed file', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bibliotech-hash-'));
    const file = path.join(directory, 'material.bin');
    const content = Buffer.from('%PDF-1.4\ncontenido de prueba');
    fs.writeFileSync(file, content);
    try {
        const expected = crypto.createHash('sha256').update(content).digest('hex');
        assert.equal(await hashHelper.hashFile(file), expected);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test('hashFile rejects missing files', async () => {
    await assert.rejects(hashHelper.hashFile('/ruta/que/no/existe.pdf'));
});
