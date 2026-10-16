/**
 * Project : Bibliotech | Frontend - Suite de pruebas
 * RF-04: subida, sugerencia, control de duplicados por hash, vista global,
 * asociacion a materias y borrado condicional (RD-04).
 */

// --- Subida de material como Profesor ---
testUtils.createTestButton('Test Subir Material como Profesor (201)', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const form = testUtils.pdfForm({
        titulo: testUtils.uniq('Material Profesor'), tipo: 'PDF', subjects: '1', categories: 'algoritmos,intro'
    }, testUtils.uniq('pdf-profesor'));

    const r = await testUtils.request('/materials/upload', { method: 'POST', token, form });
    testUtils.log({ status: r.status, message: r.data && r.data.message, material: r.data && r.data.material });
    testUtils.assert(r.status === 201, 'Se esperaba 201');
    testUtils.assert(r.data.material.estado === 'Aprobado', 'El material de profesor debe quedar Aprobado');
});

// --- Control de unicidad por hash (RD-05) ---
testUtils.createTestButton('Test Subida Duplicada por Hash (Profesor)', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const contenido = testUtils.uniq('pdf-unico'); // mismo contenido para ambos intentos

    const primera = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({ titulo: 'Original', tipo: 'PDF', subjects: '1' }, contenido)
    });
    const segunda = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({ titulo: 'Duplicado', tipo: 'PDF', subjects: '1' }, contenido)
    });
    testUtils.log({ primera: primera.data && primera.data.message, segunda: segunda.data && segunda.data.message });
    testUtils.assert(primera.status === 201, 'La primera subida debia ser 201');
    testUtils.assert(segunda.ok, 'La segunda subida debia reconocer el duplicado');
    testUtils.assert(segunda.data.material.id === primera.data.material.id, 'Deberia reutilizar el material existente');
});

// --- Vista global de contenido (RF-04.1) ---
testUtils.createTestButton('Test Vista Global de Contenido', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const titulo = testUtils.uniq('Material Global');
    await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({ titulo, tipo: 'PDF', subjects: '1' }, testUtils.uniq('pdf-global'))
    });

    const r = await testUtils.request('/materials/global');
    testUtils.log({ status: r.status, total: r.data && r.data.materials.length });
    testUtils.assert(r.ok, 'Se esperaba 200');
    testUtils.assert(r.data.materials.some(m => m.titulo === titulo), 'El material nuevo no aparece en la vista global');
});

// --- Sugerencia de material como Alumno ---
testUtils.createTestButton('Test Sugerir Material como Alumno (pendiente)', async () => {
    const email = testUtils.uniq('alumno-mat') + '@bibliotech.edu';
    await testUtils.request('/auth/register', {
        method: 'POST', body: { nombre: 'Sugiere', apellido: 'Alumno', email, password: 'Alumno123' }
    });
    const token = await testUtils.login(email, 'Alumno123');

    const r = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({ titulo: testUtils.uniq('Sugerencia Alumno'), tipo: 'PDF', subjects: '1' }, testUtils.uniq('pdf-alumno'))
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message, estado: r.data && r.data.material.estado });
    testUtils.assert(r.status === 201, 'Se esperaba 201');
    testUtils.assert(r.data.material.estado === 'Pendiente', 'El material de alumno debe quedar Pendiente');

    const pendientes = await testUtils.request('/materials/pending', { token });
    testUtils.assert(pendientes.data.materials.some(m => m.id === r.data.material.id), 'No aparece en pendientes del alumno');
});

