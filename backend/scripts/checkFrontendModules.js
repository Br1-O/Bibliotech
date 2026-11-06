const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../../frontend');
const entryPoint = path.join(root, 'js/bootstrap.js');
const cache = new Map();
const listeners = [];
class HTMLElement {}
const element = () => ({
    style: {},
    dataset: {},
    classList: { add() {}, toggle() {} },
    setAttribute() {},
    appendChild() {},
    addEventListener() {},
    replaceChildren() {}
});
const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance: { now: () => Date.now() },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    HTMLElement,
    CustomEvent: class {
        constructor(type) {
            this.type = type;
        }
    },
    document: {
        addEventListener: (name) => listeners.push(name),
        dispatchEvent() {},
        querySelector: () => null,
        documentElement: { setAttribute() {}, style: {} },
        querySelectorAll: () => [],
        getElementById: () => null,
        createElement: element,
        createElementNS: element,
        createTextNode: () => ({}),
        body: { appendChild() {}, style: {} }
    },
    customElements: { get: () => null, define() {} },
    navigator: { language: 'es' },
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    URL,
    URLSearchParams,
    FormData,
    Headers,
    Request,
    Response,
    Blob,
    AbortController,
    TextEncoder
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function load(file) {
    if (cache.has(file)) return cache.get(file);
    if (!fs.existsSync(file)) throw new Error(`Modulo no encontrado: ${file}`);
    const module = new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), {
        identifier: file,
        context: sandbox
    });
    cache.set(file, module);
    return module;
}

(async () => {
    const entry = load(entryPoint);
    await entry.link((specifier, referencing) => {
        return load(path.resolve(path.dirname(referencing.identifier), specifier));
    });
    await entry.evaluate();

    const leaked = [
        'el',
        'render',
        'LanguageManager',
        'authHelper',
        'Validator',
        'Icons',
        'PasswordField',
        'Loader',
        'Toast',
        'Modal',
        'MaterialViewer',
        'Cards',
        'MaterialEditor',
        'ProfileSummary',
        'PasswordChange',
        'Pagination',
        'apiService',
        'Theme',
        'attachTagInput'
    ].filter((name) => sandbox[name] !== undefined);
    if (leaked.length) throw new Error(`Globales implicitos detectados: ${leaked.join(', ')}`);
    if (!listeners.includes('bt:ready')) throw new Error('Los controladores no registraron bt:ready');
    if (!listeners.includes('DOMContentLoaded')) throw new Error('app.js no registro DOMContentLoaded');
    console.log(`Frontend: ${cache.size} modulos enlazados y evaluados sin globales implicitos`);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
