/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Rutas REST)
* Rutas de perfil, gamificacion y engagement.
*/

const express = require('express');
const { verifyToken, optionalAuth } = require('../middleware/authMiddleware');

module.exports = (container) => {
    const router = express.Router();
    const controller = require('../controllers/engagementController')(container);

    router.get('/profile/:id', optionalAuth, controller.profile);
    router.get('/users/:id/favorites', optionalAuth, controller.favorites);
    router.get('/users/:id/uploads', optionalAuth, controller.uploads);
    router.get('/users/:id/reads', optionalAuth, controller.reads);
    router.get('/users/:id/backlog', optionalAuth, controller.backlog);

    router.put('/profile', verifyToken, controller.updateProfile);
    router.get('/profile-pictures', verifyToken, controller.profilePictures);

    router.get('/reads', verifyToken, controller.reads);
    router.get('/reads/:materialId', verifyToken, controller.getRead);
    router.post('/reads/:materialId/toggle', verifyToken, controller.toggleRead);
    router.put('/reads/:materialId/progress', verifyToken, controller.updateProgress);

    router.get('/backlog', verifyToken, controller.backlog);
    router.post('/backlog/:materialId', verifyToken, controller.addBacklog);
    router.delete('/backlog/:materialId', verifyToken, controller.removeBacklog);

    router.post('/subscriptions/:userId', verifyToken, controller.follow);
    router.delete('/subscriptions/:userId', verifyToken, controller.unfollow);

    return router;
};
