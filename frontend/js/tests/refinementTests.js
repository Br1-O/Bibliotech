/**
 * Project : Bibliotech | Frontend - Suite de pruebas
 * Refinamientos: multiples profesores, permisos, carga masiva con metadatos,
 * cancelacion/rechazo con liberacion de archivos y lectura masiva de avisos.
 */

async function refinementAdminToken() {
    const token = await testUtils.login(testUtils.accounts.admin.email, testUtils.accounts.admin.password);
    testUtils.assert(token, 'No se pudo iniciar sesion como admin');
    return token;
}

async function refinementProfessor(prefix) {
    const admin = await refinementAdminToken();
    const email = testUtils.uniq(prefix || 'profesor') + '@bibliotech.edu';
    const created = await testUtils.request('/auth/professors', {
        method: 'POST', token: admin,
        body: { nombre: 'Profesor', apellido: 'Refinamiento', email, password: 'Profesor123' }
    });
    testUtils.assert(created.status === 201, 'No se pudo crear el profesor de pruebas');
    const token = await testUtils.login(email, 'Profesor123');
    testUtils.assert(token, 'No se pudo iniciar sesion con el profesor de pruebas');
    return { id: created.data.user.id, email, token };
}

async function refinementSubject(profesorIds, prefix) {
    const admin = await refinementAdminToken();
    const r = await testUtils.request('/subjects', {
        method: 'POST', token: admin,
        body: {
            nombre: testUtils.uniq(prefix || 'Materia Refinamiento'),
            descripcion: 'Materia de pruebas de refinamientos',
            profesorIds
        }
    });
    testUtils.assert(r.status === 201, 'No se pudo crear la materia de pruebas');
    return r.data.subject;
}

async function refinementUpload(token, subjectId, title, content, categories) {
    return testUtils.request('/materials/upload', {
        method: 'POST', token,
        form: testUtils.pdfForm({
            titulo: title,
            tipo: 'PDF',
            subjects: String(subjectId),
            categories: categories || ''
        }, content)
    });
}

async function refinementMine(token, materialId) {
    const r = await testUtils.request('/materials/mine', { token });
    testUtils.assert(r.ok, 'No se pudieron consultar las subidas propias');
    return (r.data.materials || []).find(m => Number(m.id) === Number(materialId)) || null;
}

function refinementBaseUrl() {
    return testUtils.apiBase.replace(/\/api\/?$/, '');
}

testUtils.createTestButton('Test Refinamiento: Materia con multiples profesores', async () => {
    const admin = await refinementAdminToken();
    const segundo = await refinementProfessor('profesor-multi');
    const subject = await refinementSubject([2, segundo.id], 'Materia Multi Profesor');

    testUtils.assert(Array.isArray(subject.profesores), 'La materia no devolvio la lista de profesores');
    testUtils.assert(subject.profesores.length === 2, 'Se esperaban dos profesores asignados');
    testUtils.assert(subject.profesores.some(p => Number(p.id) === 2), 'Falta el profesor titular original');
    testUtils.assert(subject.profesores.some(p => Number(p.id) === segundo.id), 'Falta el segundo profesor');

    const porProfesor = await testUtils.request(`/subjects?profesorId=${segundo.id}`);
    testUtils.assert(porProfesor.ok, 'Fallo el filtro de materias por profesor');
    testUtils.assert(porProfesor.data.subjects.some(s => Number(s.id) === Number(subject.id)), 'El filtro por profesor no encontro la materia');

    const porNombre = await testUtils.request('/subjects?q=' + encodeURIComponent('Refinamiento'));
    testUtils.assert(porNombre.data.subjects.some(s => Number(s.id) === Number(subject.id)), 'La busqueda por profesor no encontro la materia');

    const actualizada = await testUtils.request(`/subjects/${subject.id}`, {
        method: 'PUT', token: admin,
        body: { profesorIds: [segundo.id] }
    });
    testUtils.assert(actualizada.ok, 'No se pudo actualizar la lista de profesores');
    testUtils.assert(actualizada.data.subject.profesores.length === 1, 'Debe quedar un solo profesor');
    testUtils.assert(Number(actualizada.data.subject.profesorId) === Number(segundo.id), 'El profesor principal no se sincronizo');

    const sinProfesor = await testUtils.request(`/subjects?profesorId=2&q=${encodeURIComponent(subject.nombre)}`);
    testUtils.assert(!sinProfesor.data.subjects.some(s => Number(s.id) === Number(subject.id)), 'La materia sigue asociada al profesor retirado');

    const invalida = await testUtils.request('/subjects', {
        method: 'POST', token: admin,
        body: { nombre: testUtils.uniq('Materia Profesor Invalido'), profesorIds: [2, 99999999] }
    });
    testUtils.assert(invalida.status === 404, 'Se esperaba 404 al asignar un profesor inexistente');
});