// --- Aprobacion de material sugerido (RF-05) ---
testUtils.createTestButton('Test Aprobacion de Material Sugerido', async () => {
    const email = testUtils.uniq('alumno-apr') + '@bibliotech.edu';
    await testUtils.request('/auth/register', {
        method: 'POST', body: { nombre: 'Apro', apellido: 'Alumno', email, password: 'Alumno123' }
    });
    const alumno = await testUtils.login(email, 'Alumno123');
    const titulo = testUtils.uniq('Sugerencia Aprobar');
    const subida = await testUtils.request('/materials/upload', {
        method: 'POST', token: alumno,
        form: testUtils.pdfForm({ titulo, tipo: 'PDF', subjects: '1' }, testUtils.uniq('pdf-aprob'))
    });
    const id = subida.data.material.id;

    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const revision = await testUtils.request('/materials/pending-review', { token: profesor });
    testUtils.assert(revision.data.materials.some(m => m.id === id), 'No aparece en pending-review del profesor');

    const aprobar = await testUtils.request(`/materials/${id}/approve`, {
        method: 'POST', token: profesor, body: { subjectId: 1 }
    });
    testUtils.log({ status: aprobar.status, message: aprobar.data && aprobar.data.message });
    testUtils.assert(aprobar.ok, 'Fallo la aprobacion');

    const global = await testUtils.request('/materials/global');
    testUtils.assert(global.data.materials.some(m => m.id === id), 'El material aprobado no aparece en la vista global');
});

// --- Rechazo de material sugerido ---
testUtils.createTestButton('Test Rechazo de Material Sugerido', async () => {
    const email = testUtils.uniq('alumno-rej') + '@bibliotech.edu';
    await testUtils.request('/auth/register', {
        method: 'POST', body: { nombre: 'Rech', apellido: 'Alumno', email, password: 'Alumno123' }
    });
    const alumno = await testUtils.login(email, 'Alumno123');
    const subida = await testUtils.request('/materials/upload', {
        method: 'POST', token: alumno,
        form: testUtils.pdfForm({ titulo: testUtils.uniq('Sugerencia Rechazar'), tipo: 'PDF', subjects: '1' }, testUtils.uniq('pdf-rech'))
    });

    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const r = await testUtils.request(`/materials/${subida.data.material.id}/reject`, {
        method: 'POST', token: profesor, body: { subjectId: 1 }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.ok, 'Se esperaba el rechazo exitoso');
});

// --- Asociar material existente a otra materia propia ---
testUtils.createTestButton('Test Asociar Material Existente a otra Materia', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const titulo = testUtils.uniq('Material a Asociar');
    const subida = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({ titulo, tipo: 'PDF', subjects: '1' }, testUtils.uniq('pdf-asoc'))
    });
    const id = subida.data.material.id;

    const r = await testUtils.request(`/materials/${id}/associate`, {
        method: 'POST', token, body: { subjectId: 2 }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.ok, 'Fallo la asociacion');

    const materia2 = await testUtils.request('/subjects/2/materials');
    testUtils.assert(materia2.data.materials.some(m => m.id === id), 'El material no quedo asociado a la materia 2');
});

// --- Borrado condicional (RD-04) ---
testUtils.createTestButton('Test Alumno no puede borrar material (403)', async () => {
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subida = await testUtils.request('/materials/upload', {
        method: 'POST', token: profesor,
        form: testUtils.pdfForm({ titulo: testUtils.uniq('No Borrable'), tipo: 'PDF', subjects: '1' }, testUtils.uniq('pdf-nobor'))
    });

    const alumno = await testUtils.login(testUtils.accounts.alumno.email, testUtils.accounts.alumno.password);
    const r = await testUtils.request(`/materials/${subida.data.material.id}`, { method: 'DELETE', token: alumno });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 403, 'Se esperaba 403');
});

testUtils.createTestButton('Test Profesor borra material de su materia', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subida = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({ titulo: testUtils.uniq('Para Borrar'), tipo: 'PDF', subjects: '1' }, testUtils.uniq('pdf-borrar'))
    });

    const r = await testUtils.request(`/materials/${subida.data.material.id}`, { method: 'DELETE', token });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.ok, 'Se esperaba el borrado exitoso');
});

// --- Edicion y desasociacion por materia (requisito nuevo) ---
testUtils.createTestButton('Test Profesor edita titulo y descripcion de material', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subida = await testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({ titulo: testUtils.uniq('Editar'), tipo: 'PDF', subjects: '1' }, testUtils.uniq('pdf-edit'))
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
