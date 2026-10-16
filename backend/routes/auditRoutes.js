/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Rutas REST)
* Rutas del registro de auditoria (RD-06).
*/

const express = require('express');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

module.exports = (container) => {
    const router = express.Router();
    const controller = require('../controllers/auditController')(container);
    const Role = require('../domain/entities/Role');

    router.get('/', verifyToken, requireRole(Role.SUPERADMIN), controller.list);
    router.get('/user/:id', verifyToken, requireRole(Role.SUPERADMIN), controller.byUser);

    return router;
};
