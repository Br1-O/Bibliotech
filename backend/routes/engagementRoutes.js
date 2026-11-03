/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Rutas REST)
* Rutas de perfil, gamificacion y engagement.
*/

const express = require('express');

module.exports = (container) => {
    const router = express.Router();
    const controller = require('../controllers/engagementController')(container);
    const { verifyToken, optionalAuth } = container.authMiddleware;

    router.get('/profile/:id', optionalAuth, controller.profile);
    router.get('/users/:id/favorites', verifyToken, controller.favorites);
    router.get('/users/:id/uploads', optionalAuth, controller.uploads);
    router.get('/users/:id/reads', verifyToken, controller.reads);
    router.get('/users/:id/backlog', verifyToken, controller.backlog);

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
