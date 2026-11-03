/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Rutas REST)
* Rutas de autenticacion, usuarios y roles.
*/

const express = require('express');
const { loginRateLimit, recoveryRateLimit } = require('../middleware/authRateLimitMiddleware');

module.exports = (container) => {
    const router = express.Router();
    const controller = require('../controllers/authController')(container);
    const { verifyToken, requireRole } = container.authMiddleware;
    const Role = require('../domain/entities/Role');

    router.post('/register', controller.register);
    router.post('/verify-account', ...recoveryRateLimit(), controller.verifyAccount);
    router.get('/verify-account', ...recoveryRateLimit(), controller.verifyAccount);
    router.post('/activate', ...recoveryRateLimit(), controller.activateAccount);
    router.get('/activate/:token', ...recoveryRateLimit(), controller.activateAccount);
    router.post('/resend-verification', ...recoveryRateLimit(), controller.resendVerification);
    router.post('/login', ...loginRateLimit(), controller.login);
    router.post('/logout', controller.logout);
    router.post('/forgot-password', ...recoveryRateLimit(), controller.forgotPassword);
    router.get('/reset-password/:token/validate', ...recoveryRateLimit(), controller.validateResetToken);
    router.post('/reset-password', ...recoveryRateLimit(), controller.resetPassword);
    router.get('/roles', controller.listRoles);

    router.get('/me', verifyToken, controller.me);
    router.put('/password', verifyToken, controller.changePassword);
    router.post('/professors', verifyToken, requireRole(Role.SUPERADMIN), controller.createProfessor);
    router.get('/users', verifyToken, requireRole(Role.SUPERADMIN), controller.listUsers);
    router.put('/users/:id/ban', verifyToken, requireRole(Role.SUPERADMIN), controller.banUser);
    router.put('/users/:id/unban', verifyToken, requireRole(Role.SUPERADMIN), controller.unbanUser);
    router.put('/users/:id/role', verifyToken, requireRole(Role.SUPERADMIN), controller.changeUserRole);
    router.delete('/users/:id', verifyToken, requireRole(Role.SUPERADMIN), controller.softDeleteUser);

    return router;
};
