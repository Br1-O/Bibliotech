/**
 * Project     : Bibliotech  |  Capa: Aplicacion - Material
 * Base compartida por los servicios enfocados de material.
 */

const Material = require('../../../domain/entities/Material');
const MaterialPolicy = require('../../../domain/policies/MaterialPolicy');
const Subject = require('../../../domain/entities/Subject');
const StudentObserver = require('../../../domain/observers/StudentObserver');
const AppError = require('../../../utils/AppError');
const TtlCache = require('../../../utils/ttlCache');
const ValidationHandler = require('../../../validator/ValidationHandler');
const Required = require('../../../validator/rules/Required');
const Length = require('../../../validator/rules/Length');
const In = require('../../../validator/rules/In');
const mediaValidator = require('../../../utils/mediaValidator');
const { logger } = require('../../../utils/logger');

class MaterialServiceContext {
    constructor({
        materialRepository,
        subjectRepository = null,
        subscriptionRepository = null,
        auditLogService = null,
        languageManager = null,
        thematicTagService = null,
        fileStorage = null,
        notificationRepository = null,
        gamificationService = null,
        outboxService = null,
        referenceCache = null
    } = {}) {
        this.materialRepository = materialRepository;
        this.subjectRepository = subjectRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.auditLogService = auditLogService;
        this.languageManager = languageManager;
        this.thematicTagService = thematicTagService;
        this.fileStorage = fileStorage;
        this.notificationRepository = notificationRepository;
        this.gamificationService = gamificationService;
        this.outboxService = outboxService;
        this.referenceCache = referenceCache || new TtlCache({ ttlMs: 60000, maxEntries: 50 });
    }

    async ownedSubjectIds(material, ctx) {
        const subjectIds = material.materiasTodosIds?.length ? material.materiasTodosIds : material.materiasIds || [];
        if (!subjectIds.length) return [];
        const subjects = await this.subjectRepository.findByIds(subjectIds);
        return subjects.filter((subject) => subject.hasProfessor(ctx.usuarioId)).map((subject) => subject.id);
    }

    async deleteStoredFiles(material) {
        const paths = [material?.urlOrPath, material?.portada].filter(Boolean);
        for (const value of paths) {
            try {
                await this.fileStorage.deleteStorageFile(value);
            } catch (error) {
                logger.error('material.file_delete_failed', { error });
            }
        }
    }

    async assertCanManage(material, ctx) {
        if (MaterialPolicy.canManage(material, ctx)) return;
        const ownedSubjectIds = await this.ownedSubjectIds(material, ctx);
        if (MaterialPolicy.canManage(material, ctx, { ownedSubjectIds })) return;
        throw new AppError('errors.forbidden', { status: 403 });
    }

    assertLinkValidity(tipo, urlOrPath) {
        if (!mediaValidator.isLinkType(tipo)) return;
        if (!mediaValidator.isValidLink(tipo, urlOrPath)) {
            throw new AppError('validation.invalidLink', { status: 422, params: { type: tipo } });
        }
    }

    toArray(value) {
        if (value === undefined || value === null || value === '') return [];
        return Array.isArray(value) ? value : [value];
    }

    async resolveCategory(rawCategory) {
        const slug = rawCategory ? String(rawCategory).trim() : 'technical';
        if (!Material.CATEGORIAS.includes(slug)) {
            throw new AppError('validation.invalidData', { status: 422 });
        }
        const options = await this.materialRepository.findFilterOptions();
        const category = options.categories.find((item) => item.slug === slug);
        if (!category) throw new AppError('validation.invalidData', { status: 422 });
        return category;
    }

    normalizeAuthor(rawAuthor) {
        if (rawAuthor === undefined || rawAuthor === null) return null;
        const author = String(rawAuthor).trim();
        if (author.length > 150) throw new AppError('validation.invalidData', { status: 422 });
        return author || null;
    }

    normalizeSubjectIds(value) {
        const ids = this.toArray(value).map(Number);
        if (!ids.length || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
            throw new AppError('validation.invalidData', { status: 422 });
        }
        return [...new Set(ids)];
    }

    async assertProfessorOwnsSubjects(subjectIds, ctx) {
        if (!MaterialPolicy.canAssociate(ctx)) {
            throw new AppError('errors.forbidden', { status: 403 });
        }
        const subjects = await this.subjectRepository.findByIds(subjectIds);
        const byId = new Map(subjects.map((subject) => [Number(subject.id), subject]));
        const resolved = subjectIds.map((subjectId) => byId.get(Number(subjectId)));
        if (resolved.some((subject) => !subject || !subject.hasProfessor(ctx.usuarioId))) {
            throw new AppError('errors.forbidden', { status: 403 });
        }
        return resolved;
    }

    validate(dto) {
        const validator = new ValidationHandler(this.languageManager)
            .with(new Required('titulo'))
            .with(new Length('titulo', { min: 2, max: 150 }))
            .with(new Required('tipo'))
            .with(new In('tipo', Material.TIPOS));
        if (!validator.validateThis(dto)) throw validator.toError();
        if (
            dto.pages !== undefined &&
            dto.pages !== null &&
            dto.pages !== '' &&
            (!Number.isInteger(Number(dto.pages)) || Number(dto.pages) <= 0)
        ) {
            throw new AppError('validation.invalidData', { status: 422 });
        }
    }

    async notifyObservers(subject, material) {
        const rows = await this.subscriptionRepository.getObservers(subject.id);
        const observable = new Subject({
            id: subject.id,
            nombre: subject.nombre,
            profesorId: subject.profesorId
        });
        rows.forEach((row) =>
            observable.attach(
                new StudentObserver({
                    alumnoId: row.alumnoId,
                    email: row.email,
                    materiaId: subject.id
                })
            )
        );
        const notifications = observable.notifyObservers(material);

        if (rows.length) {
            const alumnoIds = rows.map((row) => row.alumnoId);
            if (this.outboxService) {
                await this.outboxService.enqueue(
                    'notification.create_for_subscribers',
                    { subjectId: subject.id, materialId: material.id, alumnoIds },
                    { immediate: true }
                );
            } else if (this.notificationRepository) {
                await this.notificationRepository.createForSubscribers(subject.id, material.id, alumnoIds);
            }
        }

        return notifications;
    }

    async assertPendingLimit(alumnoId) {
        await this.materialRepository.lockAuthor(alumnoId);
        const total = await this.materialRepository.countPendingByAuthor(alumnoId);
        if (total >= 3) {
            throw new AppError('validation.pendingLimit', { status: 409, params: { max: 3 } });
        }
    }

    async getFilterOptions() {
        return this.referenceCache.getOrSet('material:filters', () => this.materialRepository.findFilterOptions());
    }
}

module.exports = MaterialServiceContext;
