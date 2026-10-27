/**
 * Project : Bibliotech | Frontend - Suite de pruebas
 * RF-01/RD-06: administracion de usuarios, auditoria y recuperacion de clave.
 */

// --- Listado de usuarios (Superadmin) ---
testUtils.createTestButton('Test Admin: Listar Usuarios con Login Admin Correcto', async () => {
    const token = await testUtils.login(testUtils.accounts.admin.email, testUtils.accounts.admin.password);
    const r = await testUtils.request('/auth/users', { token });
    testUtils.log({ status: r.status, total: r.data && r.data.users.length });
    testUtils.assert(r.ok && r.data.users.length >= 3, 'Se esperaban al menos 3 usuarios');
});

// --- Creacion de profesor por el Superadmin ---
testUtils.createTestButton('Test Admin: Crear Profesor (201)', async () => {
    const token = await testUtils.login(testUtils.accounts.admin.email, testUtils.accounts.admin.password);
    const email = testUtils.uniq('profesor') + '@bibliotech.edu';
    const r = await testUtils.request('/auth/professors', {
        method: 'POST', token,
        body: { nombre: 'Nuevo', apellido: 'Profesor', email, password: 'Profesor123' }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message, user: r.data && r.data.user });
    testUtils.assert(r.status === 201, 'Se esperaba 201');
    testUtils.assert(r.data.user.roleNombre === 'Profesor', 'El usuario creado debe ser Profesor');
});

// --- Listar usuarios sin privilegios ---
testUtils.createTestButton('Test Admin: Usuarios prohibido para Alumno (403)', async () => {
    const token = await testUtils.login(testUtils.accounts.alumno.email, testUtils.accounts.alumno.password);
    const r = await testUtils.request('/auth/users', { token });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 403, 'Se esperaba 403');
});

// --- Auditoria (RD-06) ---
testUtils.createTestButton('Test Auditoria: Listar Logs (Superadmin)', async () => {
    const token = await testUtils.login(testUtils.accounts.admin.email, testUtils.accounts.admin.password);
    const r = await testUtils.request('/audit', { token });
    testUtils.log({ status: r.status, total: r.data && r.data.logs.length });
    testUtils.assert(r.ok && Array.isArray(r.data.logs), 'Se esperaba un listado de logs');
});

testUtils.createTestButton('Test Auditoria prohibida para Alumno (403)', async () => {
    const token = await testUtils.login(testUtils.accounts.alumno.email, testUtils.accounts.alumno.password);
    const r = await testUtils.request('/audit', { token });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 403, 'Se esperaba 403');
});

// --- Recuperacion de contrasena (RD-03) ---
testUtils.createTestButton('Test Recuperacion de Contrasena (token + reset + login)', async () => {
    const email = testUtils.uniq('reset') + '@bibliotech.edu';
    const reg = await testUtils.request('/auth/register', {
        method: 'POST', body: { nombre: 'Reset', apellido: 'Clave', email, password: 'Original123' }
    });
    testUtils.assert(reg.status === 201, 'Registro fallido');
    testUtils.assert(reg.data.devToken, 'La API no devolvio el token de activacion');
    await testUtils.activateAccount(reg.data.devToken);

    const solicitud = await testUtils.request('/auth/forgot-password', {
        method: 'POST', body: { email }
    });
    testUtils.log({ status: solicitud.status, message: solicitud.data && solicitud.data.message });
    const token = solicitud.data && solicitud.data.devToken;
    testUtils.assert(solicitud.ok && token, 'No se emitio token de recuperacion');

    const resetUrl = testUtils.apiBase.replace(/\/api\/?$/, '') + '/restablecer-password/' + encodeURIComponent(token);
    const resetPage = await fetch(resetUrl);
    testUtils.assert(resetPage.ok, 'El enlace de recuperacion no abrio el formulario');
    const validacion = await testUtils.request('/auth/reset-password/' + encodeURIComponent(token) + '/validate');
    testUtils.assert(validacion.ok && validacion.data.valid, 'El enlace de recuperacion no es valido');

    const cambio = await testUtils.request('/auth/reset-password', {
        method: 'POST', body: { token: token, password: 'Nueva1234', passwordConfirm: 'Nueva1234' }
    });
    testUtils.assert(cambio.ok, 'Fallo el cambio de contrasena');

    const login = await testUtils.login(email, 'Nueva1234');
    testUtils.assert(login, 'No se pudo iniciar sesion con la nueva contrasena');

    const reuso = await testUtils.request('/auth/reset-password', {
        method: 'POST', body: { token: token, password: 'Otra12345', passwordConfirm: 'Otra12345' }
    });
    testUtils.assert(reuso.status === 400, 'El token de recuperacion no deberia reutilizarse');
});
