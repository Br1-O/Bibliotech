/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Rutas REST)
* Rutas de materias y material por materia.
*/

const express = require('express');
const { verifyToken, optionalAuth, requireRole } = require('../middleware/authMiddleware');

module.exports = (container) => {
    const router = express.Router();
    const controller = require('../controllers/subjectController')(container);
    const Role = require('../domain/entities/Role');

    router.get('/', optionalAuth, controller.list);
    router.get('/:id', optionalAuth, controller.getById);
    router.get('/:id/materials', optionalAuth, controller.materials);

    router.post('/', verifyToken, requireRole(Role.SUPERADMIN), controller.create);
    router.post('/:id/request-association', verifyToken, requireRole(Role.PROFESOR), controller.requestAssociation);
    router.post('/:id/confirm-association', verifyToken, requireRole(Role.SUPERADMIN), controller.confirmAssociation);
    router.post('/:id/reject-association', verifyToken, requireRole(Role.SUPERADMIN), controller.rejectAssociation);
    router.put('/:id', verifyToken, requireRole(Role.SUPERADMIN), controller.update);

    return router;
};
