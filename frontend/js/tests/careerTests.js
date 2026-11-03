/**
 * Project : Bibliotech | Frontend - Suite de pruebas
 * Agrupaciones academicas (carreras/anios), permisos nuevos, portadas,
 * carga masiva, autor publico y busqueda por carrera.
 */

async function adminToken() {
    const token = await testUtils.login(testUtils.accounts.admin.email, testUtils.accounts.admin.password);
    testUtils.assert(token, 'No se pudo iniciar sesion como admin');
    return token;
}

async function createGroupedSubject(prefix) {
    const token = await adminToken();
    const career = await testUtils.request('/careers', {
        method: 'POST', token,
        body: { nombre: testUtils.uniq(prefix || 'Carrera'), color: '#5fb9a9' }
    });
    testUtils.assert(career.status === 201, 'No se pudo crear la carrera');
    const year = await testUtils.request(`/careers/${career.data.career.id}/years`, {
        method: 'POST', token,
        body: { nombre: 'Primer Anio', orden: 1 }
    });
    testUtils.assert(year.status === 201, 'No se pudo crear el anio');
    const subject = await testUtils.request('/subjects', {
        method: 'POST', token,
        body: {
            nombre: testUtils.uniq(prefix || 'Materia agrupada'),
            descripcion: 'Materia agrupada para pruebas',
            profesorId: 2,
            careerYearId: year.data.year.id
        }
    });
    testUtils.assert(subject.status === 201, 'No se pudo crear la materia agrupada');
    return {
        careerId: career.data.career.id,
        yearId: year.data.year.id,
        subjectId: subject.data.subject.id,
        token
    };
}

testUtils.createTestButton('Test Carreras y anios (listar, crear, editar y permisos)', async () => {
    const publicList = await testUtils.request('/careers');
    testUtils.assert(publicList.ok && publicList.data.careers.length >= 1, 'No se listaron carreras');
    const careerWithYears = publicList.data.careers.find(career => Array.isArray(career.years) && career.years.length >= 1);
    testUtils.assert(careerWithYears, 'La carrera semilla no tiene anios');

    const token = await adminToken();
    const created = await testUtils.request('/careers', {
        method: 'POST', token,
        body: { nombre: testUtils.uniq('Carrera'), color: '#9ec8f5' }
    });
    testUtils.assert(created.status === 201, 'No se creo la carrera');

    const invalid = await testUtils.request(`/careers/${created.data.career.id}`, {
        method: 'PUT', token, body: { color: 'azul' }
    });
    testUtils.assert(invalid.status === 422, 'Se esperaba 422 con color invalido');

    const updated = await testUtils.request(`/careers/${created.data.career.id}`, {
        method: 'PUT', token, body: { nombre: testUtils.uniq('Carrera editada'), color: '#f2a58d' }
    });
    testUtils.assert(updated.ok && updated.data.career.color === '#f2a58d', 'No se actualizo la carrera');

    const alumno = await testUtils.login(testUtils.accounts.alumno.email, testUtils.accounts.alumno.password);
    const forbidden = await testUtils.request('/careers', {
        method: 'POST', token: alumno, body: { nombre: 'Carrera alumno' }
    });
    testUtils.assert(forbidden.status === 403, 'El alumno no debe crear carreras');
});

testUtils.createTestButton('Test Materia agrupada y busqueda por carrera/anio', async () => {
    const group = await createGroupedSubject('Carrera filtro');
    const subject = await testUtils.request(`/subjects/${group.subjectId}`);
    testUtils.assert(subject.ok, 'No se pudo consultar la materia');
    testUtils.assert(Number(subject.data.subject.carreraId) === Number(group.careerId), 'La materia no quedo en la carrera');
    testUtils.assert(Number(subject.data.subject.anioId) === Number(group.yearId), 'La materia no quedo en el anio');

    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const titulo = testUtils.uniq('Material por carrera');
    const form = testUtils.pdfForm({
        titulo, tipo: 'PDF', subjects: String(group.subjectId)
    }, testUtils.uniq('pdf-carrera'));
    form.append('portada', testUtils.pngBlob('portada de prueba'), 'portada.png');
    const upload = await testUtils.request('/materials/upload', { method: 'POST', token: profesor, form });
    testUtils.assert(upload.status === 201, 'No se pudo subir material con portada');
    testUtils.assert(String(upload.data.material.portada || '').startsWith('/uploads/'), 'La portada no se guardo');

    const byCareer = await testUtils.request(`/materials/global?careerId=${group.careerId}&yearId=${group.yearId}`);
    testUtils.assert(byCareer.ok, 'Fallo el filtro por carrera');
    const material = byCareer.data.materials.find(item => item.id === upload.data.material.id);
    testUtils.assert(material, 'El material no aparece al filtrar por carrera/anio');
    testUtils.assert(material.carreras.some(c => Number(c.id) === Number(group.careerId)), 'No se adjunto la carrera al material');
});

