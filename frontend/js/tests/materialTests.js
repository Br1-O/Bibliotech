/**
 * Project : Bibliotech | Frontend - Suite de pruebas
 * RF-04: subida, sugerencia, control de duplicados por hash, vista global,
 * asociacion a materias y borrado condicional (RD-04).
 */

// --- Subida de material como Profesor ---
testUtils.createTestButton('Test Subir Material como Profesor (201)', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subjectId = await testUtils.professorSubject();
    const form = testUtils.pdfForm({
        titulo: testUtils.uniq('Material Profesor'), tipo: 'PDF', subjects: String(subjectId), categories: 'algoritmos,intro'
    }, testUtils.uniq('pdf-profesor'));

    const r = await testUtils.request('/materials/upload', { method: 'POST', token, form });
    testUtils.log({ status: r.status, message: r.data && r.data.message, material: r.data && r.data.material });
    testUtils.assert(r.status === 201, 'Se esperaba 201');
    testUtils.assert(r.data.material.estado === 'Aprobado', 'El material de profesor debe quedar Aprobado');
});

// --- Control de unicidad por hash (RD-05) ---
testUtils.createTestButton('Test Subida Duplicada por Hash (Profesor)', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subjectId = await testUtils.professorSubject();
    const contenido = testUtils.uniq('pdf-unico'); // mismo contenido para ambos intentos

    const primera = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({ titulo: 'Original', tipo: 'PDF', subjects: String(subjectId) }, contenido)
    });
    const segunda = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({ titulo: 'Duplicado', tipo: 'PDF', subjects: String(subjectId) }, contenido)
    });
    testUtils.log({ primera: primera.data && primera.data.message, segunda: segunda.data && segunda.data.message });
    testUtils.assert(primera.status === 201, 'La primera subida debia ser 201');
    testUtils.assert(segunda.ok, 'La segunda subida debia reconocer el duplicado');
    testUtils.assert(segunda.data.material.id === primera.data.material.id, 'Deberia reutilizar el material existente');
});

// --- Vista global de contenido (RF-04.1) ---
testUtils.createTestButton('Test Vista Global de Contenido', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subjectId = await testUtils.professorSubject();
    const titulo = testUtils.uniq('Material Global');
    await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({ titulo, tipo: 'PDF', subjects: String(subjectId) }, testUtils.uniq('pdf-global'))
    });

    const r = await testUtils.request('/materials/global');
    testUtils.log({ status: r.status, total: r.data && r.data.materials.length });
    testUtils.assert(r.ok, 'Se esperaba 200');
    testUtils.assert(r.data.materials.some(m => m.titulo === titulo), 'El material nuevo no aparece en la vista global');
});

// --- Sugerencia de material como Alumno ---
testUtils.createTestButton('Test Sugerir Material como Alumno (pendiente)', async () => {
    const { token } = await testUtils.registerVerifiedAlumno('alumno-mat');
    const subjectId = await testUtils.professorSubject();

    const r = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({ titulo: testUtils.uniq('Sugerencia Alumno'), tipo: 'PDF', subjects: String(subjectId) }, testUtils.uniq('pdf-alumno'))
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message, estado: r.data && r.data.material.estado });
    testUtils.assert(r.status === 201, 'Se esperaba 201');
    testUtils.assert(r.data.material.estado === 'Pendiente', 'El material de alumno debe quedar Pendiente');

    const pendientes = await testUtils.request('/materials/pending', { token });
    testUtils.assert(pendientes.data.materials.some(m => m.id === r.data.material.id), 'No aparece en pendientes del alumno');
});

// --- Aprobacion de material sugerido (RF-05) ---
testUtils.createTestButton('Test Aprobacion de Material Sugerido', async () => {
    const { token: alumno } = await testUtils.registerVerifiedAlumno('alumno-apr');
    const subjectId = await testUtils.professorSubject();
    const titulo = testUtils.uniq('Sugerencia Aprobar');
    const subida = await testUtils.request('/materials/upload', {
        method: 'POST', token: alumno,
        form: testUtils.pdfForm({ titulo, tipo: 'PDF', subjects: String(subjectId) }, testUtils.uniq('pdf-aprob'))
    });
    const id = subida.data.material.id;

    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const revision = await testUtils.request('/materials/pending-review', { token: profesor });
    testUtils.assert(revision.data.materials.some(m => m.id === id), 'No aparece en pending-review del profesor');

    const aprobar = await testUtils.request(`/materials/${id}/approve`, {
        method: 'POST', token: profesor, body: { subjectId }
    });
    testUtils.log({ status: aprobar.status, message: aprobar.data && aprobar.data.message });
    testUtils.assert(aprobar.ok, 'Fallo la aprobacion');

    const global = await testUtils.request('/materials/global');
    testUtils.assert(global.data.materials.some(m => m.id === id), 'El material aprobado no aparece en la vista global');
});