testUtils.createTestButton('Test Refinamiento: Matriz de permisos de edicion', async () => {
    const admin = await refinementAdminToken();
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const otro = await refinementProfessor('profesor-permisos');
    const subject = await refinementSubject([2, otro.id], 'Materia Permisos Edicion');
    const alumno = await testUtils.registerVerifiedAlumno('alumno-permisos');

    const sugerencia = await refinementUpload(
        alumno.token, subject.id, testUtils.uniq('Sugerencia Permisos'), testUtils.uniq('pdf-permisos-alumno'));
    testUtils.assert(sugerencia.status === 201, 'No se pudo crear la sugerencia del alumno');

    const editadaTitular = await testUtils.request(`/materials/${sugerencia.data.material.id}`, {
        method: 'PUT', token: profesor, body: { descripcion: 'Editada por el titular' }
    });
    testUtils.assert(editadaTitular.ok, 'El profesor titular debe editar sugerencias de sus materias');

    const editadaCoprofesor = await testUtils.request(`/materials/${sugerencia.data.material.id}`, {
        method: 'PUT', token: otro.token, body: { descripcion: 'Editada por el coprofesor' }
    });
    testUtils.assert(editadaCoprofesor.ok, 'El coprofesor asignado debe editar sugerencias de la materia');

    const materiaAjena = await refinementSubject([], 'Materia Sin Profesor Permisos');
    const ajeno = await refinementProfessor('profesor-ajeno');
    const editadaAjena = await testUtils.request(`/materials/${sugerencia.data.material.id}`, {
        method: 'PUT', token: ajeno.token, body: { descripcion: 'Editada por otro profesor' }
    });
    testUtils.assert(editadaAjena.ok, 'Cualquier profesor debe poder editar materiales subidos por alumnos');

    const lote = new FormData();
    lote.append('links', `${testUtils.uniq('Material Admin Editable')} | https://github.com/bibliotech-test/${testUtils.uniq('repo')}`);
    const creadoAdmin = await testUtils.request('/materials/batch', { method: 'POST', token: admin, form: lote });
    testUtils.assert(creadoAdmin.status === 201 && creadoAdmin.data.created === 1, 'No se pudo crear el material del admin');
    const materialAdmin = creadoAdmin.data.materials[0];
    const materialAjenaA = await testUtils.request(`/materials/${materialAdmin.id}/associate`, {
        method: 'POST', token: profesor, body: { subjectId: subject.id }
    });
    testUtils.assert(materialAjenaA.ok, 'No se pudo asociar el material del admin a la materia');

    const editadaAdmin = await testUtils.request(`/materials/${materialAdmin.id}`, {
        method: 'PUT', token: profesor, body: { descripcion: 'Profesor intenta editar material admin' }
    });
    testUtils.assert(editadaAdmin.status === 403, 'Un profesor no debe editar material creado por el Superadmin');

    const adminEdita = await testUtils.request(`/materials/${materialAdmin.id}`, {
        method: 'PUT', token: admin, body: { descripcion: 'Editada por administrador' }
    });
    testUtils.assert(adminEdita.ok, 'El Superadmin debe poder editar cualquier material');

    const sinPermiso = await testUtils.request(`/materials/${sugerencia.data.material.id}`, {
        method: 'PUT', token: alumno.token, body: { descripcion: 'Alumno no edita' }
    });
    testUtils.assert(sinPermiso.status === 403, 'Un alumno no debe editar materiales');

    testUtils.assert(materiaAjena.id, 'La materia auxiliar no se creo');
});

