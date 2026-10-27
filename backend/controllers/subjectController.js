/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (REST)
* SubjectController: materias, asociaciones y material por materia (RF-02, RF-04).
*/

const { ok } = require('../utils/respond');

module.exports = (container) => {
    const { subjectService, materialService } = container;

    return {
        async list(req, res, next) {
            try {
                const filters = {
                    q: req.query.q || '',
                    careerId: req.query.careerId ? Number(req.query.careerId) : null,
                    yearId: req.query.yearId ? Number(req.query.yearId) : null,
                    profesorId: req.query.profesorId ? Number(req.query.profesorId) : null
                };
                const subjects = await subjectService.getAllSubjects(filters);
                return ok(req, res, { subjects });
            } catch (error) { return next(error); }
        },

        async getById(req, res, next) {
            try {
                const subject = await subjectService.getSubjectById(req.params.id);
                return ok(req, res, { subject });
            } catch (error) { return next(error); }
        },

        async create(req, res, next) {
            try {
                const subject = await subjectService.createSubject(req.body, req.usuarioId);
                return ok(req, res, { message: 'messages.subjectCreated', subject }, 201);
            } catch (error) { return next(error); }
        },

        async requestAssociation(req, res, next) {
            try {
                const result = await subjectService.requestAssociation(req.params.id, req.usuarioId);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async confirmAssociation(req, res, next) {
            try {
                const result = await subjectService.confirmAssociation(req.params.id, req.body.profesorId, req.usuarioId);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async rejectAssociation(req, res, next) {
            try {
                const result = await subjectService.rejectAssociation(req.params.id, req.usuarioId);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async materials(req, res, next) {
            try {
                const filters = {
                    q: req.query.q || '',
                    tipo: req.query.tipo || null,
                    tags: req.query.tags ? [].concat(req.query.tags) : []
                };
                const result = await materialService.getBySubject(req.params.id, filters, req.usuarioId);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async update(req, res, next) {
            try {
                const subject = await subjectService.updateSubject(req.params.id, req.body, req.usuarioId);
                return ok(req, res, { subject });
            } catch (error) { return next(error); }
        },

    };
};
