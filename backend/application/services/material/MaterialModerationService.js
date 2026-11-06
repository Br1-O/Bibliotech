/**
 * Project     : Bibliotech  |  Capa: Aplicacion - Material
 * Moderacion de sugerencias: aprobacion, rechazo y bandejas pendientes.
 */

const db = require('../../../config/db');
const MaterialPolicy = require('../../../domain/policies/MaterialPolicy');
const AuditLog = require('../../../domain/entities/AuditLog');
const AppError = require('../../../utils/AppError');
const MaterialServiceContext = require('./MaterialServiceContext');

const requireId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('validation.invalidData', { status: 422 });
    }
    return id;
};

class MaterialModerationService extends MaterialServiceContext {
    async approveMaterial(materialId, subjectId, ctx) {
        materialId = requireId(materialId);
        subjectId = requireId(subjectId);
        return db.transaction(async () => {
            const subject = await this.subjectRepository.findById(subjectId);
            if (!subject) throw new AppError('errors.notFound', { status: 404 });
            if (!MaterialPolicy.canModerateSubject(subject, ctx)) {
                throw new AppError('errors.forbidden', { status: 403 });
            }

            const association = await this.materialRepository.findAssociation(materialId, subjectId);
            if (!association) throw new AppError('errors.notFound', { status: 404 });
            if (association.estadoAprobacion !== 'Pendiente') {
                throw new AppError('validation.invalidState', { status: 409 });
            }

            const transitioned = await this.materialRepository.approveAssociation(materialId, subjectId);
            if (!transitioned) throw new AppError('validation.invalidState', { status: 409 });
            const approved = await this.materialRepository.markApproved(materialId);
            if (!approved) throw new AppError('validation.invalidState', { status: 409 });
            const material = await this.materialRepository.findById(materialId);
            await this.notifyObservers(subject, material);
            if (this.gamificationService && material) {
                await this.gamificationService.onMaterialApproved(material.autorId);
                await this.gamificationService.notifyFollowers(material.autorId, {
                    type: 'upload',
                    materialId: material.id,
                    message: material.titulo
                });
            }
            await this.auditLogService.record(AuditLog.OPERACIONES.APROBACION_MATERIAL, ctx.usuarioId, materialId);
            return { message: 'messages.materialApproved' };
        });
    }

    async getPendingForProfessor(profesorId, filters = {}) {
        const { items, total } = await this.materialRepository.findPendingForProfessor(profesorId, filters);
        return { materials: items, total };
    }

    async rejectMaterial(materialId, subjectId, ctx) {
        materialId = requireId(materialId);
        subjectId = requireId(subjectId);
        const result = await db.transaction(async () => {
            const subject = await this.subjectRepository.findById(subjectId);
            if (!subject) throw new AppError('errors.notFound', { status: 404 });
            if (!MaterialPolicy.canModerateSubject(subject, ctx)) {
                throw new AppError('errors.forbidden', { status: 403 });
            }
            const material = await this.materialRepository.findById(materialId);
            if (!material) throw new AppError('errors.notFound', { status: 404 });
            const association = await this.materialRepository.findAssociation(materialId, subjectId);
            if (!association) throw new AppError('errors.notFound', { status: 404 });
            if (association.estadoAprobacion !== 'Pendiente') {
                throw new AppError('validation.invalidState', { status: 409 });
            }

            const removed = await this.materialRepository.deleteAssociation(materialId, subjectId);
            if (!removed) throw new AppError('validation.invalidState', { status: 409 });
            const remaining = await this.materialRepository.countAssociations(materialId);
            let rejected = false;
            if (remaining === 0 && material.estado === 'Pendiente') {
                rejected = await this.materialRepository.rejectPendingUpload(materialId);
            }

            await this.auditLogService.record(AuditLog.OPERACIONES.CANCELACION_MATERIAL, ctx.usuarioId, materialId);
            return { rejected, obsolete: rejected ? material : null };
        });

        if (result.obsolete) await this.deleteStoredFiles(result.obsolete);
        return { message: 'messages.associationRejected', rejected: result.rejected };
    }

    async getPendingMaterials(usuarioId, filters = {}) {
        const { items, total } = await this.materialRepository.findPendingByAuthor(usuarioId, filters);
        return { materials: items, total };
    }
}

module.exports = MaterialModerationService;
