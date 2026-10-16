/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Rutas REST)
* Rutas de material educativo: vista global, subida, moderacion.
*/

const express = require('express');
const { verifyToken, optionalAuth, requireRole } = require('../middleware/authMiddleware');
const upload = require('../config/multerConfig');

module.exports = (container) => {
    const router = express.Router();
    const controller = require('../controllers/materialController')(container);
    const Role = require('../domain/entities/Role');

    router.get('/global', optionalAuth, controller.global);
    router.get('/pending', verifyToken, requireRole(Role.ALUMNO, Role.PROFESOR), controller.pending);
    router.get('/pending-review', verifyToken, requireRole(Role.PROFESOR, Role.SUPERADMIN), controller.pendingReview);

    router.post('/upload', verifyToken, requireRole(Role.ALUMNO, Role.PROFESOR), upload, controller.upload);
    router.post('/:id/approve', verifyToken, requireRole(Role.PROFESOR, Role.SUPERADMIN), controller.approve);
    router.post('/:id/reject', verifyToken, requireRole(Role.PROFESOR, Role.SUPERADMIN), controller.reject);
    router.post('/:id/associate', verifyToken, requireRole(Role.PROFESOR, Role.SUPERADMIN), controller.associate);
    router.post('/:id/cancel', verifyToken, requireRole(Role.ALUMNO, Role.PROFESOR), controller.cancel);
    router.delete('/:id', verifyToken, requireRole(Role.PROFESOR, Role.SUPERADMIN), controller.remove);

    return router;
};
