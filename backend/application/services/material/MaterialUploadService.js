/**
 * Project     : Bibliotech  |  Capa: Aplicacion - Material
 * Subida, sugerencia y carga masiva de material.
 */

const db = require('../../../config/db');
const Material = require('../../../domain/entities/Material');
const AuditLog = require('../../../domain/entities/AuditLog');
const AppError = require('../../../utils/AppError');
const hashHelper = require('../../../utils/hashHelper');
const { logger } = require('../../../utils/logger');
const MaterialServiceContext = require('./MaterialServiceContext');

const BATCH_LIMIT = 100;

class MaterialUploadService extends MaterialServiceContext {
    async uploadOrSuggestMaterial(dto, ctx) {
        this.validate(dto);
        this.assertLinkValidity(dto.tipo, dto.urlOrPath);
        const rawSubjects = this.toArray(dto.subjects);
        if (!rawSubjects.length)
            throw new AppError('validation.required', { status: 422, params: { field: 'Materia' } });
        const subjects = this.normalizeSubjectIds(rawSubjects);

        const esProfesor = ctx.rol === 'Profesor';
        const category = await this.resolveCategory(dto.category);
        const author = this.normalizeAuthor(dto.author);
        const isMandatory =
            esProfesor && (dto.isMandatory === true || dto.isMandatory === 'true' || dto.isMandatory === 1);
        const resolvedSubjects = esProfesor
            ? await this.assertProfessorOwnsSubjects(subjects, ctx)
            : await this.subjectRepository.findByIds(subjects);
        const subjectById = new Map(resolvedSubjects.map((subject) => [Number(subject.id), subject]));
        const hash = dto.fileHash || hashHelper.hashString(dto.urlOrPath);

        return db.transaction(async () => {
            const existing = await this.materialRepository.findByHashForUpdate(hash);

            if (existing) {
                const pages = Material.normalizePages(dto.pages);
                if (pages && existing.pages !== pages) {
                    await this.materialRepository.update(existing.id, { pages });
                    existing.pages = pages;
                }
                if (esProfesor) {
                    for (const subjectId of subjects) {
                        await this.materialRepository.associateToSubject(existing.id, subjectId, 'Aprobado');
                        await this.materialRepository.setSubjectMandatory(existing.id, subjectId, isMandatory);
                        const subject = subjectById.get(Number(subjectId));
                        if (subject) await this.notifyObservers(subject, existing);
                    }
                    await this.auditLogService.record(
                        AuditLog.OPERACIONES.ASOCIACION_MATERIAL,
                        ctx.usuarioId,
                        existing.id
                    );
                    return { message: 'messages.materialDuplicateProfessor', material: existing, duplicate: true };
                }
                await this.assertPendingLimit(ctx.usuarioId);
                for (const subjectId of subjects) {
                    await this.materialRepository.associateToSubject(existing.id, subjectId, 'Pendiente');
                }
                await this.auditLogService.record(AuditLog.OPERACIONES.ASOCIACION_MATERIAL, ctx.usuarioId, existing.id);
                return { message: 'messages.materialDuplicateStudent', material: existing, duplicate: true };
            }

            const estado = esProfesor ? 'Aprobado' : 'Pendiente';
            if (!esProfesor) await this.assertPendingLimit(ctx.usuarioId);

            const material = await this.materialRepository.save({
                autorId: ctx.usuarioId,
                uploadedBy: ctx.usuarioId,
                author,
                categoryId: category.id,
                titulo: dto.titulo,
                tipo: dto.tipo,
                urlOrPath: dto.urlOrPath,
                portada: dto.portada || null,
                fileHash: hash,
                descripcion: dto.descripcion || null,
                pages: Material.normalizePages(dto.pages),
                categories: this.toArray(dto.categories),
                estado
            });

            for (const subjectId of subjects) {
                await this.materialRepository.associateToSubject(material.id, subjectId, estado);
                await this.materialRepository.setSubjectMandatory(material.id, subjectId, isMandatory);
                if (esProfesor) {
                    const subject = subjectById.get(Number(subjectId));
                    if (subject) await this.notifyObservers(subject, material);
                }
            }

            if (esProfesor && this.gamificationService) {
                await this.gamificationService.onMaterialApproved(ctx.usuarioId);
                await this.gamificationService.notifyFollowers(ctx.usuarioId, {
                    type: 'upload',
                    materialId: material.id,
                    message: material.titulo
                });
            }

            if (this.thematicTagService) {
                const tags = this.toArray(dto.categories);
                for (const tag of tags) {
                    try {
                        await this.thematicTagService.create({ nombre: tag, categoria: 'general' }, ctx.usuarioId);
                    } catch (error) {
                        /* La etiqueta puede existir o estar baneada. */
                    }
                }
            }

            await this.auditLogService.record(AuditLog.OPERACIONES.SUBIDA_MATERIAL, ctx.usuarioId, material.id);
            return {
                message: esProfesor ? 'messages.materialUploaded' : 'messages.materialSuggested',
                material
            };
        });
    }

