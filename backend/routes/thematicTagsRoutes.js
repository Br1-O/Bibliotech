/**
* Project     : Bibliotech
* Rutas para etiquetas tematicas
*/

const express = require('express');

module.exports = (container) => {
    const router = express.Router();
    const controller = require('../controllers/thematicTagController')(container);
    const { verifyToken, requireRole } = container.authMiddleware;
    const Role = require('../domain/entities/Role');

    router.get('/', controller.list);
    router.post('/', verifyToken, requireRole(Role.ALUMNO, Role.PROFESOR, Role.SUPERADMIN), controller.create);
    router.put('/:id/ban', verifyToken, requireRole(Role.SUPERADMIN), controller.ban);
    router.delete('/:id', verifyToken, requireRole(Role.SUPERADMIN), controller.remove);

    return router;
};
