/**
 * Project : Bibliotech | Frontend - Suite de pruebas
 * RF-01: registro, autenticacion, perfil, roles y mensajes multilenguaje.
 */

// --- Login correcto ---
testUtils.createTestButton('Test Login Correcto (admin@bibliotech.edu / Admin123)', async () => {
    const r = await testUtils.request('/auth/login', {
        method: 'POST', body: testUtils.accounts.admin
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message, user: r.data && r.data.user });
    testUtils.assert(r.ok, 'Se esperaba 200');
    testUtils.assert(r.data.token, 'No se obtuvo token');
    testUtils.assert(r.data.user.roleNombre === 'Superadmin', 'Rol esperado Superadmin');
});

// --- Login con password incorrecta ---
testUtils.createTestButton('Test Login - Password Incorrecto (admin / ClaveMala)', async () => {
    const r = await testUtils.request('/auth/login', {
        method: 'POST', body: { email: 'admin@bibliotech.edu', password: 'ClaveMala123' }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 401, 'Se esperaba 401');
});

// --- Login con usuario inexistente ---
testUtils.createTestButton('Test Login - Usuario Incorrecto (nadie@bibliotech.edu)', async () => {
    const r = await testUtils.request('/auth/login', {
        method: 'POST', body: { email: 'nadie@bibliotech.edu', password: 'Alguna123' }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 401, 'Se esperaba 401');
});

// --- Registro publico de alumno ---
testUtils.createTestButton('Test Registro de Alumno Nuevo (201)', async () => {
    const email = testUtils.uniq('alumno') + '@bibliotech.edu';
    const r = await testUtils.request('/auth/register', {
        method: 'POST',
        body: { nombre: 'Nueva', apellido: 'Alumna', email, password: 'Alumna123' }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message, user: r.data && r.data.user });
    testUtils.assert(r.status === 201, 'Se esperaba 201');
    testUtils.assert(r.data.user && r.data.user.email === email, 'Email de registro incorrecto');
    testUtils.assert(r.data.user.roleNombre === 'Alumno', 'El registro publico debe crear Alumno');
});

// --- Registro con email duplicado ---
testUtils.createTestButton('Test Registro - Email Duplicado (409)', async () => {
    const r = await testUtils.request('/auth/register', {
        method: 'POST',
        body: { nombre: 'Otra', apellido: 'Persona', email: testUtils.accounts.alumno.email, password: 'Alumna123' }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 409, 'Se esperaba 409');
});

// --- Validacion de datos invalidos ---
testUtils.createTestButton('Test Registro - Validacion (password debil, 422)', async () => {
    const r = await testUtils.request('/auth/register', {
        method: 'POST',
        body: { nombre: 'X', apellido: 'Y', email: 'mal-correo', password: '1' }
    });
    testUtils.log({ status: r.status, errors: r.data && r.data.errors });
    testUtils.assert(r.status === 422, 'Se esperaba 422');
    testUtils.assert(Array.isArray(r.data.errors) && r.data.errors.length >= 2, 'Se esperaban varios errores');
});

// --- Perfil autenticado ---
testUtils.createTestButton('Test Perfil (GET /auth/me con token)', async () => {
    const token = await testUtils.login(testUtils.accounts.alumno.email, testUtils.accounts.alumno.password);
    testUtils.assert(token, 'Login de alumno fallido');
    const r = await testUtils.request('/auth/me', { token });
    testUtils.log({ status: r.status, user: r.data && r.data.user });
    testUtils.assert(r.ok, 'Se esperaba 200');
    testUtils.assert(r.data.user.email === testUtils.accounts.alumno.email, 'Email de perfil incorrecto');
});

// --- Perfil sin token ---
testUtils.createTestButton('Test Perfil sin token (401)', async () => {
    const r = await testUtils.request('/auth/me');
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 401, 'Se esperaba 401');
});

// --- Listado de roles (RF-01) ---
testUtils.createTestButton('Test Roles (GET /auth/roles)', async () => {
    const r = await testUtils.request('/auth/roles');
    testUtils.log({ status: r.status, roles: r.data && r.data.roles });
    testUtils.assert(r.ok && r.data.roles.length === 3, 'Se esperaban 3 roles');
});

// --- Multilenguaje de mensajes de validacion (RNF-06) ---
testUtils.createTestButton('Test i18n - Mensaje de error en ES y EN', async () => {
    const es = await testUtils.request('/auth/login', {
        method: 'POST', body: { email: 'x', password: 'y' }, lang: 'es'
    });
    const en = await testUtils.request('/auth/login', {
        method: 'POST', body: { email: 'x', password: 'y' }, lang: 'en'
    });
    testUtils.log({ es: es.data && es.data.message, en: en.data && en.data.message });
    testUtils.assert(es.status === 401 && en.status === 401, 'Se esperaba 401 en ambos idiomas');
    testUtils.assert(es.data.message !== en.data.message, 'El mensaje deberia cambiar segun el idioma');
});