testUtils.createTestButton('Test Refinamiento: Edicion completa de material', async () => {
    const admin = await refinementAdminToken();
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const otro = await refinementProfessor('profesor-editor');
    const subject = await refinementSubject([2, otro.id], 'Materia Editor Material');
    const alumno = await testUtils.registerVerifiedAlumno('alumno-editor');

    const contenidoOriginal = testUtils.uniq('pdf-editor-original');
    const subida = await refinementUpload(profesor, subject.id, testUtils.uniq('Material Profesor Editor'), contenidoOriginal, testUtils.uniq('tag-original'));
    testUtils.assert(subida.status === 201, 'No se pudo crear el material del profesor');
    const propio = subida.data.material;
    const archivoAnterior = propio.urlOrPath;

    const tagA = testUtils.uniq('tag-editor-a');
    const tagB = testUtils.uniq('tag-editor-b');
    const tituloEditado = testUtils.uniq('Titulo Profesor Editado');
    const portadaContenido = testUtils.uniq('portada-editor');
    const reemplazo = new FormData();
    reemplazo.append('titulo', tituloEditado);
    reemplazo.append('descripcion', 'Descripcion editada por el profesor');
    reemplazo.append('tipo', 'PDF');
    reemplazo.append('categories', `${tagA},${tagB}`);
    reemplazo.append('archivo', new Blob([testUtils.uniq('pdf-editor-reemplazo')], { type: 'application/pdf' }), 'reemplazo.pdf');
    reemplazo.append('portada', new Blob([portadaContenido], { type: 'image/png' }), 'portada.png');

    const editado = await testUtils.request(`/materials/${propio.id}`, {
        method: 'PUT', token: profesor, form: reemplazo
    });
    testUtils.assert(editado.ok, 'El profesor no pudo editar su propio material');
    const materialEditado = editado.data.material;
    testUtils.assert(materialEditado.titulo === tituloEditado, 'No se guardo el titulo editado');
    testUtils.assert(materialEditado.descripcion === 'Descripcion editada por el profesor', 'No se guardo la descripcion editada');
    testUtils.assert(materialEditado.tipo === 'PDF', 'El tipo de archivo cambio inesperadamente');
    testUtils.assert(materialEditado.categories.includes(tagA) && materialEditado.categories.includes(tagB), 'No se guardaron las etiquetas editadas');
    testUtils.assert(materialEditado.urlOrPath !== archivoAnterior, 'No se reemplazo el archivo del material');
    testUtils.assert(materialEditado.portada && materialEditado.portada.startsWith('/uploads/'), 'No se guardo la portada editada');

    const archivoNuevo = await fetch(refinementBaseUrl() + materialEditado.urlOrPath);
    testUtils.assert(archivoNuevo.ok, 'El archivo reemplazado no se sirve publicamente');
    const archivoEliminado = await fetch(refinementBaseUrl() + archivoAnterior);
    testUtils.assert(archivoEliminado.status === 404, 'El archivo anterior no se elimino al reemplazarlo');
    const portadaNueva = await fetch(refinementBaseUrl() + materialEditado.portada);
    testUtils.assert(portadaNueva.ok, 'La portada editada no se sirve publicamente');

    const sugerencia = await refinementUpload(
        alumno.token, subject.id, testUtils.uniq('Sugerencia Editor'), testUtils.uniq('pdf-editor-alumno'), testUtils.uniq('tag-alumno'));
    testUtils.assert(sugerencia.status === 201, 'No se pudo crear la sugerencia del alumno');
    const materialAlumno = sugerencia.data.material;

    const youtubeUrl = `https://www.youtube.com/watch?v=${testUtils.uniq('video')}`;
    const cambioAlumno = new FormData();
    cambioAlumno.append('titulo', testUtils.uniq('Sugerencia Editada'));
    cambioAlumno.append('descripcion', 'Sugerencia editada por el profesor');
    cambioAlumno.append('tipo', 'Youtube');
    cambioAlumno.append('urlOrPath', youtubeUrl);
    cambioAlumno.append('categories', tagA);
    const alumnoEditado = await testUtils.request(`/materials/${materialAlumno.id}`, {
        method: 'PUT', token: profesor, form: cambioAlumno
    });
    testUtils.assert(alumnoEditado.ok, 'El profesor no pudo editar la sugerencia de su alumno');
    testUtils.assert(alumnoEditado.data.material.tipo === 'Youtube', 'No se cambio el tipo del material del alumno');
    testUtils.assert(alumnoEditado.data.material.urlOrPath === youtubeUrl, 'No se guardo el enlace editado');
    const archivoSugerencia = await fetch(refinementBaseUrl() + materialAlumno.urlOrPath);
    testUtils.assert(archivoSugerencia.status === 404, 'El archivo de la sugerencia no se elimino al cambiarla a enlace');

    const adminEditaAlumno = await testUtils.request(`/materials/${materialAlumno.id}`, {
        method: 'PUT', token: admin,
        body: { titulo: testUtils.uniq('Sugerencia Admin'), categories: [tagB] }
    });
    testUtils.assert(adminEditaAlumno.ok, 'El Superadmin no pudo editar el material de un alumno');
    testUtils.assert(adminEditaAlumno.data.material.categories.includes(tagB), 'El Superadmin no pudo cambiar las etiquetas');

    const lote = new FormData();
    lote.append('links', `${testUtils.uniq('Material Admin Editor')} | https://github.com/bibliotech-test/${testUtils.uniq('repo-editor')}`);
    const creadoAdmin = await testUtils.request('/materials/batch', { method: 'POST', token: admin, form: lote });
    testUtils.assert(creadoAdmin.status === 201 && creadoAdmin.data.created === 1, 'No se pudo crear el material propio del admin');
    const materialAdmin = creadoAdmin.data.materials[0];
    const adminYoutube = `https://www.youtube.com/watch?v=${testUtils.uniq('admin-video')}`;
    const adminEditaPropio = await testUtils.request(`/materials/${materialAdmin.id}`, {
        method: 'PUT', token: admin,
        body: {
            titulo: testUtils.uniq('Material Admin URL'),
            descripcion: 'Enlace editado por el admin',
            tipo: 'Youtube',
            urlOrPath: adminYoutube,
            categories: [tagA, tagB]
        }
    });
    testUtils.assert(adminEditaPropio.ok, 'El Superadmin no pudo editar su propio material');
    testUtils.assert(adminEditaPropio.data.material.urlOrPath === adminYoutube, 'El admin no pudo cambiar el enlace');
    testUtils.assert(adminEditaPropio.data.material.categories.length === 2, 'El admin no pudo cambiar las etiquetas');

    const adminArchivo = new FormData();
    adminArchivo.append('titulo', testUtils.uniq('Material Admin Archivo'));
    adminArchivo.append('tipo', 'PDF');
    adminArchivo.append('categories', tagA);
    adminArchivo.append('archivo', new Blob([testUtils.uniq('pdf-admin-archivo')], { type: 'application/pdf' }), 'admin.pdf');
    const adminCambiaAArchivo = await testUtils.request(`/materials/${materialAdmin.id}`, {
        method: 'PUT', token: admin, form: adminArchivo
    });
    testUtils.assert(adminCambiaAArchivo.ok, 'El admin no pudo cambiar un enlace por un archivo');
    testUtils.assert(adminCambiaAArchivo.data.material.tipo === 'PDF', 'El admin no pudo cambiar el tipo a PDF');
    testUtils.assert(String(adminCambiaAArchivo.data.material.urlOrPath).startsWith('/uploads/'), 'El nuevo archivo del admin no se guardo');

    const adminEditaProfesor = await testUtils.request(`/materials/${propio.id}`, {
        method: 'PUT', token: admin, body: { descripcion: 'Editada por el Superadmin' }
    });
    testUtils.assert(adminEditaProfesor.ok, 'El Superadmin debe poder editar material de profesores');

    const otroEditaProfesor = await testUtils.request(`/materials/${propio.id}`, {
        method: 'PUT', token: otro.token, body: { descripcion: 'Otro profesor no debe editar' }
    });
    testUtils.assert(otroEditaProfesor.status === 403, 'Otro profesor no debe editar material ajeno');

    const alumnoEdita = await testUtils.request(`/materials/${materialAlumno.id}`, {
        method: 'PUT', token: alumno.token, body: { descripcion: 'Alumno no edita' }
    });
    testUtils.assert(alumnoEdita.status === 403, 'Un alumno no debe editar materiales');
});

