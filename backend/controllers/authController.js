/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (REST)
* AuthController: endpoints de autenticacion, registro y roles (RF-01).
*/

const { ok } = require('../utils/respond');
const { parsePagination, paginationMeta } = require('../utils/pagination');

module.exports = (container) => {
    const { authService, roleService, authMiddleware } = container;
    const { setFileCookie, clearFileCookie } = authMiddleware;

    return {
        async register(req, res, next) {
            try {
                const result = await authService.register(req.body);
                return ok(req, res, { message: 'messages.registerSuccess', ...result }, 201);
            } catch (error) { return next(error); }
        },

        async login(req, res, next) {
            try {
                const result = await authService.login(req.body);
                setFileCookie(req, res, result.token);
                return ok(req, res, { message: 'messages.loginSuccess', ...result });
            } catch (error) { return next(error); }
        },

        async logout(req, res) {
            clearFileCookie(req, res);
            return res.status(204).end();
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

        async verifyAccount(req, res, next) {
            try {
                const source = { ...(req.query || {}), ...(req.body || {}) };
                const result = await authService.verifyAccount({
                    token: source.token || source.code,
                    email: source.email || null
                });
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async activateAccount(req, res, next) {
            try {
                const token = req.params.token || (req.body && req.body.token);
                const result = await authService.activateAccount(token);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async validateResetToken(req, res, next) {
            try {
                const valid = await authService.validateResetToken(req.params.token);
                return ok(req, res, { valid });
            } catch (error) { return next(error); }
        },

        async resendVerification(req, res, next) {
            try {
                const result = await authService.resendVerification(req.body.email);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async resetPassword(req, res, next) {
            try {
                const result = await authService.resetPassword(
                    req.body.token || req.body.code,
                    req.body.password,
                    req.body.passwordConfirm
                );
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async changePassword(req, res, next) {
            try {
                const result = await authService.changePassword(req.usuarioId, req.body || {});
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
                const pagination = parsePagination(req.query, { defaultPageSize: 100 });
                const result = await authService.listUsers({
                    ...pagination,
                    q: req.query.q || '',
                    role: req.query.role || null,
                    estado: req.query.estado || null
                });
                return ok(req, res, {
                    users: result.items,
                    pagination: paginationMeta(result.total, pagination)
                });
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

        async changeUserRole(req, res, next) {
            try {
                const user = await authService.changeUserRole(
                    Number(req.params.id),
                    req.body?.role,
                    req.usuarioId
                );
                return ok(req, res, { message: 'messages.roleChanged', user });
            } catch (error) { return next(error); }
        },

    };
};
