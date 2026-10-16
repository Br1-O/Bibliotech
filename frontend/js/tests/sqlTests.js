/**
 * Project : Bibliotech | Frontend - Suite de pruebas
 * Seguridad: intento de inyeccion SQL en el login (debe ser rechazado).
 */

testUtils.createTestButton('Test SQL Injection en Login', async () => {
    const r = await testUtils.request('/auth/login', {
        method: 'POST',
        body: { email: "admin@bibliotech.edu' OR '1'='1", password: "x' OR 1=1;--" }
    });
    testUtils.log({ status: r.status, message: r.data && r.data.message });
    testUtils.assert(r.status === 401, 'La inyeccion SQL no debe autenticar');
});

testUtils.createTestButton('Test SQL Injection en Busqueda Global', async () => {
    const q = "' OR '1'='1";
    const r = await testUtils.request('/materials/global?q=' + encodeURIComponent(q));
    testUtils.log({ status: r.status, total: r.data && r.data.materials.length });
    testUtils.assert(r.ok, 'La busqueda no debe romper el servidor');
    testUtils.assert(Array.isArray(r.data.materials), 'Se esperaba un arreglo de materiales');
});