testUtils.createTestButton('Test Refinamiento: Carga masiva con titulos y portadas', async () => {
    const admin = await refinementAdminToken();
    const titulo = testUtils.uniq('Lote con Metadatos');
    const contenido = testUtils.uniq('pdf-lote-metadatos');
    const tag = testUtils.uniq('lote');

    const form = new FormData();
    form.append('archivo_0', new Blob([contenido], { type: 'application/pdf' }), 'archivo-original.pdf');
    form.append('portada_0', new Blob(['portada de prueba'], { type: 'image/png' }), 'portada.png');
    form.append('metadata', JSON.stringify([{ titulo }]));
    form.append('categories', tag);

    const r = await testUtils.request('/materials/batch', { method: 'POST', token: admin, form });
    testUtils.log({ status: r.status, created: r.data && r.data.created, material: r.data && r.data.materials && r.data.materials[0] });
    testUtils.assert(r.status === 201 && r.data.created === 1, 'La carga masiva no creo el archivo con metadatos');
    const material = r.data.materials[0];
    testUtils.assert(material.titulo === titulo, 'No se respeto el titulo enviado en metadata');
    testUtils.assert(material.portada && material.portada.startsWith('/uploads/'), 'No se guardo la portada del lote');

    const portada = await fetch(refinementBaseUrl() + material.portada);
    testUtils.assert(portada.ok, 'La portada del lote no se sirve publicamente');

    const duplicado = new FormData();
    duplicado.append('archivo_0', new Blob([contenido], { type: 'application/pdf' }), 'duplicado.pdf');
    duplicado.append('metadata', JSON.stringify([{ titulo: testUtils.uniq('Duplicado Lote') }]));
    const repetido = await testUtils.request('/materials/batch', { method: 'POST', token: admin, form: duplicado });
    testUtils.assert(repetido.status === 201, 'La carga duplicada debia procesarse como omitida');
    testUtils.assert(repetido.data.created === 0 && repetido.data.skipped === 1, 'El duplicado del lote no fue omitido');
});

