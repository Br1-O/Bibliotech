/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (REST)
* SubscriptionController: suscripciones (Observer) y baneo (RF-03, RF-05).
*/

const { ok } = require('../utils/respond');

module.exports = (container) => {
    const { subscriptionService } = container;

    return {
        async subscribe(req, res, next) {
            try {
                const result = await subscriptionService.subscribe(req.usuarioId, Number(req.params.subjectId));
                return ok(req, res, result, 201);
            } catch (error) { return next(error); }
        },

        async unsubscribe(req, res, next) {
            try {
                const result = await subscriptionService.unsubscribe(req.usuarioId, Number(req.params.subjectId));
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async mine(req, res, next) {
            try {
                const subscriptions = await subscriptionService.getMySubscriptions(req.usuarioId);
                return ok(req, res, { subscriptions });
            } catch (error) { return next(error); }
        },

        async observers(req, res, next) {
            try {
                const observers = await subscriptionService.getObservers(Number(req.params.subjectId));
                return ok(req, res, { observers });
            } catch (error) { return next(error); }
        },

        async ban(req, res, next) {
            try {
                const result = await subscriptionService.banStudent(
                    Number(req.params.alumnoId), Number(req.params.subjectId),
                    { usuarioId: req.usuarioId, rol: req.rol });
                return ok(req, res, result);
            } catch (error) { return next(error); }
        }
    };
};
