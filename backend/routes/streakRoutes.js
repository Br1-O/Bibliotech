/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Rutas REST)
* Rutas de rachas de lectura.
*/

const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');

module.exports = (container) => {
    const router = express.Router();
    const controller = require('../controllers/engagementController')(container);

    router.use(verifyToken);
    router.get('/', controller.streak);
    router.post('/heartbeat', controller.heartbeat);
    router.post('/reset', controller.resetStreak);

    return router;
};
