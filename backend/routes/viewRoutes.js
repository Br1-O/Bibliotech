/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Navegacion)
* Sirve las pantallas del frontend mediante rutas amigables.
*/

const express = require('express');
const path = require('path');

const FRONTEND = path.join(__dirname, '../../frontend/html');
const page = (file) => (req, res) => res.sendFile(path.join(FRONTEND, file));

module.exports = (container) => {
    const router = express.Router();

    router.get(['/', '/catalogo'], page('index.html'));
    router.get('/materias', page('subjects.html'));
    router.get('/login', page('login.html'));
    router.get('/register', page('register.html'));
    router.get('/forgot-password', page('forgot-password.html'));
    router.get('/reset-password', (req, res) => res.redirect('/forgot-password'));
    router.get('/reset-password/:token', (req, res) => res.redirect(`/restablecer-password/${encodeURIComponent(req.params.token)}`));
    router.get('/recuperar', (req, res) => res.redirect('/forgot-password'));

    router.get('/activar-cuenta/:token', async (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.set('Referrer-Policy', 'no-referrer');
        try {
            await container.authService.activateAccount(req.params.token);
            return res.redirect(303, '/login?activacion=exitosa');
        } catch (error) {
            return res.redirect(303, '/login?activacion=invalida');
        }
    });
    router.get('/restablecer-password/:token', (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.set('Referrer-Policy', 'no-referrer');
        res.set('X-Robots-Tag', 'noindex');
        return res.sendFile(path.join(FRONTEND, 'reset-password.html'));
    });
    router.get(['/confirmar-cuenta', '/verify-account'], (req, res) => res.redirect('/login'));
    router.get('/materia/:id', page('subject.html'));
    router.get('/autor/:id', page('author.html'));
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
