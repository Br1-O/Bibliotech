/**
 * Project     : Bibliotech  |  Capa: Aplicacion - Material
 * Asociacion de material existente a materias.
 */

const db = require('../../../config/db');
const MaterialPolicy = require('../../../domain/policies/MaterialPolicy');
const AuditLog = require('../../../domain/entities/AuditLog');
const AppError = require('../../../utils/AppError');
const MaterialServiceContext = require('./MaterialServiceContext');

class MaterialAssociationService extends MaterialServiceContext {
    async associateMaterialToSubjects(materialId, rawSubjectIds, ctx) {
        if (!MaterialPolicy.canAssociate(ctx)) {
            throw new AppError('errors.forbidden', { status: 403 });
        }

        const material = await this.materialRepository.findById(materialId);
        if (!material) throw new AppError('errors.notFound', { status: 404 });
        if (MaterialPolicy.isFinalState(material)) {
            throw new AppError('validation.invalidState', { status: 409 });
        }

        const subjectIds = this.normalizeSubjectIds(rawSubjectIds);
        const subjects = await this.assertProfessorOwnsSubjects(subjectIds, ctx);

        return db.transaction(async () => {
            for (const subject of subjects) {
                await this.materialRepository.associateToSubject(material.id, subject.id, 'Aprobado');
                await this.notifyObservers(subject, material);
            }

            await this.auditLogService.record(AuditLog.OPERACIONES.ASOCIACION_MATERIAL, ctx.usuarioId, materialId);
            return {
                message: 'messages.materialAssociated',
                subjectIds: subjects.map((subject) => subject.id)
            };
        });
    }
}

module.exports = MaterialAssociationService;
