/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Rutas REST)
* Rutas de suscripciones (patron Observer) y moderacion.
*/

const express = require('express');

module.exports = (container) => {
    const router = express.Router();
    const controller = require('../controllers/subscriptionController')(container);
    const { verifyToken, requireRole } = container.authMiddleware;
    const Role = require('../domain/entities/Role');

    router.use(verifyToken);

    router.get('/mine', requireRole(Role.ALUMNO), controller.mine);
    router.post('/subscribe/:subjectId', requireRole(Role.ALUMNO), controller.subscribe);
    router.delete('/subscribe/:subjectId', requireRole(Role.ALUMNO), controller.unsubscribe);
    router.get('/subject/:subjectId/observers', requireRole(Role.PROFESOR, Role.SUPERADMIN), controller.observers);
    router.post('/ban/:alumnoId/:subjectId', requireRole(Role.PROFESOR, Role.SUPERADMIN), controller.ban);

    return router;
};