testUtils.createTestButton('Test Refinamiento: Cancelar sugerencia libera archivo', async () => {
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subject = await refinementSubject([2], 'Materia Cancelacion Archivo');
    const alumno = await testUtils.registerVerifiedAlumno('alumno-cancelar');
    const contenido = testUtils.uniq('pdf-cancelar-archivo');
    const subida = await refinementUpload(alumno.token, subject.id, testUtils.uniq('Cancelar Archivo'), contenido);
    testUtils.assert(subida.status === 201, 'No se pudo sugerir el material a cancelar');
    const material = subida.data.material;
    testUtils.assert(material.urlOrPath, 'La sugerencia no devolvio la ruta del archivo');

    const archivoAntes = await fetch(refinementBaseUrl() + material.urlOrPath);
    testUtils.assert(archivoAntes.ok, 'El archivo de la sugerencia no existe antes de cancelar');

    const otroAlumno = await testUtils.registerVerifiedAlumno('alumno-cancelar-ajeno');
    const prohibido = await testUtils.request(`/materials/${material.id}/cancel`, { method: 'POST', token: otroAlumno.token });
    testUtils.assert(prohibido.status === 403, 'Otro alumno no debe cancelar la sugerencia');

    const cancelada = await testUtils.request(`/materials/${material.id}/cancel`, { method: 'POST', token: alumno.token });
    testUtils.assert(cancelada.ok, 'El autor no pudo cancelar su sugerencia');

    const archivoDespues = await fetch(refinementBaseUrl() + material.urlOrPath);
    testUtils.assert(archivoDespues.status === 404, 'El archivo fisico no se elimino al cancelar');

    const propia = await refinementMine(alumno.token, material.id);
    testUtils.assert(propia && propia.estado === 'Cancelado', 'La sugerencia cancelada no sigue visible en Mis subidas');
    testUtils.assert(propia.urlOrPath === null && propia.fileHash === null && propia.portada === null, 'La cancelacion no limpio archivo, hash y portada');

    const pendientes = await testUtils.request('/materials/pending', { token: alumno.token });
    testUtils.assert(!pendientes.data.materials.some(m => Number(m.id) === Number(material.id)), 'Una sugerencia cancelada sigue en pendientes');

    const publico = await testUtils.request(`/materials/author/${alumno.id}`);
    testUtils.assert(!publico.data.materials.some(m => Number(m.id) === Number(material.id)), 'La sugerencia cancelada aparece en el perfil publico');

    const repetida = await refinementUpload(alumno.token, subject.id, testUtils.uniq('Reutilizar Cancelado'), contenido);
    testUtils.assert(repetida.status === 201 && Number(repetida.data.material.id) !== Number(material.id), 'El hash cancelado no se libero para una nueva subida');

    const profesorEdita = await testUtils.request(`/materials/${material.id}`, {
        method: 'PUT', token: profesor, body: { titulo: 'No debe editar cancelado' }
    });
    testUtils.assert(profesorEdita.status === 403, 'Un material cancelado no debe reabrirse para edicion');
});