// --- Rechazo de material sugerido ---
testUtils.createTestButton('Test Rechazo de Material Sugerido', async () => {
    const { token: alumno } = await testUtils.registerVerifiedAlumno('alumno-rej');
    const subjectId = await testUtils.professorSubject();
    const subida = await testUtils.request('/materials/upload', {
        method: 'POST', token: alumno,
        form: testUtils.pdfForm({ titulo: testUtils.uniq('Sugerencia Rechazar'), tipo: 'PDF', subjects: String(subjectId) }, testUtils.uniq('pdf-rech'))
    });

    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const r = await testUtils.request(`/materials/${subida.data.material.id}/reject`, {
        method: 'POST', token: profesor, body: { subjectId }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.ok, 'Se esperaba el rechazo exitoso');
});

// --- Asociar material existente a otra materia propia ---
testUtils.createTestButton('Test Asociar Material Existente a otra Materia', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subjectId = await testUtils.professorSubject();
    const otraMateria = await testUtils.createProfessorSubject('Materia Destino');
    const titulo = testUtils.uniq('Material a Asociar');
    const subida = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({ titulo, tipo: 'PDF', subjects: String(subjectId) }, testUtils.uniq('pdf-asoc'))
    });
    const id = subida.data.material.id;

    const r = await testUtils.request(`/materials/${id}/associate`, {
        method: 'POST', token, body: { subjectId: otraMateria }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.ok, 'Fallo la asociacion');

    const materia2 = await testUtils.request(`/subjects/${otraMateria}/materials`);
    testUtils.assert(materia2.data.materials.some(m => m.id === id), 'El material no quedo asociado a la materia destino');
});

// --- Borrado condicional (RD-04) ---
testUtils.createTestButton('Test Alumno no puede borrar material (403)', async () => {
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subjectId = await testUtils.professorSubject();
    const subida = await testUtils.request('/materials/upload', {
        method: 'POST', token: profesor,
        form: testUtils.pdfForm({ titulo: testUtils.uniq('No Borrable'), tipo: 'PDF', subjects: String(subjectId) }, testUtils.uniq('pdf-nobor'))
    });

    const alumno = await testUtils.login(testUtils.accounts.alumno.email, testUtils.accounts.alumno.password);
    const r = await testUtils.request(`/materials/${subida.data.material.id}`, { method: 'DELETE', token: alumno });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 403, 'Se esperaba 403');
});

testUtils.createTestButton('Test Profesor borra material de su materia', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subjectId = await testUtils.professorSubject();
    const subida = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({ titulo: testUtils.uniq('Para Borrar'), tipo: 'PDF', subjects: String(subjectId) }, testUtils.uniq('pdf-borrar'))
    });

    const global = await testUtils.request(`/materials/${subida.data.material.id}`, { method: 'DELETE', token });
    testUtils.assert(global.status === 403, 'El profesor no debe borrar el material del catalogo global');

    const r = await testUtils.request(`/materials/${subida.data.material.id}/subjects/${subjectId}`, { method: 'DELETE', token });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.ok && r.data.deleted === false, 'Se esperaba la desasociacion exitosa');
});

// --- Edicion y desasociacion por materia (requisito nuevo) ---
testUtils.createTestButton('Test Profesor edita titulo y descripcion de material', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subjectId = await testUtils.professorSubject();
    const subida = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({ titulo: testUtils.uniq('Editar'), tipo: 'PDF', subjects: String(subjectId) }, testUtils.uniq('pdf-edit'))
    });
    const id = subida.data.material.id;
    const nuevoTitulo = testUtils.uniq('Editado');
    const r = await testUtils.request(`/materials/${id}`, {
        method: 'PUT', token, body: { titulo: nuevoTitulo, descripcion: 'Descripcion editada' }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.ok, 'Se esperaba 200');
    testUtils.assert(r.data.material && r.data.material.titulo === nuevoTitulo, 'El titulo no se actualizo');
});

testUtils.createTestButton('Test Profesor asocia material a varias materias', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subjectId = await testUtils.professorSubject();
    const destinoA = await testUtils.createProfessorSubject('Destino Multiple A');
    const destinoB = await testUtils.createProfessorSubject('Destino Multiple B');
    const upload = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({ titulo: testUtils.uniq('Asociacion Multiple'), tipo: 'PDF', subjects: String(subjectId) }, testUtils.uniq('pdf-multiple'))
    });
    const id = upload.data.material.id;

    const r = await testUtils.request(`/materials/${id}/associate`, {
        method: 'POST', token, body: { subjectIds: [destinoA, destinoB] }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message, subjectIds: r.data && r.data.subjectIds });
    testUtils.assert(r.ok, 'Fallo la asociacion multiple');
    testUtils.assert(r.data.subjectIds.length === 2, 'No se confirmaron las dos materias');

    for (const subjectIdDestino of [destinoA, destinoB]) {
        const materiales = await testUtils.request(`/subjects/${subjectIdDestino}/materials`);
        testUtils.assert(materiales.data.materials.some(m => m.id === id), 'El material no quedo en una materia destino');
    }
});

