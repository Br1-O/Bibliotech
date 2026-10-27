/**
 * Project : Bibliotech | Frontend - Suite de pruebas
 * RF-03: suscripcion de alumnos (patron Observer).
 * RF-05: baneo de alumnos por parte del profesor titular.
 */

/** Crea una materia nueva con el profesor semilla como titular. */
async function crearMateriaObserver() {
    const admin = await testUtils.login(testUtils.accounts.admin.email, testUtils.accounts.admin.password);
    const r = await testUtils.request('/subjects', {
        method: 'POST', token: admin,
        body: { nombre: testUtils.uniq('Materia Observer'), profesorId: 2 }
    });
    return r.data.subject.id;
}

/** Registra un alumno nuevo y devuelve { id, email, token }. */
async function crearAlumnoNuevo() {
    return testUtils.registerVerifiedAlumno('alumno-sus');
}

// --- Suscripcion + notificacion de observadores ---
testUtils.createTestButton('Test Suscripcion a Materia (Observer)', async () => {
    const materiaId = await crearMateriaObserver();
    const alumno = await crearAlumnoNuevo();

    const suscripcion = await testUtils.request(`/subscriptions/subscribe/${materiaId}`, {
        method: 'POST', token: alumno.token
    });
    testUtils.log({ status: suscripcion.status, message: suscripcion.data && suscripcion.data.message });
    testUtils.assert(suscripcion.status === 201, 'Se esperaba 201');

    const mias = await testUtils.request('/subscriptions/mine', { token: alumno.token });
    testUtils.assert(mias.data.subscriptions.some(s => (s.materiaId || s.materia_id) === materiaId), 'La suscripcion no figura en /mine');

    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const observadores = await testUtils.request(`/subscriptions/subject/${materiaId}/observers`, { token: profesor });
    testUtils.log({ observadores: observadores.data && observadores.data.observers });
    testUtils.assert(observadores.data.observers.some(o => o.alumnoId === alumno.id), 'El alumno no figura como observador');
});

// --- Desuscripcion ---
testUtils.createTestButton('Test Desuscripcion de Materia', async () => {
    const materiaId = await crearMateriaObserver();
    const alumno = await crearAlumnoNuevo();

    await testUtils.request(`/subscriptions/subscribe/${materiaId}`, { method: 'POST', token: alumno.token });
    const baja = await testUtils.request(`/subscriptions/subscribe/${materiaId}`, { method: 'DELETE', token: alumno.token });
    testUtils.log({ status: baja.status, message: baja.data && baja.data.message });
    testUtils.assert(baja.ok, 'Fallo la desuscripcion');

    const mias = await testUtils.request('/subscriptions/mine', { token: alumno.token });
    testUtils.assert(!mias.data.subscriptions.some(s => s.materia_id === materiaId || s.materiaId === materiaId), 'La materia sigue en /mine');
});

// --- Baneo de alumno (RF-05.1) ---
testUtils.createTestButton('Test Baneo de Alumno en Materia', async () => {
    const materiaId = await crearMateriaObserver();
    const alumno = await crearAlumnoNuevo();

    await testUtils.request(`/subscriptions/subscribe/${materiaId}`, { method: 'POST', token: alumno.token });
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);

    const ban = await testUtils.request(`/subscriptions/ban/${alumno.id}/${materiaId}`, {
        method: 'POST', token: profesor
    });
    testUtils.log({ status: ban.status, message: ban.data && ban.data.message });
    testUtils.assert(ban.ok, 'Fallo el baneo');

    const observadores = await testUtils.request(`/subscriptions/subject/${materiaId}/observers`, { token: profesor });
    testUtils.assert(!observadores.data.observers.some(o => o.alumnoId === alumno.id), 'El alumno baneado sigue como observador');

    const reintento = await testUtils.request(`/subscriptions/subscribe/${materiaId}`, {
        method: 'POST', token: alumno.token
    });
    testUtils.log({ reintento: reintento.status, message: reintento.data && reintento.data.message });
    testUtils.assert(reintento.status === 403, 'Un alumno baneado no deberia poder suscribirse');
});

// --- Un profesor no puede banear en materia ajena ---
testUtils.createTestButton('Test Baneo en Materia Ajena (403)', async () => {
    const materiaId = await crearMateriaObserver();
    const alumno = await crearAlumnoNuevo();
    await testUtils.request(`/subscriptions/subscribe/${materiaId}`, { method: 'POST', token: alumno.token });

    // El profesor semilla es titular; creamos otra materia sin profesor para probar el rechazo.
    const admin = await testUtils.login(testUtils.accounts.admin.email, testUtils.accounts.admin.password);
    const libre = await testUtils.request('/subjects', {
        method: 'POST', token: admin, body: { nombre: testUtils.uniq('Materia Libre') }
    });
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const r = await testUtils.request(`/subscriptions/ban/${alumno.id}/${libre.data.subject.id}`, {
        method: 'POST', token: profesor
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 403, 'Se esperaba 403');
});
