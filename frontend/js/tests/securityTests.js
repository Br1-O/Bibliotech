/**
 * Project : Bibliotech | Frontend - Suite de pruebas
 * Fase 0: DTOs publicos, revocacion de tokens, ownership y descargas seguras.
 */

function securityBaseUrl() {
    return testUtils.apiBase.replace(/\/api\/?$/, '');
}

async function securityAdminToken() {
    const token = await testUtils.login(testUtils.accounts.admin.email, testUtils.accounts.admin.password);
    testUtils.assert(token, 'No se pudo iniciar sesion como admin');
    return token;
}

async function securityApprovedMaterial(token, subjectId, suffix) {
    const form = testUtils.pdfForm({
        titulo: testUtils.uniq(suffix || 'Material Seguridad'),
        tipo: 'PDF',
        subjects: String(subjectId),
        pages: '10'
    }, testUtils.uniq('pdf-seguridad'));
    form.append('portada', testUtils.pngBlob(testUtils.uniq('portada-seguridad')), 'portada.png');
    const uploaded = await testUtils.request('/materials/upload', { method: 'POST', token, form });
    testUtils.assert(uploaded.status === 201, 'No se pudo preparar el material de seguridad');
    return uploaded.data.material;
}

testUtils.createTestButton('Test Seguridad: cabeceras y endpoints operativos', async () => {
    const base = securityBaseUrl();
    const health = await fetch(base + '/healthz');
    testUtils.assert(health.ok, 'Healthz no respondio 200');
    testUtils.assert(!health.headers.get('x-powered-by'), 'La cabecera X-Powered-By sigue expuesta');
    testUtils.assert(health.headers.get('content-security-policy'), 'Falta Content-Security-Policy');
    testUtils.assert(health.headers.get('x-content-type-options') === 'nosniff', 'Falta X-Content-Type-Options');

    const metricsResponse = await fetch(base + '/metrics');
    testUtils.assert(metricsResponse.ok, 'Metrics no respondio 200');
    const metricsText = await metricsResponse.text();
    testUtils.assert(metricsText.includes('http_requests_total'), 'Metrics no expone contadores HTTP');
});

testUtils.createTestButton('Test Seguridad: DTO publico sin datos privados', async () => {
    const author = await testUtils.request('/materials/author/2');
    testUtils.assert(author.ok, 'No se pudo consultar el autor publico');
    testUtils.assert(author.data.author.email === undefined, 'El autor publico expone email');
    testUtils.assert(author.data.author.estado === undefined, 'El autor publico expone estado');
    testUtils.assert(author.data.author.phone === undefined, 'El autor publico expone telefono');

    const publicProfile = await testUtils.request('/profile/2');
    testUtils.assert(publicProfile.ok, 'No se pudo consultar el perfil publico');
    testUtils.assert(publicProfile.data.user.email === undefined, 'El perfil publico expone email');

    const alumno = await testUtils.registerVerifiedAlumno('seguridad-perfil');
    const ownProfile = await testUtils.request(`/profile/${alumno.id}`, { token: alumno.token });
    testUtils.assert(ownProfile.ok && ownProfile.data.user.email === alumno.email, 'El perfil propio debe conservar el email');
});

testUtils.createTestButton('Test Seguridad: ownership de favoritos, lecturas y backlog', async () => {
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const alumno = await testUtils.registerVerifiedAlumno('seguridad-ownership');

    const anonymous = await testUtils.request('/users/2/favorites');
    testUtils.assert(anonymous.status === 401, 'Favoritos ajenos debe exigir autenticacion');

    const forbidden = await testUtils.request('/users/2/favorites', { token: alumno.token });
    testUtils.assert(forbidden.status === 403, 'Un alumno no debe leer favoritos ajenos');

    const own = await testUtils.request('/users/2/favorites', { token: profesor });
    testUtils.assert(own.ok, 'El propietario debe leer sus favoritos');

    const reads = await testUtils.request('/users/2/reads', { token: alumno.token });
    testUtils.assert(reads.status === 403, 'Un alumno no debe leer lecturas ajenas');
    const backlog = await testUtils.request('/users/2/backlog', { token: alumno.token });
    testUtils.assert(backlog.status === 403, 'Un alumno no debe leer el backlog ajeno');

    const uploads = await testUtils.request('/users/2/uploads');
    testUtils.assert(uploads.ok, 'Las subidas publicas deben seguir accesibles');
});

