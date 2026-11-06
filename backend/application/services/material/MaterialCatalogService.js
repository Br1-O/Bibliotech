/**
 * Project     : Bibliotech  |  Capa: Aplicacion - Material
 * Consultas de catalogo, autor y materias.
 */

const AppError = require('../../../utils/AppError');
const MaterialServiceContext = require('./MaterialServiceContext');

class MaterialCatalogService extends MaterialServiceContext {
    async getMyUploads(usuarioId, filters = {}) {
        const { items, total } = await this.materialRepository.findByAuthor(usuarioId, filters);
        await this.attachFavoriteFlag(items, usuarioId);
        return { materials: await this.attachUserFlags(items, usuarioId), total };
    }

    async getByAuthor(authorId, filters = {}, usuarioId = null) {
        const { items, total } = await this.materialRepository.findByAuthor(authorId, filters);
        await this.attachFavoriteFlag(items, usuarioId);
        return { materials: await this.attachUserFlags(items, usuarioId), total };
    }

    async getGlobalContent(filters, usuarioId = null) {
        const { items, total } = await this.materialRepository.findAllGlobal(filters);
        await this.attachFavoriteFlag(items, usuarioId);
        return { materials: await this.attachUserFlags(items, usuarioId), total };
    }

    async getBySubject(subjectId, filters, usuarioId = null) {
        const subject = await this.subjectRepository.findById(subjectId);
        if (!subject) throw new AppError('errors.notFound', { status: 404 });
        const { items, total } = await this.materialRepository.findBySubject(subjectId, filters);
        await this.attachFavoriteFlag(items, usuarioId);
        return { subject, materials: await this.attachUserFlags(items, usuarioId), total };
    }

    async attachUserFlags(materials, usuarioId) {
        if (!this.gamificationService || !usuarioId || !materials?.length) return materials;
        return this.gamificationService.getFlagsForMaterials(usuarioId, materials);
    }

    async attachFavoriteFlag(materials, usuarioId) {
        if (!usuarioId || !materials || !materials.length) return materials;
        const ids = await this.materialRepository.findFavoriteIds(
            usuarioId,
            materials.map((m) => m.id)
        );
        const set = new Set(ids.map(Number));
        materials.forEach((m) => {
            m.esFavorito = set.has(Number(m.id)) ? 1 : 0;
        });
        return materials;
    }
}

module.exports = MaterialCatalogService;
