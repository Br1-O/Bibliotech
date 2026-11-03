const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable, Readable } = require('stream');

class FakeResponse extends Writable {
    constructor() {
        super();
        this.headers = {};
        this.chunks = [];
        this.headersSent = false;
        this.statusCode = 200;
    }

    setHeader(key, value) {
        this.headers[String(key).toLowerCase()] = value;
    }

    removeHeader(key) {
        delete this.headers[String(key).toLowerCase()];
    }

    status(code) {
        this.statusCode = code;
        return this;
    }

    _write(chunk, encoding, callback) {
        this.chunks.push(Buffer.from(chunk));
        callback();
    }

    get body() {
        return Buffer.concat(this.chunks);
    }

    redirect(status, url) {
        this.redirected = { status, url };
        this.end();
        return this;
    }
}

function material(overrides = {}) {
    return {
        id: 1,
        titulo: 'Documento',
        tipo: 'PDF',
        urlOrPath: 'https://res.cloudinary.com/demo/raw/upload/v1/bibliotech/documento.pdf',
        estado: 'Aprobado',
        ...overrides
    };
}

function controllerFor(item) {
    return require('../controllers/materialController')({
        materialService: {
            getDownloadable: async () => item
        },
        authService: {}
    });
}

function run(handler, req) {
    const res = new FakeResponse();
    const request = { method: 'GET', headers: {}, ...req };
    const nextResult = new Promise(resolve => {
        res.on('finish', () => resolve({ error: null }));
        res.on('close', () => resolve({ error: null }));
        handler(request, res, error => resolve({ error }));
    });
    return nextResult.then(result => ({ ...result, res }));
}

test('file streams Cloudinary PDFs inline instead of resolving them as local paths', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
        ok: true,
        status: 200,
        url: material().urlOrPath,
        headers: { get: name => (name === 'content-type' ? 'application/octet-stream' : null) },
        body: Readable.toWeb(Readable.from([Buffer.from('%PDF-1.4\n')]))
    });
    try {
        const controller = controllerFor(material());
        const { error, res } = await run(controller.file, {
            params: { id: '1' }, usuarioId: 1, rol: 'Alumno'
        });
        assert.ifError(error);
        assert.equal(res.headers['content-type'], 'application/pdf');
        assert.match(res.headers['content-disposition'], /^inline;/);
        assert.equal(res.body.toString(), '%PDF-1.4\n');
        assert.equal(res.redirected, undefined);
    } finally {
        global.fetch = originalFetch;
    }
});

test('file forwards PDF byte ranges to Cloudinary', async () => {
    const originalFetch = global.fetch;
    let sentHeaders = null;
    global.fetch = async (url, options) => {
        sentHeaders = options.headers;
        return {
            ok: true,
            status: 206,
            url: material().urlOrPath,
            headers: {
                get: name => ({
                    'content-range': 'bytes 0-15/1024',
                    'content-length': '16',
                    'accept-ranges': 'bytes',
                    'content-type': 'application/pdf'
                }[String(name).toLowerCase()] || null)
            },
            body: Readable.toWeb(Readable.from([Buffer.from('%PDF-1.4\n')]))
        };
    };
    try {
        const controller = controllerFor(material());
        const { error, res } = await run(controller.file, {
            params: { id: '1' }, usuarioId: 1, rol: 'Alumno',
            headers: { range: 'bytes=0-15', 'if-range': 'etag-1' }
        });
        assert.ifError(error);
        assert.equal(sentHeaders.Range, 'bytes=0-15');
        assert.equal(sentHeaders['If-Range'], 'etag-1');
        assert.equal(sentHeaders['Accept-Encoding'], 'identity');
        assert.equal(res.statusCode, 206);
        assert.equal(res.headers['content-range'], 'bytes 0-15/1024');
        assert.equal(res.headers['content-length'], '16');
        assert.equal(res.headers['accept-ranges'], 'bytes');
    } finally {
        global.fetch = originalFetch;
    }
});

test('file redirects external non-Cloudinary URLs without local resolution', async () => {
    const controller = controllerFor(material({
        tipo: 'PDF',
        urlOrPath: 'https://example.com/documento.pdf'
    }));
    const { error, res } = await run(controller.file, {
        params: { id: '1' }, usuarioId: 1, rol: 'Alumno'
    });
    assert.ifError(error);
    assert.deepEqual(res.redirected, { status: 302, url: 'https://example.com/documento.pdf' });
});

test('download streams Cloudinary files as attachments', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
        ok: true,
        status: 200,
        url: material().urlOrPath,
        headers: { get: () => 'application/octet-stream' },
        body: Readable.toWeb(Readable.from([Buffer.from('%PDF-1.4\n')]))
    });
    try {
        const controller = controllerFor(material());
        const { error, res } = await run(controller.download, {
            params: { id: '1' }, usuarioId: 1, rol: 'Alumno'
        });
        assert.ifError(error);
        assert.equal(res.headers['content-type'], 'application/pdf');
        assert.match(res.headers['content-disposition'], /^attachment;/);
    } finally {
        global.fetch = originalFetch;
    }
});
