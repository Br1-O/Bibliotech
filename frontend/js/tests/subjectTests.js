/**
 * Project : Bibliotech | Frontend - Suite de pruebas
 * RF-02: materias, asociacion de profesores y material por materia.
 */

// --- Listado publico de materias ---
testUtils.createTestButton('Test Materias (GET /subjects, publico)', async () => {
    const r = await testUtils.request('/subjects');
    testUtils.log({ status: r.status, total: r.data && r.data.subjects.length });
    testUtils.assert(r.ok && r.data.subjects.length >= 3, 'Se esperaban al menos 3 materias semilla');
    testUtils.assert(r.data.subjects.some(s => s.nombre === 'Programacion I'), 'Falta la materia semilla');
});

// --- Detalle de materia ---
testUtils.createTestButton('Test Materia (GET /subjects/1)', async () => {
    const r = await testUtils.request('/subjects/1');
    testUtils.log({ status: r.status, subject: r.data && r.data.subject });
    testUtils.assert(r.ok && r.data.subject.nombre === 'Programacion I', 'Materia 1 inesperada');
});

// --- Materia inexistente ---
testUtils.createTestButton('Test Materia inexistente (404)', async () => {
    const r = await testUtils.request('/subjects/999999');
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 404, 'Se esperaba 404');
});

// --- Crear materia sin token ---
testUtils.createTestButton('Test Crear Materia sin token (401)', async () => {
    const r = await testUtils.request('/subjects', {
        method: 'POST', body: { nombre: 'Materia Fantasma' }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 401, 'Se esperaba 401');
});

// --- Crear materia como alumno (rol insuficiente) ---
testUtils.createTestButton('Test Crear Materia como Alumno (403)', async () => {
    const token = await testUtils.login(testUtils.accounts.alumno.email, testUtils.accounts.alumno.password);
    const r = await testUtils.request('/subjects', {
        method: 'POST', token, body: { nombre: 'Materia Prohibida' }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 403, 'Se esperaba 403');
});

// --- Crear materia como Superadmin (con profesor) ---
testUtils.createTestButton('Test Crear Materia como Superadmin (201)', async () => {
    const token = await testUtils.login(testUtils.accounts.admin.email, testUtils.accounts.admin.password);
    const r = await testUtils.request('/subjects', {
        method: 'POST', token,
        body: { nombre: testUtils.uniq('Materia'), descripcion: 'Creada por pruebas', profesorId: 2 }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message, subject: r.data && r.data.subject });
    testUtils.assert(r.status === 201, 'Se esperaba 201');
    testUtils.assert(r.data.subject.profesorId === 2, 'Profesor titular no asignado');
});

// --- Ciclo completo de asociacion (RF-02) ---
testUtils.createTestButton('Test Asociacion Materia (solicitar + confirmar)', async () => {
    const admin = await testUtils.login(testUtils.accounts.admin.email, testUtils.accounts.admin.password);
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);

    const creada = await testUtils.request('/subjects', {
        method: 'POST', token: admin, body: { nombre: testUtils.uniq('Asociable') }
    });
    testUtils.assert(creada.status === 201, 'No se pudo crear la materia base');
    const id = creada.data.subject.id;

    const solicitud = await testUtils.request(`/subjects/${id}/request-association`, {
        method: 'POST', token: profesor
    });
    testUtils.assert(solicitud.ok, 'Fallo la solicitud de asociacion');

    const pendiente = await testUtils.request(`/subjects/${id}`);
    testUtils.assert(pendiente.data.subject.estadoAsociacion === 'Pendiente', 'Estado esperado Pendiente');

    const confirmar = await testUtils.request(`/subjects/${id}/confirm-association`, {
        method: 'POST', token: admin, body: { profesorId: 2 }
    });
    testUtils.assert(confirmar.ok, 'Fallo la confirmacion');

    const final = await testUtils.request(`/subjects/${id}`);
    testUtils.log({ status: final.status, subject: final.data.subject });
    testUtils.assert(final.data.subject.profesorId === 2, 'La materia no quedo asociada al profesor');
    testUtils.assert(final.data.subject.estadoAsociacion === 'Activa', 'Estado esperado Activa');
});

// --- Material por materia ---
testUtils.createTestButton('Test Material por Materia (GET /subjects/1/materials)', async () => {
    const r = await testUtils.request('/subjects/1/materials');
    testUtils.log({ status: r.status, subject: r.data && r.data.subject && r.data.subject.nombre, total: r.data && r.data.materials.length });
    testUtils.assert(r.ok && Array.isArray(r.data.materials), 'Se esperaba {subject, materials}');
});