testUtils.createTestButton('Test Seguridad: descargas de aprobados y /uploads bloqueado', async () => {
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subjectId = await testUtils.professorSubject();
    const material = await securityApprovedMaterial(profesor, subjectId, 'Material Descarga');
    const base = securityBaseUrl();

    const anonymous = await testUtils.fileFetch(material, null);
    testUtils.assert(anonymous.ok, 'Un material aprobado debe abrirse sin sesion');
    const anonymousDownload = await testUtils.fileFetch(material, null, 'download');
    testUtils.assert(anonymousDownload.ok, 'Un material aprobado debe descargarse sin sesion');
    testUtils.assert(String(anonymousDownload.headers.get('content-disposition') || '').includes('attachment'), 'La descarga anonima no usa attachment');

    const direct = await fetch(base + material.urlOrPath);
    testUtils.assert(direct.status === 404, 'Los documentos no deben servirse desde /uploads');

    const file = await testUtils.fileFetch(material, profesor, 'file');
    testUtils.assert(file.ok, 'El propietario no pudo abrir el archivo');
    testUtils.assert(file.headers.get('x-content-type-options') === 'nosniff', 'Falta nosniff en el archivo');

    const download = await testUtils.fileFetch(material, profesor, 'download');
    testUtils.assert(download.ok, 'El propietario no pudo descargar el archivo');
    testUtils.assert(String(download.headers.get('content-disposition') || '').includes('attachment'), 'La descarga no usa attachment');

    const cover = await fetch(base + material.portada);
    testUtils.assert(cover.ok, 'La portada publica no se sirve');

    const otro = await testUtils.registerVerifiedAlumno('seguridad-descarga');
    const pendingForm = testUtils.pdfForm({
        titulo: testUtils.uniq('Sugerencia Seguridad'),
        tipo: 'PDF',
        subjects: String(subjectId)
    }, testUtils.uniq('pdf-sugerencia-seguridad'));
    const pending = await testUtils.request('/materials/upload', { method: 'POST', token: otro.token, form: pendingForm });
    testUtils.assert(pending.status === 201, 'No se pudo crear la sugerencia de seguridad');
    const suggestion = pending.data.material;

    const anonymousSuggestion = await testUtils.fileFetch(suggestion, null);
    testUtils.assert(anonymousSuggestion.status === 403, 'Una sugerencia pendiente no debe abrirse sin sesion');
    const ownerFile = await testUtils.fileFetch(suggestion, otro.token);
    testUtils.assert(ownerFile.ok, 'El autor de una sugerencia debe abrir su archivo');
    const ownerLogin = await fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otro.email, password: otro.password })
    });
    const ownerCookie = String(ownerLogin.headers.get('set-cookie') || '').split(';')[0];
    const ownerViaCookie = await fetch(base + `/api/materials/${suggestion.id}/file`, {
        headers: { Cookie: ownerCookie }
    });
    testUtils.assert(ownerViaCookie.ok, 'La cookie del autor debe abrir su sugerencia en una pestana nueva');
    const thirdParty = await testUtils.registerVerifiedAlumno('seguridad-tercero');
    const forbidden = await testUtils.fileFetch(suggestion, thirdParty.token);
    testUtils.assert(forbidden.status === 403, 'Un tercero no debe abrir sugerencias ajenas');

    const cancelled = await testUtils.request(`/materials/${suggestion.id}/cancel`, { method: 'POST', token: otro.token });
    testUtils.assert(cancelled.ok, 'No se pudo cancelar la sugerencia');
    const gone = await testUtils.fileFetch(suggestion, otro.token);
    testUtils.assert(gone.status === 404, 'El archivo cancelado debe devolver 404');
});

testUtils.createTestButton('Test Seguridad: cookie HttpOnly y rangos para visor PDF', async () => {
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subjectId = await testUtils.professorSubject();
    const material = await securityApprovedMaterial(profesor, subjectId, 'Material Visor PDF');
    const base = securityBaseUrl();

    const login = await fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: testUtils.accounts.profesor.email,
            password: testUtils.accounts.profesor.password
        })
    });
    testUtils.assert(login.ok, 'No se pudo iniciar sesion para probar la cookie de archivos');
    const setCookie = String(login.headers.get('set-cookie') || '');
    testUtils.assert(/bt_file_access=/.test(setCookie), 'El login no emite la cookie de archivos');
    testUtils.assert(/HttpOnly/i.test(setCookie), 'La cookie de archivos debe ser HttpOnly');
    testUtils.assert(/SameSite=Lax/i.test(setCookie), 'La cookie de archivos debe usar SameSite=Lax');
    testUtils.assert(/Path=\/api(?:;|$)/i.test(setCookie), 'La cookie de archivos debe limitarse a /api');
    const cookie = setCookie.split(';')[0];

    const viaCookie = await fetch(base + `/api/materials/${material.id}/file`, {
        headers: { Cookie: cookie }
    });
    testUtils.assert(viaCookie.ok, 'La cookie HttpOnly no abre el archivo en una pestana nueva');
    testUtils.assert(viaCookie.headers.get('content-type') === 'application/pdf', 'La cookie no devuelve el PDF inline');

    const anonymousRange = await fetch(base + `/api/materials/${material.id}/file`, {
        headers: { Range: 'bytes=0-15' }
    });
    testUtils.assert(anonymousRange.status === 206, 'El visor PDF anonimo debe recibir 206');
    testUtils.assert(Number(anonymousRange.headers.get('content-length')) === 16, 'El rango anonimo debe devolver 16 bytes');

    const ranged = await fetch(base + `/api/materials/${material.id}/file`, {
        headers: { Cookie: cookie, Range: 'bytes=0-15' }
    });
    testUtils.assert(ranged.status === 206, 'El visor PDF debe recibir 206 al pedir un rango');
    testUtils.assert(/^bytes 0-15\//.test(String(ranged.headers.get('content-range') || '')), 'Falta Content-Range en la respuesta parcial');
    testUtils.assert(Number(ranged.headers.get('content-length')) === 16, 'El rango debe devolver exactamente 16 bytes');
    testUtils.assert(String(ranged.headers.get('accept-ranges') || '').toLowerCase() === 'bytes', 'Falta Accept-Ranges');

    const logout = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } });
    testUtils.assert(logout.status === 204, 'Logout debe responder 204');
    testUtils.assert(/bt_file_access=;/.test(String(logout.headers.get('set-cookie') || '')), 'Logout no limpia la cookie de archivos');
});

