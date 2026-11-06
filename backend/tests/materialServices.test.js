const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../config/db');
const MaterialUploadService = require('../application/services/material/MaterialUploadService');
const MaterialModerationService = require('../application/services/material/MaterialModerationService');
const MaterialAssociationService = require('../application/services/material/MaterialAssociationService');
const MaterialManagementService = require('../application/services/material/MaterialManagementService');
const MaterialCatalogService = require('../application/services/material/MaterialCatalogService');
const MaterialFavoriteService = require('../application/services/material/MaterialFavoriteService');
const MaterialAccessService = require('../application/services/material/MaterialAccessService');

const languageManager = {
    getLanguage: () => 'es',
    getThisMessage: (key) => key
};

const auditLogService = { record: async () => {}, recordMany: async () => {} };
const subscriptionRepository = { getObservers: async () => [] };

async function transcript(run) {
    const original = db.transaction;
    db.transaction = async (callback) => callback({});
    try {
        return await run();
    } finally {
        db.transaction = original;
    }
}

test('upload service records duplicate suggestions without creating a material', async () => {
    const associations = [];
    const repository = {
        async findByHashForUpdate() {
            return { id: 5, titulo: 'Existente', pages: null };
        },
        async findFilterOptions() {
            return { categories: [{ id: 1, slug: 'technical' }] };
        },
        async update() {},
        async associateToSubject(materialId, subjectId, state) {
            associations.push({ materialId, subjectId, state });
        },
        async setSubjectMandatory() {},
        async lockAuthor() {},
        async countPendingByAuthor() {
            return 0;
        }
    };
    const service = new MaterialUploadService({
        materialRepository: repository,
        subjectRepository: { findByIds: async (ids) => ids.map((id) => ({ id })) },
        auditLogService,
        languageManager
    });
    const result = await transcript(() =>
        service.uploadOrSuggestMaterial(
            {
                titulo: 'Documento',
                tipo: 'PDF',
                urlOrPath: 'https://example.com/documento.pdf',
                subjects: [7],
                category: 'technical'
            },
            { usuarioId: 2, rol: 'Alumno' }
        )
    );
    assert.equal(result.duplicate, true);
    assert.deepEqual(associations, [{ materialId: 5, subjectId: 7, state: 'Pendiente' }]);
});

test('upload service rejects batches above the configured limit', async () => {
    const service = new MaterialUploadService({ materialRepository: {}, languageManager });
    await assert.rejects(
        service.uploadBatch(
            Array.from({ length: 101 }, () => ({})),
            { usuarioId: 2, rol: 'Profesor' }
        ),
        (error) => error.status === 422
    );
});

test('batch upload creates new materials and reports only duplicate items as skipped', async () => {
    const deleted = [];
    const repository = {
        async findByHashesForUpdate() {
            return new Map([['hash-dup', { id: 5, titulo: 'Existente', fileHash: 'hash-dup' }]]);
        },
        async findFilterOptions() {
            return { categories: [{ id: 1, slug: 'technical' }] };
        },
        async saveMany(materials) {
            return materials.map((material, index) => ({ ...material, id: 10 + index }));
        },
        async syncTagsMany() {}
    };
    const service = new MaterialUploadService({
        materialRepository: repository,
        auditLogService,
        languageManager,
        fileStorage: { deleteStorageFile: async (path) => deleted.push(path) }
    });
    const result = await transcript(() =>
        service.uploadBatch(
            [
                { titulo: 'Duplicado', tipo: 'PDF', urlOrPath: '/uploads/dup.pdf', fileHash: 'hash-dup' },
                { titulo: 'Nuevo', tipo: 'PDF', urlOrPath: '/uploads/new.pdf', fileHash: 'hash-new' }
            ],
            { usuarioId: 2, rol: 'Admin' }
        )
    );
    assert.equal(result.created, 1);
    assert.equal(result.skipped, 1);
    assert.equal(result.materials.length, 1);
    assert.equal(result.materials[0].titulo, 'Nuevo');
    assert.deepEqual(result.skippedMaterials, [
        { id: 5, titulo: 'Existente', fileHash: 'hash-dup', reason: 'duplicate' }
    ]);
    assert.deepEqual(deleted, ['/uploads/dup.pdf']);
});

