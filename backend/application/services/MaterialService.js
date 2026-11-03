/**
* Project     : Bibliotech  |  Capa: Aplicacion - Caso de Uso
* MaterialService: subida, sugerencia, control de duplicados por hash,
* categorizacion por etiquetas y vista global de contenido (RF-04).
* Al publicar material aprobado notifica a los alumnos suscriptores (Observer).
*/

const db = require('../../config/db');
const Material = require('../../domain/entities/Material');
const Subject = require('../../domain/entities/Subject');
const StudentObserver = require('../../domain/observers/StudentObserver');
const AuditLog = require('../../domain/entities/AuditLog');
const AppError = require('../../utils/AppError');
const TtlCache = require('../../utils/ttlCache');
const hashHelper = require('../../utils/hashHelper');
const ValidationHandler = require('../../validator/ValidationHandler');
const Required = require('../../validator/rules/Required');
const Length = require('../../validator/rules/Length');
const In = require('../../validator/rules/In');
const fileHelper = require('../../utils/fileHelper');
const mediaValidator = require('../../utils/mediaValidator');

const requireId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('validation.invalidData', { status: 422 });
    }
    return id;
};

const PENDING_LIMIT = 3;
const BATCH_LIMIT = 100;

class MaterialService {
    constructor(materialRepository, subjectRepository, subscriptionRepository, auditLogService, languageManager, thematicTagService = null, fileStorage = fileHelper, notificationRepository = null, gamificationService = null) {
        this.materialRepository = materialRepository;
        this.subjectRepository = subjectRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.auditLogService = auditLogService;
        this.languageManager = languageManager;
        this.thematicTagService = thematicTagService;
        this.fileStorage = fileStorage;
        this.notificationRepository = notificationRepository;
        this.gamificationService = gamificationService;
        this.referenceCache = new TtlCache({ ttlMs: 60000, maxEntries: 50 });
    }

    /** Materias (de las que contiene el material) asignadas al profesor. */
    async ownedSubjectIds(material, ctx) {
        const subjectIds = material.materiasTodosIds?.length
            ? material.materiasTodosIds
            : (material.materiasIds || []);
        if (!subjectIds.length) return [];
        const subjects = await this.subjectRepository.findByIds(subjectIds);
        return subjects.filter(subject => subject.hasProfessor(ctx.usuarioId)).map(subject => subject.id);
    }

    /** Elimina los archivos fisicos de un material que ya no debe conservarlos. */
    async deleteStoredFiles(material) {
        const paths = [material?.urlOrPath, material?.portada].filter(Boolean);
        for (const value of paths) {
            try { await this.fileStorage.deleteStorageFile(value); }
            catch (error) { console.error('No se pudo borrar el archivo del material:', error.message); }
        }
    }

    /**
     * Verifica que el usuario pueda editar el material.
     * El Superadmin puede editar cualquier material. Un profesor solo puede
     * editar sus propias subidas o materiales asociados a materias que imparte.
     * Los alumnos nunca editan materiales.
     */
    async assertCanManage(material, ctx) {
        if (ctx.rol === 'Superadmin') return;
        if (ctx.rol !== 'Profesor') throw new AppError('errors.forbidden', { status: 403 });
        if (['Cancelado', 'Rechazado'].includes(String(material.estado || ''))) {
            throw new AppError('errors.forbidden', { status: 403 });
        }

        const uploaderId = Number(material.uploadedBy || material.autorId);
        if (uploaderId === Number(ctx.usuarioId)) return;
        const owned = await this.ownedSubjectIds(material, ctx);
        if (owned.length) return;
        throw new AppError('errors.forbidden', { status: 403 });
    }

