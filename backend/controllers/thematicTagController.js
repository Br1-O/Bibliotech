/**
* Project     : Bibliotech
* Controlador de etiquetas tematicas
*/

const { ok } = require('../utils/respond');

module.exports = (container) => {
    const { thematicTagService } = container;

    return {
        async list(req, res, next) {
            try {
                const tags = await thematicTagService.list(req.query);
                return ok(req, res, { tags });
            } catch (error) { return next(error); }
        },
        async create(req, res, next) {
            try {
                const tag = await thematicTagService.create(req.body, req.usuarioId);
                return ok(req, res, { tag }, 201);
            } catch (error) { return next(error); }
        },
        async ban(req, res, next) {
            try {
                const tag = await thematicTagService.ban(req.params.id, req.usuarioId);
                return ok(req, res, { tag });
            } catch (error) { return next(error); }
        },
        async remove(req, res, next) {
            try {
                await thematicTagService.remove(req.params.id, req.usuarioId);
                return ok(req, res, { message: 'ok' });
            } catch (error) { return next(error); }
        }
    };
};
