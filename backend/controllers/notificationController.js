/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (REST)
* NotificationController: bandeja y lectura de notificaciones del usuario.
*/

const { ok } = require('../utils/respond');
const { parsePagination, paginationMeta } = require('../utils/pagination');

module.exports = (container) => {
    const { notificationService } = container;

    return {
        async list(req, res, next) {
            try {
                const pagination = parsePagination(req.query);
                const result = await notificationService.list(req.usuarioId, pagination);
                return ok(req, res, {
                    notifications: result.notifications,
                    unreadCount: result.unreadCount,
                    pagination: paginationMeta(result.total, pagination)
                });
            } catch (error) { return next(error); }
        },

        async read(req, res, next) {
            try {
                const result = await notificationService.markRead(Number(req.params.id), req.usuarioId);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async readAll(req, res, next) {
            try {
                const result = await notificationService.markAllRead(req.usuarioId);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        }
    };
};
