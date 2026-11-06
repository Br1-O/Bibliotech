/**
 * Project     : Bibliotech  |  Capa: Aplicacion - Material
 * Favoritos del usuario autenticado.
 */

const AppError = require('../../../utils/AppError');
const MaterialServiceContext = require('./MaterialServiceContext');

const requireId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('validation.invalidData', { status: 422 });
    }
    return id;
};

class MaterialFavoriteService extends MaterialServiceContext {
    async toggleFavorite(materialId, usuarioId) {
        materialId = requireId(materialId);
        if (!usuarioId) throw new AppError('errors.invalidData', { status: 400 });
        const material = await this.materialRepository.findById(materialId);
        if (!material) throw new AppError('errors.notFound', { status: 404 });
        const result = await this.materialRepository.toggleFavorite(materialId, usuarioId);
        if (this.gamificationService) {
            await this.gamificationService.onFavoriteChanged(usuarioId);
        }
        return result;
    }

    async getFavorites(usuarioId, filters = {}) {
        const { items, total } = await this.materialRepository.findFavorites(usuarioId, filters);
        if (!this.gamificationService || !items?.length) return { materials: items, total };
        return { materials: await this.gamificationService.getFlagsForMaterials(usuarioId, items), total };
    }
}

module.exports = MaterialFavoriteService;
