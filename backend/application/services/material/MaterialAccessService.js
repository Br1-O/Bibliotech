/**
 * Project     : Bibliotech  |  Capa: Aplicacion - Material
 * Resolucion de acceso a archivos y descargas.
 */

const MaterialPolicy = require('../../../domain/policies/MaterialPolicy');
const AppError = require('../../../utils/AppError');
const mediaValidator = require('../../../utils/mediaValidator');
const MaterialServiceContext = require('./MaterialServiceContext');

const requireId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('validation.invalidData', { status: 422 });
    }
    return id;
};

class MaterialAccessService extends MaterialServiceContext {
    async getDownloadable(materialId, ctx = {}, options = {}) {
        materialId = requireId(materialId);
        const material = await this.materialRepository.findFileSourceById(materialId);
        if (!material) throw new AppError('errors.notFound', { status: 404 });
        if (!mediaValidator.isFileType(material.tipo)) {
            throw new AppError('errors.notFound', { status: 404 });
        }
        if (MaterialPolicy.isPubliclyReadable(material)) return material;

        let current = ctx || {};
        if (!current.usuarioId && typeof options.authenticate === 'function') {
            current = await options.authenticate();
        }

        let ownedSubjectIds = [];
        if (current.rol === 'Profesor' && !MaterialPolicy.isOwner(material, current)) {
            const owned = await this.materialRepository.findById(materialId);
            ownedSubjectIds = owned ? await this.ownedSubjectIds(owned, current) : [];
        }

        if (!MaterialPolicy.canAccessFile(material, current, { ownedSubjectIds })) {
            throw new AppError('errors.forbidden', { status: 403 });
        }
        return material;
    }
}

module.exports = MaterialAccessService;