test('moderation service transitions a pending association atomically', async () => {
    const events = [];
    const repository = {
        async findAssociation() {
            return { estadoAprobacion: 'Pendiente' };
        },
        async approveAssociation() {
            events.push('approveAssociation');
            return true;
        },
        async markApproved() {
            events.push('markApproved');
            return true;
        },
        async findById() {
            return { id: 5, titulo: 'Material', autorId: 2 };
        }
    };
    const service = new MaterialModerationService({
        materialRepository: repository,
        subjectRepository: {
            findById: async () => ({ id: 7, nombre: 'Materia', profesorId: 8, hasProfessor: () => true })
        },
        subscriptionRepository,
        auditLogService
    });
    const result = await transcript(() => service.approveMaterial(5, 7, { usuarioId: 8, rol: 'Profesor' }));
    assert.equal(result.message, 'messages.materialApproved');
    assert.deepEqual(events, ['approveAssociation', 'markApproved']);
});

test('association service links an existing material and notifies subscribers', async () => {
    const associated = [];
    const service = new MaterialAssociationService({
        materialRepository: {
            async findById() {
                return { id: 5, titulo: 'Material', estado: 'Aprobado' };
            },
            async associateToSubject(materialId, subjectId) {
                associated.push({ materialId, subjectId });
            }
        },
        subjectRepository: {
            async findByIds(ids) {
                return ids.map((id) => ({ id, nombre: 'Materia', profesorId: 8, hasProfessor: () => true }));
            }
        },
        subscriptionRepository,
        auditLogService
    });
    const result = await transcript(() =>
        service.associateMaterialToSubjects(5, [7], { usuarioId: 8, rol: 'Profesor' })
    );
    assert.deepEqual(result.subjectIds, [7]);
    assert.deepEqual(associated, [{ materialId: 5, subjectId: 7 }]);
});

test('management service cancels a pending upload and deletes its stored file', async () => {
    const deleted = [];
    const service = new MaterialManagementService({
        materialRepository: {
            async findById() {
                return { id: 5, autorId: 2, estado: 'Pendiente', urlOrPath: '/uploads/pending.pdf' };
            },
            async cancelPendingUpload() {
                return true;
            }
        },
        auditLogService,
        fileStorage: { deleteStorageFile: async (path) => deleted.push(path) }
    });
    const result = await transcript(() => service.cancelPendingUpload(5, { usuarioId: 2, rol: 'Alumno' }));
    assert.equal(result.message, 'messages.materialCancelled');
    assert.deepEqual(deleted, ['/uploads/pending.pdf']);
});

test('catalog service marks favorites and delegates user flags', async () => {
    const service = new MaterialCatalogService({
        materialRepository: {
            async findAllGlobal() {
                return { items: [{ id: 5 }], total: 1 };
            },
            async findFavoriteIds() {
                return [5];
            }
        },
        gamificationService: {
            async getFlagsForMaterials(usuarioId, items) {
                return items.map((item) => ({ ...item, flags: { usuarioId } }));
            }
        }
    });
    const result = await service.getGlobalContent({}, 2);
    assert.equal(result.materials[0].esFavorito, 1);
    assert.equal(result.materials[0].flags.usuarioId, 2);
});

test('favorite service toggles a favorite and updates gamification', async () => {
    const events = [];
    const service = new MaterialFavoriteService({
        materialRepository: {
            async findById() {
                return { id: 5 };
            },
            async toggleFavorite() {
                return { favorited: true };
            }
        },
        gamificationService: {
            async onFavoriteChanged(usuarioId) {
                events.push(usuarioId);
            }
        }
    });
    const result = await service.toggleFavorite(5, 2);
    assert.equal(result.favorited, true);
    assert.deepEqual(events, [2]);
});

test('access service returns public material without authenticating', async () => {
    const service = new MaterialAccessService({
        materialRepository: {
            async findFileSourceById() {
                return { id: 5, estado: 'Aprobado', tipo: 'PDF', urlOrPath: '/uploads/material.pdf' };
            }
        }
    });
    let authenticated = false;
    const result = await service.getDownloadable(
        5,
        {},
        {
            authenticate: async () => {
                authenticated = true;
                return { usuarioId: 2, rol: 'Alumno' };
            }
        }
    );
    assert.equal(result.id, 5);
    assert.equal(authenticated, false);
});
