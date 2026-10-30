/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Rutas REST)
* Rutas de autenticacion, usuarios y roles.
*/

const express = require('express');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

module.exports = (container) => {
    const router = express.Router();
    const controller = require('../controllers/authController')(container);
    const Role = require('../domain/entities/Role');

    router.post('/register', controller.register);
    router.post('/verify-account', controller.verifyAccount);
    router.get('/verify-account', controller.verifyAccount);
    router.post('/activate', controller.activateAccount);
    router.get('/activate/:token', controller.activateAccount);
    router.post('/resend-verification', controller.resendVerification);
    router.post('/login', controller.login);
    router.post('/forgot-password', controller.forgotPassword);
    router.get('/reset-password/:token/validate', controller.validateResetToken);
    router.post('/reset-password', controller.resetPassword);
    router.get('/roles', controller.listRoles);

    router.get('/me', verifyToken, controller.me);
    router.put('/password', verifyToken, controller.changePassword);
    router.post('/professors', verifyToken, requireRole(Role.SUPERADMIN), controller.createProfessor);
    router.get('/users', verifyToken, requireRole(Role.SUPERADMIN), controller.listUsers);
    router.put('/users/:id/ban', verifyToken, requireRole(Role.SUPERADMIN), controller.banUser);
    router.put('/users/:id/unban', verifyToken, requireRole(Role.SUPERADMIN), controller.unbanUser);
    router.delete('/users/:id', verifyToken, requireRole(Role.SUPERADMIN), controller.softDeleteUser);

    return router;
};
