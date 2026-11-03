/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (REST)
* EngagementController: perfil publico/privado, lecturas, backlog y seguidores.
*/

const { ok } = require('../utils/respond');
const AppError = require('../utils/AppError');
const { parsePagination, paginationMeta } = require('../utils/pagination');

const targetUserId = (req) => Number(req.params.id) || Number(req.usuarioId);
const assertOwnerOrAdmin = (req, userId) => {
    if (Number(req.usuarioId) !== Number(userId) && req.rol !== 'Superadmin') {
        throw new AppError('errors.forbidden', { status: 403 });
    }
};

module.exports = (container) => {
    const { gamificationService, materialService } = container;

    return {
        async profile(req, res, next) {
            try {
                const result = await gamificationService.getProfile(Number(req.params.id), req.usuarioId);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async updateProfile(req, res, next) {
            try {
                const result = await gamificationService.updateProfile(req.usuarioId, req.body || {});
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async profilePictures(req, res, next) {
            try {
                const pictures = await gamificationService.listProfilePictures(req.usuarioId);
                return ok(req, res, { pictures });
            } catch (error) { return next(error); }
        },

        async favorites(req, res, next) {
            try {
                const userId = targetUserId(req);
                assertOwnerOrAdmin(req, userId);
                const pagination = parsePagination(req.query);
                const result = await materialService.getFavorites(userId, pagination);
                return ok(req, res, {
                    materials: result.materials,
                    pagination: paginationMeta(result.total, pagination)
                });
            } catch (error) { return next(error); }
        },

        async uploads(req, res, next) {
            try {
                const pagination = parsePagination(req.query);
                const result = await materialService.getByAuthor(
                    Number(req.params.id), { estado: 'Aprobado', ...pagination }, req.usuarioId
                );
                return ok(req, res, {
                    materials: result.materials,
                    pagination: paginationMeta(result.total, pagination)
                });
            } catch (error) { return next(error); }
        },

        async reads(req, res, next) {
            try {
                const userId = targetUserId(req);
                assertOwnerOrAdmin(req, userId);
                const pagination = parsePagination(req.query);
                const result = await gamificationService.listReads(userId, pagination);
                return ok(req, res, {
                    materials: result.materials,
                    pagination: paginationMeta(result.total, pagination)
                });
            } catch (error) { return next(error); }
        },

        async backlog(req, res, next) {
            try {
                const userId = targetUserId(req);
                assertOwnerOrAdmin(req, userId);
                const pagination = parsePagination(req.query);
                const result = await gamificationService.listBacklog(userId, pagination);
                return ok(req, res, {
                    items: result.items,
                    pagination: paginationMeta(result.total, pagination)
                });
            } catch (error) { return next(error); }
        },

        async getRead(req, res, next) {
            try {
                const result = await gamificationService.getRead(req.usuarioId, Number(req.params.materialId));
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async toggleRead(req, res, next) {
            try {
                const result = await gamificationService.toggleRead(req.usuarioId, Number(req.params.materialId));
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async updateProgress(req, res, next) {
            try {
                const result = await gamificationService.updateProgress(
                    req.usuarioId, Number(req.params.materialId),
                    req.body.currentPage, req.body.totalPages
                );
                return ok(req, res, { read: result });
            } catch (error) { return next(error); }
        },

        async addBacklog(req, res, next) {
            try {
                const result = await gamificationService.addToBacklog(req.usuarioId, Number(req.params.materialId));
                return ok(req, res, result, 201);
            } catch (error) { return next(error); }
        },

        async removeBacklog(req, res, next) {
            try {
                const result = await gamificationService.removeFromBacklog(req.usuarioId, Number(req.params.materialId));
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async follow(req, res, next) {
            try {
                const result = await gamificationService.follow(req.usuarioId, Number(req.params.userId));
                return ok(req, res, result, 201);
            } catch (error) { return next(error); }
        },

        async unfollow(req, res, next) {
            try {
                const result = await gamificationService.unfollow(req.usuarioId, Number(req.params.userId));
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async heartbeat(req, res, next) {
            try {
                const streak = await gamificationService.heartbeat(req.usuarioId, {
                    materialId: req.body?.materialId
                });
                return ok(req, res, { streak });
            } catch (error) { return next(error); }
        },

        async resetStreak(req, res, next) {
            try {
                const result = await gamificationService.resetHeartbeat(req.usuarioId, req.body?.materialId);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async streak(req, res, next) {
            try {
                const result = await gamificationService.getProfile(req.usuarioId, req.usuarioId);
                return ok(req, res, { streak: result.streak });
            } catch (error) { return next(error); }
        }
    };
};
