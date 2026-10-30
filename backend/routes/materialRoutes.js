/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Rutas REST)
* Rutas de material educativo: vista global, subida, moderacion.
*/

const express = require('express');
const { verifyToken, optionalAuth, requireRole } = require('../middleware/authMiddleware');
const { materialUpload, batchUpload } = require('../config/multerConfig');
const { uploadRateLimit } = require('../middleware/uploadRateLimitMiddleware');

module.exports = (container) => {
    const router = express.Router();
    const controller = require('../controllers/materialController')(container);
    const Role = require('../domain/entities/Role');

    router.get('/global', optionalAuth, controller.global);
    router.get('/filters', optionalAuth, controller.filters);
    router.get('/author/:id', optionalAuth, controller.author);
    router.get('/mine', verifyToken, requireRole(Role.ALUMNO, Role.PROFESOR, Role.SUPERADMIN), controller.mine);
    router.get('/pending', verifyToken, requireRole(Role.ALUMNO, Role.PROFESOR), controller.pending);
    router.get('/pending-review', verifyToken, requireRole(Role.PROFESOR, Role.SUPERADMIN), controller.pendingReview);
    router.get('/favorites/mine', verifyToken, requireRole(Role.ALUMNO, Role.PROFESOR, Role.SUPERADMIN), controller.getFavorites);

    router.post('/upload', verifyToken, requireRole(Role.ALUMNO, Role.PROFESOR), uploadRateLimit(), materialUpload, controller.upload);
    router.post('/batch', verifyToken, requireRole(Role.SUPERADMIN), uploadRateLimit(), batchUpload, controller.batch);
    router.post('/:id/approve', verifyToken, requireRole(Role.PROFESOR, Role.SUPERADMIN), controller.approve);
    router.post('/:id/reject', verifyToken, requireRole(Role.PROFESOR, Role.SUPERADMIN), controller.reject);
    router.post('/:id/associate', verifyToken, requireRole(Role.PROFESOR), controller.associate);
    router.post('/:id/cancel', verifyToken, requireRole(Role.ALUMNO, Role.PROFESOR), controller.cancel);
    router.put('/:id', verifyToken, requireRole(Role.PROFESOR, Role.SUPERADMIN), materialUpload, controller.update);
    router.delete('/:id/subjects/:subjectId', verifyToken, requireRole(Role.PROFESOR, Role.SUPERADMIN), controller.remove);
    router.delete('/:id', verifyToken, requireRole(Role.SUPERADMIN), controller.remove);

    router.post('/:id/favorite', verifyToken, requireRole(Role.ALUMNO, Role.PROFESOR, Role.SUPERADMIN), controller.toggleFavorite);

    return router;
};
