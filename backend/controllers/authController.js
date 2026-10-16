/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (REST)
* AuthController: endpoints de autenticacion, registro y roles (RF-01).
*/

const { ok } = require('../utils/respond');

module.exports = (container) => {
    const { authService, roleService, userRepository } = container;

    return {
        async register(req, res, next) {
            try {
                const user = await authService.register(req.body);
                return ok(req, res, { message: 'messages.registerSuccess', user }, 201);
            } catch (error) { return next(error); }
        },

        async login(req, res, next) {
            try {
                const result = await authService.login(req.body);
                return ok(req, res, { message: 'messages.loginSuccess', ...result });
            } catch (error) { return next(error); }
        },

        async me(req, res, next) {
            try {
                const user = await authService.getUserById(req.usuarioId);
                return ok(req, res, { user });
            } catch (error) { return next(error); }
        },

        async forgotPassword(req, res, next) {
            try {
                const result = await authService.requestPasswordReset(req.body.email);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async resetPassword(req, res, next) {
            try {
                const result = await authService.resetPassword(req.body.token, req.body.password);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        /** Superadmin: crea cuentas de profesor (RF-01). */
        async createProfessor(req, res, next) {
            try {
                const user = await authService.createProfessor(req.body, req.usuarioId);
                return ok(req, res, { message: 'messages.registerSuccess', user }, 201);
            } catch (error) { return next(error); }
        },

        async listUsers(req, res, next) {
            try {
                const users = await userRepository.findAll();
                return ok(req, res, { users });
            } catch (error) { return next(error); }
        },

        async listRoles(req, res, next) {
            try {
                const roles = await roleService.getAllRoles();
                return ok(req, res, { roles });
            } catch (error) { return next(error); }
        },
        async banUser(req, res, next) {
            try {
                const result = await authService.banUser(req.params.id, req.usuarioId);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async unbanUser(req, res, next) {
            try {
                const result = await authService.unbanUser(req.params.id, req.usuarioId);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async softDeleteUser(req, res, next) {
            try {
                const result = await authService.softDeleteUser(req.params.id, req.usuarioId);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

    };
};
