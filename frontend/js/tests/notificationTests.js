/**
 * Project : Bibliotech | Frontend - Suite de pruebas
 * Notificaciones de material nuevo para alumnos suscriptores.
 */

async function crearMateriaNotificaciones(prefix) {
    const admin = await testUtils.login(testUtils.accounts.admin.email, testUtils.accounts.admin.password);
    const r = await testUtils.request('/subjects', {
        method: 'POST', token: admin,
        body: { nombre: testUtils.uniq(prefix || 'Materia Notificaciones'), profesorId: 2 }
    });
    testUtils.assert(r.status === 201, 'No se pudo crear la materia de notificaciones');
    return r.data.subject.id;
}

async function subirMaterialProfesor(subjectId, prefix) {
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const titulo = testUtils.uniq(prefix || 'Material Notificacion');
    const r = await testUtils.request('/materials/upload', {
        method: 'POST', token: profesor,
        form: testUtils.pdfForm({
            titulo, tipo: 'PDF', subjects: String(subjectId)
        }, testUtils.uniq('pdf-notificacion'))
    });
    testUtils.assert(r.status === 201, 'No se pudo subir el material de prueba');
    return { titulo, material: r.data.material, token: profesor };
}

testUtils.createTestButton('Test Notificacion al Subir Material a Materia Suscrita', async () => {
    const subjectId = await crearMateriaNotificaciones('Materia Notif Subida');
    const alumno = await testUtils.registerVerifiedAlumno('alumno-notif');
    await testUtils.request(`/subscriptions/subscribe/${subjectId}`, {
        method: 'POST', token: alumno.token
    });

    const { titulo, material } = await subirMaterialProfesor(subjectId, 'Material Notif Subida');
    const inbox = await testUtils.request('/notifications', { token: alumno.token });
    testUtils.log({ status: inbox.status, unread: inbox.data && inbox.data.unreadCount, notifications: inbox.data && inbox.data.notifications });
    testUtils.assert(inbox.ok, 'No se pudo consultar la bandeja');
    testUtils.assert(inbox.data.unreadCount >= 1, 'Deberia haber al menos una notificacion sin leer');

    const item = inbox.data.notifications.find(n => Number(n.materialId) === Number(material.id));
    testUtils.assert(item, 'La notificacion del material no aparece en la bandeja');
    testUtils.assert(Number(item.subjectId) === Number(subjectId), 'La notificacion no indica la materia correcta');
    testUtils.assert(item.subjectNombre, 'La notificacion no incluye el nombre de la materia');
    testUtils.assert(item.materialTitulo === titulo, 'La notificacion no incluye el titulo del material');
    testUtils.assert(item.createdAt, 'La notificacion no incluye la fecha de subida');
    testUtils.assert(item.readAt === null, 'La notificacion nueva debe estar sin leer');

    const read = await testUtils.request(`/notifications/${item.id}/read`, {
        method: 'POST', token: alumno.token
    });
    testUtils.assert(read.ok, 'No se pudo marcar la notificacion como leida');

    const after = await testUtils.request('/notifications', { token: alumno.token });
    const updated = after.data.notifications.find(n => Number(n.id) === Number(item.id));
    testUtils.assert(updated && updated.readAt !== null, 'La notificacion no quedo marcada como leida');
    testUtils.assert(after.data.unreadCount === 0, 'El contador de no leidas deberia quedar en cero');
});

testUtils.createTestButton('Test Notificacion al Asociar Material a Materia Suscrita', async () => {
    const origen = await crearMateriaNotificaciones('Materia Notif Origen');
    const destino = await crearMateriaNotificaciones('Materia Notif Destino');
    const alumno = await testUtils.registerVerifiedAlumno('alumno-notif-asoc');
    await testUtils.request(`/subscriptions/subscribe/${destino}`, {
        method: 'POST', token: alumno.token
    });

    const { titulo, material, token: profesor } = await subirMaterialProfesor(origen, 'Material Notif Asociado');
    const asociar = await testUtils.request(`/materials/${material.id}/associate`, {
        method: 'POST', token: profesor, body: { subjectId: destino }
    });
    testUtils.assert(asociar.ok, 'No se pudo asociar el material a la materia destino');

    const inbox = await testUtils.request('/notifications', { token: alumno.token });
    const item = inbox.data.notifications.find(n =>
        Number(n.materialId) === Number(material.id) && Number(n.subjectId) === Number(destino));
    testUtils.log({ status: inbox.status, item });
    testUtils.assert(item, 'No se genero la notificacion al asociar material existente');
    testUtils.assert(item.materialTitulo === titulo, 'El titulo notificado no coincide');
    testUtils.assert(item.profesorNombre, 'La notificacion no indica el profesor de la materia');
});

testUtils.createTestButton('Test Sin Notificaciones para Alumno No Suscripto', async () => {
    const subjectId = await crearMateriaNotificaciones('Materia Notif Ajena');
    const alumno = await testUtils.registerVerifiedAlumno('alumno-notif-ajeno');
    await subirMaterialProfesor(subjectId, 'Material Notif Ajeno');

    const inbox = await testUtils.request('/notifications', { token: alumno.token });
    testUtils.log({ status: inbox.status, unread: inbox.data && inbox.data.unreadCount, total: inbox.data && inbox.data.notifications.length });
    testUtils.assert(inbox.ok, 'No se pudo consultar la bandeja');
    testUtils.assert(inbox.data.unreadCount === 0, 'Un alumno no suscripto no deberia recibir notificaciones');
    testUtils.assert(!inbox.data.notifications.some(n => Number(n.subjectId) === Number(subjectId)), 'Se genero una notificacion para una materia no suscrita');
});