testUtils.createTestButton('Test Seguridad: revocacion por ban, unban y cambio de rol', async () => {
    const admin = await securityAdminToken();

    const baneado = await testUtils.registerVerifiedAlumno('seguridad-ban');
    const ban = await testUtils.request(`/auth/users/${baneado.id}/ban`, { method: 'PUT', token: admin });
    testUtils.assert(ban.ok, 'No se pudo banear al usuario');
    const bannedMe = await testUtils.request('/auth/me', { token: baneado.token });
    testUtils.assert(bannedMe.status === 401, 'El token debe revocarse al banear');

    const unban = await testUtils.request(`/auth/users/${baneado.id}/unban`, { method: 'PUT', token: admin });
    testUtils.assert(unban.ok, 'No se pudo desbanear al usuario');
    const oldMe = await testUtils.request('/auth/me', { token: baneado.token });
    testUtils.assert(oldMe.status === 401, 'El token anterior no debe revivir al desbanear');
    const fresh = await testUtils.login(baneado.email, baneado.password);
    testUtils.assert(fresh, 'El usuario desbaneado debe poder iniciar sesion');
    const freshMe = await testUtils.request('/auth/me', { token: fresh });
    testUtils.assert(freshMe.ok, 'El token nuevo debe ser valido');

    const promovido = await testUtils.registerVerifiedAlumno('seguridad-rol');
    const role = await testUtils.request(`/auth/users/${promovido.id}/role`, {
        method: 'PUT', token: admin, body: { role: 'Profesor' }
    });
    testUtils.assert(role.ok, 'No se pudo cambiar el rol');
    const oldRoleMe = await testUtils.request('/auth/me', { token: promovido.token });
    testUtils.assert(oldRoleMe.status === 401, 'El token debe revocarse al cambiar el rol');
    const promotedToken = await testUtils.login(promovido.email, promovido.password);
    const promotedMe = await testUtils.request('/auth/me', { token: promotedToken });
    testUtils.assert(promotedMe.ok && promotedMe.data.user.roleNombre === 'Profesor', 'El nuevo rol no se aplico');

    const lastSuperadmin = await testUtils.request('/auth/users/1/role', {
        method: 'PUT', token: admin, body: { role: 'Alumno' }
    });
    testUtils.assert(lastSuperadmin.status === 409, 'No se debe degradar al ultimo Superadmin');

    const cambiado = await testUtils.registerVerifiedAlumno('seguridad-clave');
    const passwordChange = await testUtils.request('/auth/password', {
        method: 'PUT', token: cambiado.token,
        body: { currentPassword: cambiado.password, password: 'Nueva123', passwordConfirm: 'Nueva123' }
    });
    testUtils.assert(passwordChange.ok, 'No se pudo cambiar la contrasena');
    const oldPasswordToken = await testUtils.request('/auth/me', { token: cambiado.token });
    testUtils.assert(oldPasswordToken.status === 401, 'El token debe revocarse al cambiar la contrasena');
    const oldLogin = await testUtils.login(cambiado.email, cambiado.password);
    testUtils.assert(!oldLogin, 'La contrasena anterior no debe seguir funcionando');
    const newLogin = await testUtils.login(cambiado.email, 'Nueva123');
    testUtils.assert(newLogin, 'La contrasena nueva debe permitir iniciar sesion');

    const eliminado = await testUtils.registerVerifiedAlumno('seguridad-baja');
    const deleted = await testUtils.request(`/auth/users/${eliminado.id}`, { method: 'DELETE', token: admin });
    testUtils.assert(deleted.ok, 'No se pudo dar de baja al usuario');
    const deletedMe = await testUtils.request('/auth/me', { token: eliminado.token });
    testUtils.assert(deletedMe.status === 401, 'El token debe revocarse al dar de baja');
});
