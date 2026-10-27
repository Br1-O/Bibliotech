/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Rutas REST)
* Rutas de notificaciones del usuario autenticado.
*/

const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');

module.exports = (container) => {
    const router = express.Router();
    const controller = require('../controllers/notificationController')(container);

    router.use(verifyToken);

    router.get('/', controller.list);
    router.post('/read-all', controller.readAll);
    router.post('/:id/read', controller.read);

    return router;
};
