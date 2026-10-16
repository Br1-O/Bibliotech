/**
* Project     : Bibliotech
* Rutas para etiquetas tematicas
*/

const express = require('express');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

module.exports = (container) => {
    const router = express.Router();
    const controller = require('../controllers/thematicTagController')(container);
    const Role = require('../domain/entities/Role');

    router.get('/', controller.list);
    router.post('/', verifyToken, requireRole(Role.ALUMNO, Role.PROFESOR, Role.SUPERADMIN), controller.create);
    router.put('/:id/ban', verifyToken, requireRole(Role.SUPERADMIN), controller.ban);
    router.delete('/:id', verifyToken, requireRole(Role.SUPERADMIN), controller.remove);

    return router;
};
