/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Navegacion)
* Sirve las pantallas del frontend mediante rutas amigables.
*/

const express = require('express');
const path = require('path');

const FRONTEND = path.join(__dirname, '../../frontend/html');
const page = (file) => (req, res) => res.sendFile(path.join(FRONTEND, file));

module.exports = () => {
    const router = express.Router();

    router.get(['/', '/catalogo'], page('index.html'));
    router.get('/login', page('login.html'));
    router.get('/register', page('register.html'));
    router.get('/forgot-password', page('forgot-password.html'));
    router.get('/reset-password', page('reset-password.html'));
    router.get('/materia/:id', page('subject.html'));
    router.get('/alumno', page('dashboard-alumno.html'));
    router.get('/profesor', page('dashboard-profesor.html'));
    router.get('/admin', page('dashboard-admin.html'));
    router.get('/favoritos', page('favorites.html'));
    router.get('/tests', page('tests.html'));

    // 404: redirige al catalogo (excepto recursos estaticos con extension).
    router.use((req, res) => {
        if (req.path.includes('.')) return res.status(404).send('Recurso no encontrado');
        return res.status(404).sendFile(path.join(FRONTEND, 'index.html'));
    });

    return router;
};
