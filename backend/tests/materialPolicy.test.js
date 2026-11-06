const test = require('node:test');
const assert = require('node:assert/strict');
const MaterialService = require('../application/services/MaterialService');
const MaterialPolicy = require('../domain/policies/MaterialPolicy');
const AppError = require('../utils/AppError');

function source(overrides = {}) {
    return {
        id: 10,
        autorId: 2,
        uploadedBy: 2,
        titulo: 'Material',
        tipo: 'PDF',
        urlOrPath: '/uploads/material.pdf',
        estado: 'Pendiente',
        ...overrides
    };
}

function serviceFor(material, { subjectIds = [], teaches = true } = {}) {
    const repository = {
        async findFileSourceById() {
            return material;
        },
        async findById() {
            return { ...material, materiasTodosIds: subjectIds };
        }
    };
    const subjects = {
        async findByIds(ids) {
            return ids.map((id) => ({ id, hasProfessor: () => teaches }));
        }
    };
    return new MaterialService(repository, subjects, null, null, null);
}

test('MaterialPolicy keeps approved files public and rejects unrelated users', () => {
    assert.equal(MaterialPolicy.canAccessFile(source({ estado: 'Aprobado' })), true);
    assert.equal(MaterialPolicy.canAccessFile(source(), { usuarioId: 3, rol: 'Alumno' }), false);
    assert.equal(MaterialPolicy.canAccessFile(source(), { usuarioId: 2, rol: 'Alumno' }), true);
    assert.equal(
        MaterialPolicy.canAccessFile(source(), { usuarioId: 3, rol: 'Profesor' }, { ownedSubjectIds: [9] }),
        true
    );
});

test('MaterialPolicy centralizes management, cancellation and moderation rules', () => {
    assert.equal(MaterialPolicy.canManage(source(), { usuarioId: 2, rol: 'Profesor' }), true);
    assert.equal(MaterialPolicy.canManage(source(), { usuarioId: 3, rol: 'Profesor' }, { ownedSubjectIds: [9] }), true);
    assert.equal(MaterialPolicy.canManage(source(), { usuarioId: 3, rol: 'Profesor' }), false);
    assert.equal(MaterialPolicy.canManage(source({ estado: 'Rechazado' }), { usuarioId: 2, rol: 'Profesor' }), false);
    assert.equal(MaterialPolicy.canManage(source(), { usuarioId: 1, rol: 'Superadmin' }), true);
    assert.equal(MaterialPolicy.canCancel(source(), { usuarioId: 2, rol: 'Alumno' }), true);
    assert.equal(MaterialPolicy.canCancel(source(), { usuarioId: 3, rol: 'Alumno' }), false);
    assert.equal(MaterialPolicy.canAssociate({ rol: 'Profesor' }), true);
    assert.equal(MaterialPolicy.canAssociate({ rol: 'Alumno' }), false);
    assert.equal(
        MaterialPolicy.canModerateSubject(
            { hasProfessor: (id) => Number(id) === 8 },
            { usuarioId: 8, rol: 'Profesor' }
        ),
        true
    );
    assert.equal(
        MaterialPolicy.canModerateSubject({ hasProfessor: () => false }, { usuarioId: 8, rol: 'Profesor' }),
        false
    );
    assert.equal(MaterialPolicy.canDeleteGlobally({ rol: 'Superadmin' }), true);
    assert.equal(MaterialPolicy.canDeleteGlobally({ rol: 'Profesor' }), false);
});

test('getDownloadable does not authenticate public files', async () => {
    const service = serviceFor(source({ estado: 'Aprobado' }));
    let authenticated = false;
    const material = await service.getDownloadable(
        10,
        {},
        {
            authenticate: async () => {
                authenticated = true;
                return { usuarioId: 9, rol: 'Alumno' };
            }
        }
    );
    assert.equal(material.id, 10);
    assert.equal(authenticated, false);
});

test('getDownloadable requires a session for pending files', async () => {
    const service = serviceFor(source());
    await assert.rejects(
        service.getDownloadable(
            10,
            {},
            {
                authenticate: async () => {
                    throw new AppError('errors.unauthorized', { status: 401 });
                }
            }
        ),
        (error) => error.status === 401
    );
});

test('getDownloadable lets the owner open a pending file', async () => {
    const service = serviceFor(source());
    const material = await service.getDownloadable(
        10,
        {},
        {
            authenticate: async () => ({ usuarioId: 2, rol: 'Alumno' })
        }
    );
    assert.equal(material.id, 10);
});

test('getDownloadable lets a professor open a pending file from a taught subject', async () => {
    const service = serviceFor(source(), { subjectIds: [5], teaches: true });
    const material = await service.getDownloadable(
        10,
        {},
        {
            authenticate: async () => ({ usuarioId: 8, rol: 'Profesor' })
        }
    );
    assert.equal(material.id, 10);
});

test('getDownloadable rejects a professor who does not teach the subject', async () => {
    const service = serviceFor(source(), { subjectIds: [5], teaches: false });
    await assert.rejects(
        service.getDownloadable(
            10,
            {},
            {
                authenticate: async () => ({ usuarioId: 8, rol: 'Profesor' })
            }
        ),
        (error) => error.status === 403
    );
});