testUtils.createTestButton('Test Refinamiento: Rechazar sugerencia la conserva y libera archivo', async () => {
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subject = await refinementSubject([2], 'Materia Rechazo Archivo');
    const alumno = await testUtils.registerVerifiedAlumno('alumno-rechazo-ref');
    const contenido = testUtils.uniq('pdf-rechazo-archivo');
    const subida = await refinementUpload(alumno.token, subject.id, testUtils.uniq('Rechazo Archivo'), contenido);
    testUtils.assert(subida.status === 201, 'No se pudo sugerir el material a rechazar');
    const material = subida.data.material;

    const rechazo = await testUtils.request(`/materials/${material.id}/reject`, {
        method: 'POST', token: profesor, body: { subjectId: subject.id }
    });
    testUtils.assert(rechazo.ok && rechazo.data.rejected === true, 'El rechazo no marco el material como rechazado');

    const archivo = await fetch(refinementBaseUrl() + material.urlOrPath);
    testUtils.assert(archivo.status === 404, 'El archivo fisico no se elimino al rechazar');

    const propia = await refinementMine(alumno.token, material.id);
    testUtils.assert(propia && propia.estado === 'Rechazado', 'El material rechazado no sigue visible en Mis subidas');
    testUtils.assert(propia.urlOrPath === null && propia.fileHash === null, 'El rechazo no limpio archivo y hash');

    const revision = await testUtils.request('/materials/pending-review', { token: profesor });
    testUtils.assert(!revision.data.materials.some(m => Number(m.id) === Number(material.id)), 'El material rechazado sigue en revision');

    const global = await testUtils.request('/materials/global');
    testUtils.assert(!global.data.materials.some(m => Number(m.id) === Number(material.id)), 'El material rechazado aparece en el catalogo global');

    const repetida = await refinementUpload(alumno.token, subject.id, testUtils.uniq('Reutilizar Rechazo'), contenido);
    testUtils.assert(repetida.status === 201 && Number(repetida.data.material.id) !== Number(material.id), 'El hash rechazado no se libero');

    const cancelarRechazado = await testUtils.request(`/materials/${material.id}/cancel`, { method: 'POST', token: alumno.token });
    testUtils.assert(cancelarRechazado.status === 409, 'Un material rechazado no debe poder cancelarse');
});

testUtils.createTestButton('Test Refinamiento: Marcar todas las notificaciones como leidas', async () => {
    const subject = await refinementSubject([2], 'Materia Leer Todo');
    const alumno = await testUtils.registerVerifiedAlumno('alumno-leer-todo');
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);

    const suscripcion = await testUtils.request(`/subscriptions/subscribe/${subject.id}`, {
        method: 'POST', token: alumno.token
    });
    testUtils.assert(suscripcion.status === 201, 'No se pudo suscribir al alumno');

    const primera = await refinementUpload(profesor, subject.id, testUtils.uniq('Notif Leer Todo A'), testUtils.uniq('pdf-leer-todo-a'));
    testUtils.assert(primera.status === 201, 'No se pudo subir el primer material');

    const antes = await testUtils.request('/notifications', { token: alumno.token });
    testUtils.assert(antes.data.unreadCount >= 1, 'Se esperaba al menos una notificacion sin leer');

    const leidas = await testUtils.request('/notifications/read-all', { method: 'POST', token: alumno.token });
    testUtils.log({ status: leidas.status, marked: leidas.data && leidas.data.marked });
    testUtils.assert(leidas.ok && leidas.data.read === true, 'No se pudo marcar todo como leido');
    testUtils.assert(leidas.data.marked >= 1, 'La lectura masiva no marco notificaciones');

    const despues = await testUtils.request('/notifications', { token: alumno.token });
    testUtils.assert(despues.data.unreadCount === 0, 'Quedaron notificaciones sin leer');
    testUtils.assert(despues.data.notifications.every(n => n.readAt !== null), 'Alguna notificacion quedo sin fecha de lectura');

    const segunda = await refinementUpload(profesor, subject.id, testUtils.uniq('Notif Leer Todo B'), testUtils.uniq('pdf-leer-todo-b'));
    testUtils.assert(segunda.status === 201, 'No se pudo subir el segundo material');

    const nuevas = await testUtils.request('/notifications', { token: alumno.token });
    const nueva = nuevas.data.notifications.find(n => Number(n.materialId) === Number(segunda.data.material.id));
    testUtils.assert(nueva && nueva.readAt === null, 'La notificacion nueva debe nacer sin leer');
    testUtils.assert(nuevas.data.unreadCount === 1, 'El contador posterior a la lectura masiva no se reinicio');
});
