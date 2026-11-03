/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Rutas REST)
* Rutas de notificaciones del usuario autenticado.
*/

const express = require('express');

module.exports = (container) => {
    const router = express.Router();
    const controller = require('../controllers/notificationController')(container);
    const { verifyToken } = container.authMiddleware;

    router.use(verifyToken);

    router.get('/', controller.list);
    router.post('/read-all', controller.readAll);
    router.post('/:id/read', controller.read);

    return router;
};
