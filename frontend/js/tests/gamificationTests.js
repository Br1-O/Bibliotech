/**
* Project     : Bibliotech  |  Frontend - Suite de pruebas
* gamificationTests: perfil, XP, lecturas, backlog, rachas y seguidores.
*/

testUtils.createTestButton('Test Perfil - Datos publicos, rango e insignias', async () => {
    const token = await testUtils.login(testUtils.accounts.alumno.email, testUtils.accounts.alumno.password);
    testUtils.assert(token, 'No se pudo iniciar sesion como alumno');

    const mine = await testUtils.request('/profile/3', { token });
    testUtils.assert(mine.status === 200, 'No se pudo obtener el perfil propio');
    testUtils.assert(mine.data.user && mine.data.user.email, 'El perfil debe incluir el correo');
    testUtils.assert(Array.isArray(mine.data.allBadges) && mine.data.allBadges.length === 10, 'Deben existir 10 insignias');
    testUtils.assert(mine.data.user.rank && mine.data.user.rank.title, 'El perfil debe incluir el rango');
    testUtils.assert(typeof mine.data.rankProgress === 'number', 'El progreso de rango debe ser numerico');
    testUtils.assert(mine.data.isSelf === true, 'El perfil propio debe marcarse como isSelf');

    const publico = await testUtils.request('/profile/3');
    testUtils.assert(publico.status === 200, 'El perfil publico debe ser accesible sin sesion');
    testUtils.assert(publico.data.isSelf === false, 'Un visitante no debe ser isSelf');
});

testUtils.createTestButton('Test Perfil - Edicion y foto de rango', async () => {
    const alumno = await testUtils.registerVerifiedAlumno('perfil');
    const update = await testUtils.request('/profile', {
        method: 'PUT', token: alumno.token,
        body: {
            city: 'Ciudad Test', country: 'Pais Test', birthdate: '2003-05-10',
            gender: 'Other', genderCustom: 'Agender', linkedin: 'usuario-test',
            career: 'Analista de Sistemas', institute: 'Instituto Test', aboutMe: 'Perfil de prueba'
        }
    });
    testUtils.assert(update.status === 200, 'No se pudo actualizar el perfil');
    testUtils.assert(update.data.user.city === 'Ciudad Test', 'La ciudad no se guardo');
    testUtils.assert(update.data.user.birthdate === '2003-05-10', 'La fecha de nacimiento no se guardo');
    testUtils.assert(typeof update.data.user.age === 'number', 'La edad debe calcularse desde la fecha de nacimiento');
    testUtils.assert(update.data.user.gender === 'Other' && update.data.user.genderCustom === 'Agender', 'El genero personalizado no se guardo');
    testUtils.assert(update.data.user.aboutMe === 'Perfil de prueba', 'Sobre mi no se guardo');

    const invalido = await testUtils.request('/profile', {
        method: 'PUT', token: alumno.token,
        body: { github: 'no-es-url' }
    });
    testUtils.assert(invalido.status === 422, 'Un GitHub invalido debe rechazarse');

    const fotos = await testUtils.request('/profile-pictures', { token: alumno.token });
    testUtils.assert(fotos.status === 200 && fotos.data.pictures.length >= 4, 'Deben listarse las fotos de perfil');
    testUtils.assert(fotos.data.pictures.some(foto => foto.key === 'rank-1'), 'La foto del rango 1 debe estar disponible');
    const bloqueada = await testUtils.request('/profile', {
        method: 'PUT', token: alumno.token,
        body: { profilePicture: '/img/profile_pictures/Constructor de Sistemas.png' }
    });
    testUtils.assert(bloqueada.status === 422, 'No se debe elegir una foto de rango no alcanzado');
});

testUtils.createTestButton('Test Gamificacion - Leer otorga XP e insignia', async () => {
    const alumno = await testUtils.registerVerifiedAlumno('lectura');
    const global = await testUtils.request('/materials/global?limit=1', { token: alumno.token });
    testUtils.assert(global.status === 200 && global.data.materials.length > 0, 'No hay materiales para leer');
    const materialId = global.data.materials[0].id;

    const lectura = await testUtils.request(`/reads/${materialId}/toggle`, { method: 'POST', token: alumno.token, body: {} });
    testUtils.assert(lectura.status === 200 && lectura.data.read === true, 'La lectura no se marco');
    testUtils.assert(lectura.data.xp >= 100, 'La primera lectura debe otorgar al menos 100 XP');

    const perfil = await testUtils.request(`/profile/${alumno.id}`, { token: alumno.token });
    testUtils.assert(perfil.data.stats.reads === 1, 'El perfil debe contar una lectura');
    testUtils.assert(perfil.data.badges.some(badge => badge.key === 'hello_world'), 'Debe desbloquearse hello_world');

    const getRead = await testUtils.request(`/reads/${materialId}`, { token: alumno.token });
    testUtils.assert(getRead.data.read === true && 'progress' in getRead.data, 'La lectura debe recuperarse con su progreso');

    const desmarcar = await testUtils.request(`/reads/${materialId}/toggle`, { method: 'POST', token: alumno.token, body: {} });
    testUtils.assert(desmarcar.status === 200 && desmarcar.data.read === false, 'La lectura no se desmarco');
    testUtils.assert(desmarcar.data.xp >= 100, 'Desmarcar no debe restar XP');
});

