/**
 * Project     : Bibliotech  |  Capa: Aplicacion - Material
 * Ciclo de vida y gestion: cancelacion, edicion y borrado.
 */

const db = require('../../../config/db');
const Material = require('../../../domain/entities/Material');
const MaterialPolicy = require('../../../domain/policies/MaterialPolicy');
const AuditLog = require('../../../domain/entities/AuditLog');
const AppError = require('../../../utils/AppError');
const hashHelper = require('../../../utils/hashHelper');
const mediaValidator = require('../../../utils/mediaValidator');
const ValidationHandler = require('../../../validator/ValidationHandler');
const Required = require('../../../validator/rules/Required');
const Length = require('../../../validator/rules/Length');
const MaterialServiceContext = require('./MaterialServiceContext');

const requireId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('validation.invalidData', { status: 422 });
    }
    return id;
};

class MaterialManagementService extends MaterialServiceContext {
    async cancelPendingUpload(materialId, ctx) {
        materialId = requireId(materialId);
        const obsolete = await db.transaction(async () => {
            const material = await this.materialRepository.findById(materialId);
            if (!material) throw new AppError('errors.notFound', { status: 404 });
            if (!MaterialPolicy.canCancel(material, ctx)) {
                throw new AppError('errors.forbidden', { status: 403 });
            }
            const ok = await this.materialRepository.cancelPendingUpload(materialId);
            if (!ok) throw new AppError('validation.invalidState', { status: 409 });
            await this.auditLogService.record(AuditLog.OPERACIONES.CANCELACION_MATERIAL, ctx.usuarioId, materialId);
            return material;
        });

        await this.deleteStoredFiles(obsolete);
        return { message: 'messages.materialCancelled' };
    }

