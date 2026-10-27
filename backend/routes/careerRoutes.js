/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Rutas REST)
* Rutas de carreras y anios academicos.
*/

const express = require('express');
const { verifyToken, optionalAuth, requireRole } = require('../middleware/authMiddleware');

module.exports = (container) => {
    const router = express.Router();
    const controller = require('../controllers/careerController')(container);
    const Role = require('../domain/entities/Role');

    router.get('/', optionalAuth, controller.list);
    router.get('/:id', optionalAuth, controller.getById);

    router.post('/', verifyToken, requireRole(Role.SUPERADMIN), controller.create);
    router.put('/:id', verifyToken, requireRole(Role.SUPERADMIN), controller.update);
    router.post('/:id/years', verifyToken, requireRole(Role.SUPERADMIN), controller.createYear);
    router.put('/years/:yearId', verifyToken, requireRole(Role.SUPERADMIN), controller.updateYear);

    return router;
};
