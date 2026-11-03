/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Rutas REST)
* Rutas de rachas de lectura.
*/

const express = require('express');

module.exports = (container) => {
    const router = express.Router();
    const controller = require('../controllers/engagementController')(container);
    const { verifyToken } = container.authMiddleware;

    router.use(verifyToken);
    router.get('/', controller.streak);
    router.post('/heartbeat', controller.heartbeat);
    router.post('/reset', controller.resetStreak);

    return router;
};