testUtils.createTestButton('Test Validacion de enlaces y archivos', async () => {
    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const subjectId = await testUtils.professorSubject();

    const invalidRepo = new FormData();
    invalidRepo.append('titulo', testUtils.uniq('Repo invalido'));
    invalidRepo.append('tipo', 'Repositorio');
    invalidRepo.append('urlOrPath', 'https://example.com/no-es-repo');
    invalidRepo.append('subjects', String(subjectId));
    const invalidRepoResponse = await testUtils.request('/materials/upload', {
        method: 'POST', token, form: invalidRepo
    });
    testUtils.assert(invalidRepoResponse.status === 422, 'Se esperaba 422 para repositorio invalido');

    const validRepo = new FormData();
    validRepo.append('titulo', testUtils.uniq('Repositorio valido'));
    validRepo.append('tipo', 'Repositorio');
    validRepo.append('urlOrPath', 'https://github.com/octocat/Hello-World');
    validRepo.append('subjects', String(subjectId));
    const repo = await testUtils.request('/materials/upload', { method: 'POST', token, form: validRepo });
    testUtils.assert(repo.status === 201 && repo.data.material.tipo === 'Repositorio', 'No se acepto un repositorio valido');

    const mismatch = new FormData();
    mismatch.append('titulo', testUtils.uniq('Tipo incorrecto'));
    mismatch.append('tipo', 'PDF');
    mismatch.append('subjects', String(subjectId));
    mismatch.append('archivo', new Blob(['pptx'], { type: 'application/pdf' }), 'archivo.pptx');
    const badFile = await testUtils.request('/materials/upload', { method: 'POST', token, form: mismatch });
    testUtils.assert(badFile.status === 422, 'Se esperaba 422 por extension incompatible');
});

testUtils.createTestButton('Test Autor publico y mis subidas', async () => {
    const author = await testUtils.request('/materials/author/2');
    testUtils.assert(author.ok, 'No se pudo abrir el perfil del autor');
    testUtils.assert(author.data.author && author.data.author.id === 2, 'Autor incorrecto');
    testUtils.assert(author.data.materials.every(m => m.estado === 'Aprobado'), 'El perfil publico mostro material no aprobado');

    const token = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const mine = await testUtils.request('/materials/mine', { token });
    testUtils.assert(mine.ok && mine.data.materials.length >= 1, 'Mis subidas no devolvio materiales');
});

testUtils.createTestButton('Test Carga masiva solo Superadmin', async () => {
    const token = await adminToken();
    const form = new FormData();
    form.append('links', [
        `${testUtils.uniq('Lote GitHub')} | https://github.com/bibliotech-test/${testUtils.uniq('repo-suite')}`,
        `${testUtils.uniq('Lote Drive')} | https://drive.google.com/file/d/${testUtils.uniq('drive-suite')}/view`
    ].join('\n'));
    form.append('categories', 'lote,prueba');

    const r = await testUtils.request('/materials/batch', { method: 'POST', token, form });
    testUtils.assert(r.status === 201 && r.data.created >= 2, 'La carga masiva no creo los materiales');

    const created = r.data.materials[0];
    testUtils.assert(created.estado === 'Aprobado' && created.materias.length === 0, 'El lote debe quedar aprobado y sin materias');

    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const forbidden = await testUtils.request('/materials/batch', { method: 'POST', token: profesor, form });
    testUtils.assert(forbidden.status === 403, 'El profesor no debe usar la carga masiva');

    const noProfesorDelete = await testUtils.request(`/materials/${created.id}`, { method: 'DELETE', token: profesor });
    testUtils.assert(noProfesorDelete.status === 403, 'El profesor no debe borrar material global');

    const removed = await testUtils.request(`/materials/${created.id}`, { method: 'DELETE', token });
    testUtils.assert(removed.ok && removed.data.deleted === true, 'El Superadmin no pudo borrar el material global');
});

testUtils.createTestButton('Test Permisos de edicion entre profesores', async () => {
    const admin = await adminToken();
    const email = testUtils.uniq('profesor') + '@bibliotech.edu';
    const created = await testUtils.request('/auth/professors', {
        method: 'POST', token: admin,
        body: { nombre: 'Otro', apellido: 'Profesor', email, password: 'Profesor123' }
    });
    testUtils.assert(created.status === 201, 'No se pudo crear el segundo profesor');
    const other = await testUtils.login(email, 'Profesor123');
    testUtils.assert(other, 'No se pudo iniciar sesion con el segundo profesor');

    const subjectId = await testUtils.professorSubject();
    const profesor = await testUtils.login(testUtils.accounts.profesor.email, testUtils.accounts.profesor.password);
    const upload = await testUtils.request('/materials/upload', {
        method: 'POST', token: profesor,
        form: testUtils.pdfForm({ titulo: testUtils.uniq('Solo duenio'), tipo: 'PDF', subjects: String(subjectId) }, testUtils.uniq('pdf-duenio'))
    });
    testUtils.assert(upload.status === 201, 'No se pudo subir el material del profesor titular');

    const denied = await testUtils.request(`/materials/${upload.data.material.id}`, {
        method: 'PUT', token: other, body: { titulo: 'Intento ajeno' }
    });
    testUtils.assert(denied.status === 403, 'Otro profesor no debe editar material ajeno');

    const alumno = await testUtils.registerVerifiedAlumno('alumno-edicion');
    const studentUpload = await testUtils.request('/materials/upload', {
        method: 'POST', token: alumno.token,
        form: testUtils.pdfForm({ titulo: testUtils.uniq('Sugerencia editable'), tipo: 'PDF', subjects: String(subjectId) }, testUtils.uniq('pdf-sugerencia'))
    });
    testUtils.assert(studentUpload.status === 201, 'El alumno no pudo sugerir material');

    const allowed = await testUtils.request(`/materials/${studentUpload.data.material.id}`, {
        method: 'PUT', token: profesor, body: { titulo: testUtils.uniq('Editado por docente') }
    });
    testUtils.assert(allowed.ok, 'El profesor titular debe editar material sugerido por alumnos');
});
