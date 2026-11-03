const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fileHelper = require('../utils/fileHelper');

process.env.FILES_MODE = 'local';
const materialController = require('../controllers/materialController');

const createUpload = () => {
    const filename = `test-upload-${crypto.randomUUID()}.pdf`;
    const absolute = path.join(fileHelper.UPLOAD_DIR, filename);
    fs.mkdirSync(fileHelper.UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(absolute, '%PDF-1.4\ncontenido de prueba');
    return {
        file: {
            fieldname: 'archivo',
            filename,
            path: absolute,
            originalname: 'material.pdf',
            mimetype: 'application/pdf',
            size: fs.statSync(absolute).size
        },
        absolute
    };
};

const makeResponse = () => ({
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
});

const invokeUpload = async (controller, file) => {
    const req = {
        files: { archivo: [file] },
        body: { titulo: 'Material duplicado', tipo: 'PDF' },
        usuarioId: 10,
        rol: 'Profesor',
        t: key => key
    };
    const res = makeResponse();
    let nextError = null;
    await controller.upload(req, res, error => { nextError = error; });
    assert.equal(nextError, null);
    return res;
};

test('duplicate upload success removes the newly stored file', async () => {
    const controller = materialController({
        materialService: {
            async uploadOrSuggestMaterial() {
                return {
                    duplicate: true,
                    message: 'messages.materialDuplicateProfessor',
                    material: { id: 7, titulo: 'Existente', tipo: 'PDF', urlOrPath: '/uploads/existing.pdf' }
                };
            }
        },
        authService: {}
    });
    const upload = createUpload();
    try {
        const response = await invokeUpload(controller, upload.file);
        assert.equal(response.statusCode, 201);
        assert.equal(response.body.duplicate, true);
        assert.equal(fs.existsSync(upload.absolute), false);
    } finally {
        fs.rmSync(upload.absolute, { force: true });
    }
});

test('non-duplicate upload success keeps the stored file', async () => {
    const controller = materialController({
        materialService: {
            async uploadOrSuggestMaterial(dto) {
                return {
                    message: 'messages.materialUploaded',
                    material: {
                        id: 8,
                        titulo: dto.titulo,
                        tipo: dto.tipo,
                        urlOrPath: dto.urlOrPath,
                        fileHash: dto.fileHash
                    }
                };
            }
        },
        authService: {}
    });
    const upload = createUpload();
    try {
        const response = await invokeUpload(controller, upload.file);
        assert.equal(response.statusCode, 201);
        assert.equal(fs.existsSync(upload.absolute), true);
    } finally {
        fs.rmSync(upload.absolute, { force: true });
    }
});