testUtils.createTestButton('Test Alumno no puede asociar material (403)', async () => {
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subjectId = await testUtils.professorSubject();
    const destino = await testUtils.createProfessorSubject('Destino Bloqueado Alumno');
    const upload = await testUtils.request('/materials/upload', {
        method: 'POST', token: profesor,
        form: testUtils.pdfForm({ titulo: testUtils.uniq('Bloqueo Alumno'), tipo: 'PDF', subjects: String(subjectId) }, testUtils.uniq('pdf-bloqueo-alumno'))
    });
    const alumno = await testUtils.login(testUtils.accounts.alumno.email, testUtils.accounts.alumno.password);

    const r = await testUtils.request(`/materials/${upload.data.material.id}/associate`, {
        method: 'POST', token: alumno, body: { subjectIds: [destino] }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 403, 'El alumno no debe poder asociar material');
});

testUtils.createTestButton('Test Admin no puede asociar material (403)', async () => {
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subjectId = await testUtils.professorSubject();
    const destino = await testUtils.createProfessorSubject('Destino Bloqueado Admin');
    const upload = await testUtils.request('/materials/upload', {
        method: 'POST', token: profesor,
        form: testUtils.pdfForm({ titulo: testUtils.uniq('Bloqueo Admin'), tipo: 'PDF', subjects: String(subjectId) }, testUtils.uniq('pdf-bloqueo-admin'))
    });
    const admin = await testUtils.login(testUtils.accounts.admin.email, testUtils.accounts.admin.password);

    const r = await testUtils.request(`/materials/${upload.data.material.id}/associate`, {
        method: 'POST', token: admin, body: { subjectIds: [destino] }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 403, 'El admin no debe poder asociar material');
});

testUtils.createTestButton('Test Profesor no asocia a materia ajena ni parcialmente', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subjectId = await testUtils.professorSubject();
    const destinoPropio = await testUtils.createProfessorSubject('Destino Propio Parcial');
    const materiaAjena = await testUtils.createUnassignedSubject('Materia Ajena');
    const upload = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({ titulo: testUtils.uniq('Asociacion Ajena'), tipo: 'PDF', subjects: String(subjectId) }, testUtils.uniq('pdf-ajena'))
    });
    const id = upload.data.material.id;

    const r = await testUtils.request(`/materials/${id}/associate`, {
        method: 'POST', token, body: { subjectIds: [destinoPropio, materiaAjena] }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 403, 'Debe rechazar una materia ajena');

    const propias = await testUtils.request(`/subjects/${destinoPropio}/materials`);
    testUtils.assert(!propias.data.materials.some(m => m.id === id), 'No debe asociar parcialmente antes de fallar');
});

testUtils.createTestButton('Test Profesor no sube material a materia ajena (403)', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const materiaAjena = await testUtils.createUnassignedSubject('Destino Subida Ajena');

    const r = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({
            titulo: testUtils.uniq('Subida Ajena'), tipo: 'PDF', subjects: String(materiaAjena)
        }, testUtils.uniq('pdf-subida-ajena'))
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 403, 'El profesor no debe publicar en una materia ajena');
});

testUtils.createTestButton('Test Filtro de etiquetas requiere todas (AND)', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subjectId = await testUtils.professorSubject();
    const alpha = testUtils.uniq('TagAlpha');
    const beta = testUtils.uniq('TagBeta');
    const gamma = testUtils.uniq('TagGamma');

    const primero = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({
            titulo: testUtils.uniq('Filtro Etiquetas A'), tipo: 'PDF',
            subjects: String(subjectId), categories: `${alpha},${beta}`
        }, testUtils.uniq('pdf-tag-a'))
    });
    const segundo = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({
            titulo: testUtils.uniq('Filtro Etiquetas B'), tipo: 'PDF',
            subjects: String(subjectId), categories: `${alpha},${gamma}`
        }, testUtils.uniq('pdf-tag-b'))
    });

    const ambas = await testUtils.request(`/materials/global?tags=${encodeURIComponent(`${alpha},${beta}`)}`);
    const ids = () => ambas.data.materials.map(m => m.id).filter(id => [primero.data.material.id, segundo.data.material.id].includes(id));
    testUtils.log({ status: ambas.status, encontrados: ids() });
    testUtils.assert(ambas.ok, 'Se esperaba 200 al filtrar por etiquetas');
    testUtils.assert(ids().length === 1 && ids()[0] === primero.data.material.id, 'El filtro AND no excluyo el material sin todas las etiquetas');

    const soloAlpha = await testUtils.request(`/materials/global?tags=${encodeURIComponent(alpha)}`);
    const encontradosAlpha = soloAlpha.data.materials.map(m => m.id).filter(id => [primero.data.material.id, segundo.data.material.id].includes(id));
    testUtils.assert(encontradosAlpha.length === 2, 'El filtro por una sola etiqueta no devolvio ambos materiales');
});
