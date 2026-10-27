/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (REST)
* CareerController: carreras y anios academicos (grupos principales y secundarios).
*/

const { ok } = require('../utils/respond');

module.exports = (container) => {
    const { careerService } = container;

    return {
        async list(req, res, next) {
            try {
                const careers = await careerService.getAllCareers();
                return ok(req, res, { careers });
            } catch (error) { return next(error); }
        },

        async getById(req, res, next) {
            try {
                const career = await careerService.getCareerById(req.params.id);
                return ok(req, res, { career });
            } catch (error) { return next(error); }
        },

        async create(req, res, next) {
            try {
                const career = await careerService.createCareer(req.body, req.usuarioId);
                return ok(req, res, { message: 'messages.careerCreated', career }, 201);
            } catch (error) { return next(error); }
        },

        async update(req, res, next) {
            try {
                const career = await careerService.updateCareer(req.params.id, req.body, req.usuarioId);
                return ok(req, res, { message: 'messages.careerUpdated', career });
            } catch (error) { return next(error); }
        },

        async createYear(req, res, next) {
            try {
                const year = await careerService.createYear(req.params.id, req.body, req.usuarioId);
                return ok(req, res, { message: 'messages.yearCreated', year }, 201);
            } catch (error) { return next(error); }
        },

        async updateYear(req, res, next) {
            try {
                const year = await careerService.updateYear(req.params.yearId, req.body, req.usuarioId);
                return ok(req, res, { message: 'messages.yearUpdated', year });
            } catch (error) { return next(error); }
        }
    };
};
