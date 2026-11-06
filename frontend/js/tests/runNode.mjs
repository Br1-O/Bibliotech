/**
 * Project : Bibliotech | Frontend - Suite de pruebas
 * Runner headless: ejecuta exactamente los mismos modulos que tests.html
 * contra un servidor Bibliotech en marcha, sin necesidad de navegador.
 *
 * Uso:
 *   node frontend/js/tests/runNode.mjs
 *   BT_API_BASE=http://localhost:3000/api node frontend/js/tests/runNode.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const FILES = [
    'testUtils.js',
    'authTests.js',
    'subjectTests.js',
    'materialTests.js',
    'careerTests.js',
    'subscriptionTests.js',
    'notificationTests.js',
    'gamificationTests.js',
    'refinementTests.js',
    'adminTests.js',
    'securityTests.js',
    'sqlTests.js'
];

const sandbox = {
    console,
    fetch: globalThis.fetch,
    FormData: globalThis.FormData,
    Blob: globalThis.Blob,
    Headers: globalThis.Headers,
    Request: globalThis.Request,
    Response: globalThis.Response,
    URLSearchParams: globalThis.URLSearchParams,
    TextEncoder: globalThis.TextEncoder,
    AbortController: globalThis.AbortController,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Promise,
    Error,
    RegExp,
    encodeURIComponent,
    parseInt,
    isNaN
};
vm.createContext(sandbox);

for (const file of FILES) {
    const code = fs.readFileSync(path.join(TESTS_DIR, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
}

sandbox.testUtils.apiBase = process.env.BT_API_BASE || 'http://localhost:3000/api';

(async () => {
    const results = await sandbox.testUtils.runAll(process.env.BT_TEST_FILTER || '');
    const ok = results.filter(r => r.ok).length;
    console.log('\n================ RESULTADOS ================');
    results.forEach(r => {
        console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.ok ? '' : '  -> ' + r.error}`);
    });
    console.log('--------------------------------------------');
    console.log(`TOTAL: ${ok}/${results.length} pruebas OK`);
    process.exit(ok === results.length ? 0 : 1);
})().catch(err => {
    console.error('Error en el runner:', err);
    process.exit(2);
});