    async uploadBatch(items, ctx) {
        const list = Array.isArray(items) ? items : [];
        if (!list.length) throw new AppError('validation.required', { status: 422, params: { field: 'Material' } });
        if (list.length > BATCH_LIMIT) {
            throw new AppError('validation.batchLimit', { status: 422, params: { max: BATCH_LIMIT } });
        }

        let created = 0;
        let skipped = 0;
        const materials = [];
        const skippedMaterials = [];
        const duplicatePaths = [];
        const options = await this.getFilterOptions();
        const categories = new Map(options.categories.map((category) => [category.slug, category]));
        const prepared = [];
        const seenHashes = new Set();
        const hashes = [];

        for (const item of list) {
            this.validate(item);
            this.assertLinkValidity(item.tipo, item.urlOrPath);
            const hash = item.fileHash || hashHelper.hashString(item.urlOrPath);
            if (seenHashes.has(hash)) {
                duplicatePaths.push({ urlOrPath: item.urlOrPath, portada: item.portada });
                skippedMaterials.push({
                    id: null,
                    titulo: item.titulo,
                    fileHash: hash,
                    reason: 'duplicate_in_batch'
                });
                skipped += 1;
                continue;
            }
            seenHashes.add(hash);
            hashes.push(hash);
            const slug = item.category ? String(item.category).trim() : 'technical';
            if (!Material.CATEGORIAS.includes(slug)) {
                throw new AppError('validation.invalidData', { status: 422 });
            }
            const category = categories.get(slug);
            if (!category) throw new AppError('validation.invalidData', { status: 422 });
            prepared.push({
                autorId: ctx.usuarioId,
                uploadedBy: ctx.usuarioId,
                author: this.normalizeAuthor(item.author),
                categoryId: category.id,
                titulo: item.titulo,
                tipo: item.tipo,
                urlOrPath: item.urlOrPath,
                portada: item.portada || null,
                fileHash: hash,
                descripcion: item.descripcion || null,
                pages: Material.normalizePages(item.pages),
                categories: this.toArray(item.categories),
                estado: 'Aprobado'
            });
        }

        let newMaterials = [];
        await db.transaction(async () => {
            const existingByHash = await this.materialRepository.findByHashesForUpdate(hashes);
            prepared.forEach((material) => {
                const existing = existingByHash.get(material.fileHash);
                if (existing) {
                    duplicatePaths.push({ urlOrPath: material.urlOrPath, portada: material.portada });
                    skippedMaterials.push({
                        id: existing.id,
                        titulo: existing.titulo || material.titulo,
                        fileHash: material.fileHash,
                        reason: 'duplicate'
                    });
                    skipped += 1;
                } else {
                    newMaterials.push(material);
                }
            });

            if (!newMaterials.length) return;
            const saved = await this.materialRepository.saveMany(newMaterials);
            await this.materialRepository.syncTagsMany(saved);
            await this.auditLogService.recordMany(
                AuditLog.OPERACIONES.SUBIDA_MATERIAL,
                ctx.usuarioId,
                saved.map((material) => material.id)
            );
            materials.push(...saved);
            created = saved.length;
        });

        if (created) {
            if (this.thematicTagService) {
                const tags = [
                    ...new Set(
                        newMaterials
                            .flatMap((material) => material.categories)
                            .map((tag) => String(tag || '').trim())
                            .filter(Boolean)
                    )
                ];
                for (const tag of tags) {
                    try {
                        await this.thematicTagService.create({ nombre: tag, categoria: 'general' }, ctx.usuarioId);
                    } catch (error) {
                        logger.warn('material.batch_tag_failed', { error });
                    }
                }
            }
            if (this.gamificationService) {
                try {
                    await this.gamificationService.onMaterialApproved(ctx.usuarioId);
                } catch (error) {
                    logger.warn('material.batch_gamification_failed', { error });
                }
            }
        }

        for (const item of skippedMaterials) {
            if (item.id || item.reason !== 'duplicate_in_batch') continue;
            const saved = materials.find((material) => material.fileHash === item.fileHash);
            if (saved) item.id = saved.id;
        }
        for (const paths of duplicatePaths) await this.deleteStoredFiles(paths);
        return { message: 'messages.batchUploaded', created, skipped, materials, skippedMaterials };
    }
}

module.exports = MaterialUploadService;