    /** Valida enlaces externos segun su tipo (YouTube, Drive, GitHub). */
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
        const category = options.categories.find(item => item.slug === slug);
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
        if (!ids.length || ids.some(id => !Number.isInteger(id) || id <= 0)) {
            throw new AppError('validation.invalidData', { status: 422 });
        }
        return [...new Set(ids)];
    }

    async assertProfessorOwnsSubjects(subjectIds, ctx) {
        if (!ctx || ctx.rol !== 'Profesor') {
            throw new AppError('errors.forbidden', { status: 403 });
        }
        const subjects = await this.subjectRepository.findByIds(subjectIds);
        const byId = new Map(subjects.map(subject => [Number(subject.id), subject]));
        const resolved = subjectIds.map(subjectId => byId.get(Number(subjectId)));
        if (resolved.some(subject => !subject || !subject.hasProfessor(ctx.usuarioId))) {
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
        if (dto.pages !== undefined && dto.pages !== null && dto.pages !== '' &&
            (!Number.isInteger(Number(dto.pages)) || Number(dto.pages) <= 0)) {
            throw new AppError('validation.invalidData', { status: 422 });
        }
    }

    /** RF-03/RF-04: notifica a los observadores (alumnos suscritos) de una materia. */
    async notifyObservers(subject, material) {
        const rows = await this.subscriptionRepository.getObservers(subject.id);
        const observable = new Subject({
            id: subject.id, nombre: subject.nombre, profesorId: subject.profesorId
        });
        rows.forEach(row => observable.attach(new StudentObserver({
            alumnoId: row.alumnoId, email: row.email, materiaId: subject.id
        })));
        const notifications = observable.notifyObservers(material);

        if (this.notificationRepository && rows.length) {
            await this.notificationRepository.createForSubscribers(
                subject.id, material.id, rows.map(row => row.alumnoId)
            );
        }

        return notifications;
    }

    /**
     * RF-04.2: subida / sugerencia con control de unicidad por hash.
     * @param {Object} dto { titulo, tipo, urlOrPath, fileHash, categories, subjects:[ids] }
     * @param {Object} ctx { usuarioId, rol }
     */
    async uploadOrSuggestMaterial(dto, ctx) {
        this.validate(dto);
        this.assertLinkValidity(dto.tipo, dto.urlOrPath);
        const rawSubjects = this.toArray(dto.subjects);
        if (!rawSubjects.length) throw new AppError('validation.required', { status: 422, params: { field: 'Materia' } });
        const subjects = this.normalizeSubjectIds(rawSubjects);

        const esProfesor = ctx.rol === 'Profesor';
        const category = await this.resolveCategory(dto.category);
        const author = this.normalizeAuthor(dto.author);
        const isMandatory = esProfesor && (dto.isMandatory === true || dto.isMandatory === 'true' || dto.isMandatory === 1);
        const resolvedSubjects = esProfesor
            ? await this.assertProfessorOwnsSubjects(subjects, ctx)
            : await this.subjectRepository.findByIds(subjects);
        const subjectById = new Map(resolvedSubjects.map(subject => [Number(subject.id), subject]));
        const hash = dto.fileHash || hashHelper.hashString(dto.urlOrPath);

        return db.transaction(async () => {
            const existing = await this.materialRepository.findByHashForUpdate(hash);

            // --- Caso: el contenido ya existe (RD-05) ---
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
                    await this.auditLogService.record(AuditLog.OPERACIONES.ASOCIACION_MATERIAL, ctx.usuarioId, existing.id);
                    return { message: 'messages.materialDuplicateProfessor', material: existing, duplicate: true };
                }
                // Alumno: se genera solicitud pendiente (respeta limite de 3).
                await this.assertPendingLimit(ctx.usuarioId);
                for (const subjectId of subjects) {
                    await this.materialRepository.associateToSubject(existing.id, subjectId, 'Pendiente');
                }
                await this.auditLogService.record(AuditLog.OPERACIONES.ASOCIACION_MATERIAL, ctx.usuarioId, existing.id);
                return { message: 'messages.materialDuplicateStudent', material: existing, duplicate: true };
            }

            // --- Caso: contenido nuevo ---
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
                    type: 'upload', materialId: material.id, message: material.titulo
                });
            }

            // Persistir etiquetas tematicas nuevas (ignora baneadas/duplicadas)
            if (this.thematicTagService) {
                const tags = this.toArray(dto.categories);
                for (const tag of tags) {
                    try { await this.thematicTagService.create({ nombre: tag, categoria: 'general' }, ctx.usuarioId); } catch (e) { /* ignore */ }
                }
            }

            await this.auditLogService.record(AuditLog.OPERACIONES.SUBIDA_MATERIAL, ctx.usuarioId, material.id);
            return {
                message: esProfesor ? 'messages.materialUploaded' : 'messages.materialSuggested',
                material
            };
        });
    }

    /** RD-04: un alumno no puede tener mas de 3 materiales pendientes. */
    async assertPendingLimit(alumnoId) {
        await this.materialRepository.lockAuthor(alumnoId);
        const total = await this.materialRepository.countPendingByAuthor(alumnoId);
        if (total >= 3) {
            throw new AppError('validation.pendingLimit', { status: 409, params: { max: 3 } });
        }
    }

    /** Un profesor agrega un material existente solo a sus propias materias. */
    async associateMaterialToSubjects(materialId, rawSubjectIds, ctx) {
        if (!ctx || ctx.rol !== 'Profesor') {
            throw new AppError('errors.forbidden', { status: 403 });
        }

        const material = await this.materialRepository.findById(materialId);
        if (!material) throw new AppError('errors.notFound', { status: 404 });
        if (['Cancelado', 'Rechazado'].includes(String(material.estado || ''))) {
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
                subjectIds: subjects.map(subject => subject.id)
            };
        });
    }

    /** Aprobacion de material sugerido por un alumno (RF-05). */
    async approveMaterial(materialId, subjectId, ctx) {
        materialId = requireId(materialId);
        subjectId = requireId(subjectId);
        return db.transaction(async () => {
            const subject = await this.subjectRepository.findById(subjectId);
            if (!subject) throw new AppError('errors.notFound', { status: 404 });
            if (ctx.rol !== 'Superadmin' && !subject.hasProfessor(ctx.usuarioId)) {
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
                    type: 'upload', materialId: material.id, message: material.titulo
                });
            }
            await this.auditLogService.record(AuditLog.OPERACIONES.APROBACION_MATERIAL, ctx.usuarioId, materialId);
            return { message: 'messages.materialApproved' };
        });
    }

    /** Material sugerido por alumnos pendiente de revision (panel del profesor). */
    async getPendingForProfessor(profesorId, filters = {}) {
        const { items, total } = await this.materialRepository.findPendingForProfessor(profesorId, filters);
        return { materials: items, total };
    }

    /** Rechazo de material sugerido: elimina la asociacion y libera el archivo. */
    async rejectMaterial(materialId, subjectId, ctx) {
        materialId = requireId(materialId);
        subjectId = requireId(subjectId);
        const result = await db.transaction(async () => {
            const subject = await this.subjectRepository.findById(subjectId);
            if (!subject) throw new AppError('errors.notFound', { status: 404 });
            if (ctx.rol !== 'Superadmin' && !subject.hasProfessor(ctx.usuarioId)) {
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

    /** RD-04: el alumno cancela mientras siga pendiente. */
    async cancelPendingUpload(materialId, ctx) {
        materialId = requireId(materialId);
        const obsolete = await db.transaction(async () => {
            const material = await this.materialRepository.findById(materialId);
            if (!material) throw new AppError('errors.notFound', { status: 404 });
            if (material.autorId !== ctx.usuarioId && ctx.rol !== 'Superadmin') {
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

    /**
     * Edita todos los datos del material. El Superadmin puede editar cualquier
     * material; un profesor, los propios y los de cualquier alumno. Los alumnos
     * nunca editan materiales.
     */
    async update(materialId, dto, ctx) {
        const material = await this.materialRepository.findById(materialId);
        if (!material) throw new AppError('errors.notFound', { status: 404 });
        await this.assertCanManage(material, ctx);

        const changes = {};
        let mandatoryChange = null;
        if (dto.isMandatory !== undefined) {
            const subjectIds = dto.subjectId
                ? [Number(dto.subjectId)]
                : [...new Set([...(material.materiasTodosIds || []), ...(material.materiasIds || [])].map(Number).filter(Boolean))];
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
                .map(category => String(category).trim())
                .filter(Boolean);
            changes.categories = categories.filter((category, index) =>
                categories.findIndex(item => item.toLowerCase() === category.toLowerCase()) === index);
        }
        if (dto.tipo !== undefined && dto.tipo !== null) {
            changes.tipo = String(dto.tipo).trim();
            if (!Material.TIPOS.includes(changes.tipo)) {
                throw new AppError('validation.invalidData', { status: 422 });
            }
        }
        if (dto.portada !== undefined) changes.portada = dto.portada || null;
        if (dto.pages !== undefined) {
            if (dto.pages !== null && dto.pages !== '' && (!Number.isInteger(Number(dto.pages)) || Number(dto.pages) <= 0)) {
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
            const url = hasUrl ? String(dto.urlOrPath || '').trim() : (currentIsLink ? material.urlOrPath : '');
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
                    try { await this.thematicTagService?.create({ nombre: tag, categoria: 'general' }, ctx.usuarioId); }
                    catch (error) { /* La etiqueta puede existir o estar baneada. */ }
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

    /**
     * Borrado / desasociacion de material.
     * - Si se indica subjectId, el profesor titular de esa materia (o Superadmin)
     *   quita el material SOLO de esa materia. No se borra el material ni del resto
     *   ni del catalogo global.
     * - Sin subjectId, solo Superadmin puede eliminar el material globalmente.
     */
    async delete(materialId, ctx, subjectId = null) {
        const outcome = await db.transaction(async () => {
            const material = await this.materialRepository.findById(materialId);
            if (!material) throw new AppError('errors.notFound', { status: 404 });
            if (ctx.rol === 'Alumno') throw new AppError('errors.forbidden', { status: 403 });

            if (subjectId) {
                const subject = await this.subjectRepository.findById(subjectId);
                if (!subject) throw new AppError('errors.notFound', { status: 404 });
                if (ctx.rol !== 'Superadmin' && !subject.hasProfessor(ctx.usuarioId)) {
                    throw new AppError('errors.forbidden', { status: 403 });
                }
                const removed = await this.materialRepository.deleteAssociation(materialId, subjectId);
                if (!removed) throw new AppError('errors.notFound', { status: 404 });
                await this.auditLogService.record(AuditLog.OPERACIONES.DESASOCIACION_MATERIAL, ctx.usuarioId, materialId);
                return { message: 'messages.materialRemovedFromSubject', deleted: false, obsolete: null };
            }

            if (ctx.rol === 'Superadmin') {
                await this.auditLogService.record(AuditLog.OPERACIONES.BORRADO_MATERIAL, ctx.usuarioId, materialId);
                await this.materialRepository.delete(materialId);
                return { message: 'messages.materialDeleted', deleted: true, obsolete: material };
            }

            throw new AppError('errors.forbidden', { status: 403 });
        });

        if (outcome.obsolete) await this.deleteStoredFiles(outcome.obsolete);
        return { message: outcome.message, deleted: outcome.deleted };
    }

    /**
     * Carga masiva exclusiva del administrador. Los materiales quedan
     * aprobados y sin materias, disponibles para que los profesores los asignen.
     */
    async uploadBatch(items, ctx) {
        const list = Array.isArray(items) ? items : [];
        if (!list.length) throw new AppError('validation.required', { status: 422, params: { field: 'Material' } });
        if (list.length > BATCH_LIMIT) {
            throw new AppError('validation.batchLimit', { status: 422, params: { max: BATCH_LIMIT } });
        }

        let created = 0;
        let skipped = 0;
        const materials = [];
        const duplicatePaths = [];

        await db.transaction(async () => {
            const options = await this.getFilterOptions();
            const categories = new Map(options.categories.map(category => [category.slug, category]));
            const prepared = [];
            const seenHashes = new Set();
            const hashes = [];

            for (const item of list) {
                this.validate(item);
                this.assertLinkValidity(item.tipo, item.urlOrPath);
                const hash = item.fileHash || hashHelper.hashString(item.urlOrPath);
                if (seenHashes.has(hash)) {
                    duplicatePaths.push({ urlOrPath: item.urlOrPath, portada: item.portada });
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

            const existingByHash = await this.materialRepository.findByHashesForUpdate(hashes);
            const newMaterials = [];
            prepared.forEach(material => {
                if (existingByHash.has(material.fileHash)) {
                    duplicatePaths.push({ urlOrPath: material.urlOrPath, portada: material.portada });
                    skipped += 1;
                } else {
                    newMaterials.push(material);
                }
            });

            if (newMaterials.length) {
                const saved = await this.materialRepository.saveMany(newMaterials);
                await this.materialRepository.syncTagsMany(saved);
                await this.auditLogService.recordMany(
                    AuditLog.OPERACIONES.SUBIDA_MATERIAL,
                    ctx.usuarioId,
                    saved.map(material => material.id)
                );
                materials.push(...saved);
                created = saved.length;

                if (this.thematicTagService) {
                    const tags = [...new Set(newMaterials.flatMap(material => material.categories)
                        .map(tag => String(tag || '').trim())
                        .filter(Boolean))];
                    for (const tag of tags) {
                        try { await this.thematicTagService.create({ nombre: tag, categoria: 'general' }, ctx.usuarioId); } catch (e) { /* ignore */ }
                    }
                }
            }

            if (created && this.gamificationService) {
                await this.gamificationService.onMaterialApproved(ctx.usuarioId);
            }
        });

        for (const paths of duplicatePaths) await this.deleteStoredFiles(paths);
        return { message: 'messages.batchUploaded', created, skipped, materials };
    }

    /** Subidas propias del usuario autenticado. */
    async getMyUploads(usuarioId, filters = {}) {
        const { items, total } = await this.materialRepository.findByAuthor(usuarioId, filters);
        await this.attachFavoriteFlag(items, usuarioId);
        return { materials: await this.attachUserFlags(items, usuarioId), total };
    }

    /** Perfil publico del autor: materiales aprobados de un usuario. */
    async getByAuthor(authorId, filters = {}, usuarioId = null) {
        const { items, total } = await this.materialRepository.findByAuthor(authorId, filters);
        await this.attachFavoriteFlag(items, usuarioId);
        return { materials: await this.attachUserFlags(items, usuarioId), total };
    }

    async getFilterOptions() {
        return this.referenceCache.getOrSet('material:filters', () => this.materialRepository.findFilterOptions());
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

    /** Agrega las marcas personales de lectura y backlog a una lista de materiales. */
    async attachUserFlags(materials, usuarioId) {
        if (!this.gamificationService || !usuarioId || !materials?.length) return materials;
        return this.gamificationService.getFlagsForMaterials(usuarioId, materials);
    }

    /** Marca esFavorito segun los favoritos del usuario autenticado (RF favoritos). */
    async attachFavoriteFlag(materials, usuarioId) {
        if (!usuarioId || !materials || !materials.length) return materials;
        const ids = await this.materialRepository.findFavoriteIds(usuarioId, materials.map(m => m.id));
        const set = new Set(ids.map(Number));
        materials.forEach(m => { m.esFavorito = set.has(Number(m.id)) ? 1 : 0; });
        return materials;
    }

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
        return { materials: await this.attachUserFlags(items, usuarioId), total };
    }

    async getDownloadable(materialId, ctx = {}) {
        materialId = requireId(materialId);
        const material = await this.materialRepository.findById(materialId);
        if (!material) throw new AppError('errors.notFound', { status: 404 });
        if (!mediaValidator.isFileType(material.tipo)) {
            throw new AppError('errors.notFound', { status: 404 });
        }
        const owner = Number(material.autorId) === Number(ctx.usuarioId)
            || Number(material.uploadedBy) === Number(ctx.usuarioId);
        if (material.estado !== 'Aprobado' && !owner && ctx.rol !== 'Superadmin') {
            throw new AppError('errors.forbidden', { status: 403 });
        }
        return material;
    }
}

module.exports = MaterialService;