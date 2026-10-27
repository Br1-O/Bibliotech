/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (REST)
* NotificationController: bandeja y lectura de notificaciones del usuario.
*/

const { ok } = require('../utils/respond');

module.exports = (container) => {
    const { notificationService } = container;

    return {
        async list(req, res, next) {
            try {
                const result = await notificationService.list(req.usuarioId);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async read(req, res, next) {
            try {
                const result = await notificationService.markRead(Number(req.params.id), req.usuarioId);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        }
    };
};