    async update(materialId, dto, ctx) {
        const material = await this.materialRepository.findById(materialId);
        if (!material) throw new AppError('errors.notFound', { status: 404 });
        await this.assertCanManage(material, ctx);

        const changes = {};
        let mandatoryChange = null;
        if (dto.isMandatory !== undefined) {
            const subjectIds = dto.subjectId
                ? [Number(dto.subjectId)]
                : [
                      ...new Set(
                          [...(material.materiasTodosIds || []), ...(material.materiasIds || [])]
                              .map(Number)
                              .filter(Boolean)
                      )
                  ];
            const value = dto.isMandatory === true || dto.isMandatory === 'true' || dto.isMandatory === 1;
            if (!subjectIds.length) {
                if (value) throw new AppError('validation.invalidData', { status: 422 });
            } else {
                mandatoryChange = { subjectIds, value };
            }
        }
        if (dto.titulo !== undefined && dto.titulo !== null) {
            changes.titulo = String(dto.titulo).trim();
        }
        if (dto.descripcion !== undefined) {
            changes.descripcion = (dto.descripcion === null ? '' : String(dto.descripcion)).trim() || null;
        }
        if (dto.categories !== undefined) {
            const categories = this.toArray(dto.categories)
                .map((category) => String(category).trim())
                .filter(Boolean);
            changes.categories = categories.filter(
                (category, index) =>
                    categories.findIndex((item) => item.toLowerCase() === category.toLowerCase()) === index
            );
        }
        if (dto.tipo !== undefined && dto.tipo !== null) {
            changes.tipo = String(dto.tipo).trim();
            if (!Material.TIPOS.includes(changes.tipo)) {
                throw new AppError('validation.invalidData', { status: 422 });
            }
        }
        if (dto.portada !== undefined) changes.portada = dto.portada || null;
        if (dto.pages !== undefined) {
            if (
                dto.pages !== null &&
                dto.pages !== '' &&
                (!Number.isInteger(Number(dto.pages)) || Number(dto.pages) <= 0)
            ) {
                throw new AppError('validation.invalidData', { status: 422 });
            }
            changes.pages = Material.normalizePages(dto.pages);
        }
        if (dto.author !== undefined) changes.author = this.normalizeAuthor(dto.author);
        if (dto.category !== undefined) {
            const category = await this.resolveCategory(dto.category);
            changes.categoryId = category.id;
        }

        const nextTipo = changes.tipo || material.tipo;
        const nextIsFile = mediaValidator.isFileType(nextTipo);
        const nextIsLink = mediaValidator.isLinkType(nextTipo);
        const currentIsFile = mediaValidator.isFileType(material.tipo);
        const currentIsLink = mediaValidator.isLinkType(material.tipo);
        const hasNewFile = dto.fileHash !== undefined && dto.fileHash !== null;
        const hasUrl = dto.urlOrPath !== undefined;
        const typeChanged = Boolean(changes.tipo && changes.tipo !== material.tipo);

        if (!nextIsFile && !nextIsLink) {
            throw new AppError('validation.invalidData', { status: 422 });
        }
        if (hasNewFile && !nextIsFile) {
            throw new AppError('validation.invalidData', { status: 422 });
        }
        if (nextIsFile) {
            if ((!currentIsFile || typeChanged) && !hasNewFile) {
                throw new AppError('validation.fileType', { status: 422 });
            }
            if (hasNewFile) {
                changes.urlOrPath = String(dto.urlOrPath || '').trim();
                changes.fileHash = dto.fileHash;
                if (!changes.urlOrPath) throw new AppError('validation.invalidData', { status: 422 });
            }
        } else {
            if (hasNewFile) throw new AppError('validation.invalidData', { status: 422 });
            const url = hasUrl ? String(dto.urlOrPath || '').trim() : currentIsLink ? material.urlOrPath : '';
            if (!url) {
                throw new AppError('validation.invalidLink', { status: 422, params: { type: nextTipo } });
            }
            if (hasUrl || typeChanged) {
                this.assertLinkValidity(nextTipo, url);
                changes.urlOrPath = url;
                changes.fileHash = hashHelper.hashString(url);
            }
        }

        if (!Object.keys(changes).length && !mandatoryChange) {
            throw new AppError('validation.invalidData', { status: 422 });
        }

        if (changes.titulo !== undefined) {
            const validator = new ValidationHandler(this.languageManager)
                .with(new Required('titulo'))
                .with(new Length('titulo', { min: 2, max: 150 }));
            if (!validator.validateThis({ titulo: changes.titulo })) throw validator.toError();
        }

        await db.transaction(async () => {
            if (changes.fileHash && changes.fileHash !== material.fileHash) {
                const duplicate = await this.materialRepository.findByHashForUpdate(changes.fileHash);
                if (duplicate && Number(duplicate.id) !== Number(material.id)) {
                    throw new AppError('validation.duplicateMaterial', { status: 409 });
                }
            }
            if (Object.keys(changes).length) {
                await this.materialRepository.update(materialId, changes);
            }
            if (mandatoryChange) {
                for (const subjectId of mandatoryChange.subjectIds) {
                    await this.materialRepository.setSubjectMandatory(materialId, subjectId, mandatoryChange.value);
                }
            }
            if (changes.categories !== undefined) {
                for (const tag of changes.categories) {
                    try {
                        await this.thematicTagService?.create({ nombre: tag, categoria: 'general' }, ctx.usuarioId);
                    } catch (error) {
                        /* La etiqueta puede existir o estar baneada. */
                    }
                }
            }
            await this.auditLogService.record(AuditLog.OPERACIONES.MODIFICACION_MATERIAL, ctx.usuarioId, materialId);
        });

        const obsolete = [];
        if (changes.urlOrPath !== undefined && material.urlOrPath && material.urlOrPath !== changes.urlOrPath) {
            obsolete.push(material.urlOrPath);
        }
        if (changes.portada !== undefined && material.portada && material.portada !== changes.portada) {
            obsolete.push(material.portada);
        }
        await this.deleteStoredFiles({ urlOrPath: obsolete[0] || null, portada: obsolete[1] || null });

        const updated = await this.materialRepository.findById(materialId);
        return { message: 'messages.materialUpdated', material: updated };
    }

    async delete(materialId, ctx, subjectId = null) {
        const outcome = await db.transaction(async () => {
            const material = await this.materialRepository.findById(materialId);
            if (!material) throw new AppError('errors.notFound', { status: 404 });

            if (subjectId) {
                const subject = await this.subjectRepository.findById(subjectId);
                if (!subject) throw new AppError('errors.notFound', { status: 404 });
                if (!MaterialPolicy.canModerateSubject(subject, ctx)) {
                    throw new AppError('errors.forbidden', { status: 403 });
                }
                const removed = await this.materialRepository.deleteAssociation(materialId, subjectId);
                if (!removed) throw new AppError('errors.notFound', { status: 404 });
                await this.auditLogService.record(
                    AuditLog.OPERACIONES.DESASOCIACION_MATERIAL,
                    ctx.usuarioId,
                    materialId
                );
                return { message: 'messages.materialRemovedFromSubject', deleted: false, obsolete: null };
            }

            if (MaterialPolicy.canDeleteGlobally(ctx)) {
                await this.auditLogService.record(AuditLog.OPERACIONES.BORRADO_MATERIAL, ctx.usuarioId, materialId);
                await this.materialRepository.delete(materialId);
                return { message: 'messages.materialDeleted', deleted: true, obsolete: material };
            }

            throw new AppError('errors.forbidden', { status: 403 });
        });

        if (outcome.obsolete) await this.deleteStoredFiles(outcome.obsolete);
        return { message: outcome.message, deleted: outcome.deleted };
    }
}

module.exports = MaterialManagementService;