testUtils.createTestButton('Test Backlog - Progreso y paso automatico a leidos', async () => {
    const alumno = await testUtils.registerVerifiedAlumno('backlog');
    const global = await testUtils.request('/materials/global?limit=1', { token: alumno.token });
    const materialId = global.data.materials[0].id;

    const alta = await testUtils.request(`/backlog/${materialId}`, { method: 'POST', token: alumno.token, body: {} });
    testUtils.assert(alta.status === 201 && alta.data.added, 'No se agrego al backlog');

    const sinPaginas = await testUtils.request(`/reads/${materialId}/progress`, {
        method: 'PUT', token: alumno.token, body: { currentPage: 5 }
    });
    testUtils.assert(sinPaginas.status === 422, 'Sin paginas registradas debe exigirse el total manual');

    const progreso = await testUtils.request(`/reads/${materialId}/progress`, {
        method: 'PUT', token: alumno.token, body: { currentPage: 25, totalPages: 100 }
    });
    testUtils.assert(progreso.status === 200 && progreso.data.read.progress === 25, 'El progreso debe ser 25%');

    const completar = await testUtils.request(`/reads/${materialId}/progress`, {
        method: 'PUT', token: alumno.token, body: { currentPage: 100, totalPages: 100 }
    });
    testUtils.assert(completar.status === 200 && completar.data.read.completed, 'Al llegar a la ultima pagina debe completarse');

    const lista = await testUtils.request(`/users/${alumno.id}/backlog`, { token: alumno.token });
    testUtils.assert(!lista.data.items.some(entry => entry.materialId === materialId), 'El material completado debe salir del backlog');

    const leidos = await testUtils.request(`/users/${alumno.id}/reads`, { token: alumno.token });
    testUtils.assert(leidos.data.materials.some(material => material.id === materialId), 'El material completado debe figurar en leidos');
});

testUtils.createTestButton('Test Rachas - Cinco minutos de lectura', async () => {
    const alumno = await testUtils.registerVerifiedAlumno('racha');
    const global = await testUtils.request('/materials/global?limit=1', { token: alumno.token });
    const materialId = global.data.materials[0].id;

    const corto = await testUtils.request('/streaks/heartbeat', {
        method: 'POST', token: alumno.token, body: { materialId, activeSeconds: 120 }
    });
    testUtils.assert(corto.status === 200 && corto.data.streak.qualified === false, 'Con 120s no debe calificar');

    const completo = await testUtils.request('/streaks/heartbeat', {
        method: 'POST', token: alumno.token, body: { materialId, activeSeconds: 300 }
    });
    testUtils.assert(completo.status === 200 && completo.data.streak.qualified === true, 'Con 300s debe calificar');
    testUtils.assert(completo.data.streak.currentStreak >= 1, 'La racha debe iniciar en 1');
});

testUtils.createTestButton('Test Seguidores - Seguir y dejar de seguir', async () => {
    const seguidor = await testUtils.registerVerifiedAlumno('seguidor');
    const seguido = await testUtils.registerVerifiedAlumno('seguido');

    const seguir = await testUtils.request(`/subscriptions/${seguido.id}`, {
        method: 'POST', token: seguidor.token, body: {}
    });
    testUtils.assert(seguir.status === 201, 'No se pudo seguir al usuario');

    const perfil = await testUtils.request(`/profile/${seguido.id}`, { token: seguidor.token });
    testUtils.assert(perfil.data.user.stats === undefined, 'El perfil no debe mezclar stats en user');
    testUtils.assert(perfil.data.stats.followers === 1, 'El seguido debe tener un seguidor');
    testUtils.assert(perfil.data.isFollowing === true, 'El perfil debe indicar que lo sigue');

    const dejar = await testUtils.request(`/subscriptions/${seguido.id}`, {
        method: 'DELETE', token: seguidor.token
    });
    testUtils.assert(dejar.status === 200 && dejar.data.following === false, 'No se pudo dejar de seguir');
});
