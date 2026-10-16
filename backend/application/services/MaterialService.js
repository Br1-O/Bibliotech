/**
* Project     : Bibliotech  |  Capa: Aplicacion - Caso de Uso
* MaterialService: subida, sugerencia, control de duplicados por hash,
* categorizacion por etiquetas y vista global de contenido (RF-04).
* Al publicar material aprobado notifica a los alumnos suscriptores (Observer).
*/

const Material = require('../../domain/entities/Material');
const Subject = require('../../domain/entities/Subject');
const StudentObserver = require('../../domain/observers/StudentObserver');
const AuditLog = require('../../domain/entities/AuditLog');
const AppError = require('../../utils/AppError');
const hashHelper = require('../../utils/hashHelper');
const ValidationHandler = require('../../validator/ValidationHandler');
const ValidationError = require('../../validator/ValidationError');
const Required = require('../../validator/rules/Required');
const Length = require('../../validator/rules/Length');
const In = require('../../validator/rules/In');
const fileHelper = require('../../utils/fileHelper');

const PENDING_LIMIT = 3;

class MaterialService {
    constructor(materialRepository, subjectRepository, subscriptionRepository, auditLogService, languageManager, thematicTagService = null, fileStorage = fileHelper) {
        this.materialRepository = materialRepository;
        this.subjectRepository = subjectRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.auditLogService = auditLogService;
        this.languageManager = languageManager;
        this.thematicTagService = thematicTagService;
        this.fileStorage = fileStorage;
    }

    /** Materias (de las que contiene el material) cuyo titular es el profesor. */
    async ownedSubjectIds(material, ctx) {
        const owned = [];
        for (const subjectId of material.materiasIds || []) {
            const subject = await this.subjectRepository.findById(subjectId);
            if (subject && subject.profesorId === ctx.usuarioId) owned.push(subjectId);
        }
        return owned;
    }

    /** Verifica que el usuario pueda gestionar el material (profesor titular o Superadmin). */
    async assertCanManage(material, ctx) {
        if (ctx.rol === 'Superadmin') return;
        if (ctx.rol !== 'Profesor') throw new AppError('errors.forbidden', { status: 403 });
        const owned = await this.ownedSubjectIds(material, ctx);
        if (!owned.length) throw new AppError('errors.forbidden', { status: 403 });
    }

    toArray(value) {
        if (value === undefined || value === null || value === '') return [];
        return Array.isArray(value) ? value : [value];
    }

    validate(dto) {
        const validator = new ValidationHandler(this.languageManager)
            .with(new Required('titulo'))
            .with(new Length('titulo', { min: 2, max: 150 }))
            .with(new Required('tipo'))
            .with(new In('tipo', Material.TIPOS));
        if (!validator.validateThis(dto)) throw new ValidationError(validator.getErrors());
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
        return observable.notifyObservers(material);
    }

    /**
     * RF-04.2: subida / sugerencia con control de unicidad por hash.
     * @param {Object} dto { titulo, tipo, urlOrPath, fileHash, categories, subjects:[ids] }
     * @param {Object} ctx { usuarioId, rol }
     */
    async uploadOrSuggestMaterial(dto, ctx) {
        this.validate(dto);
        const subjects = this.toArray(dto.subjects).map(Number).filter(Boolean);
        if (!subjects.length) throw new AppError('validation.required', { status: 422, params: { field: 'Materia' } });

        const esProfesor = ctx.rol === 'Profesor';
        const hash = dto.fileHash || hashHelper.hashString(dto.urlOrPath);

        const existing = await this.materialRepository.findByHash(hash);

        // --- Caso: el contenido ya existe (RD-05) ---
        if (existing) {
            if (esProfesor) {
                for (const subjectId of subjects) {
                    await this.materialRepository.associateToSubject(existing.id, subjectId, 'Aprobado');
                    const subject = await this.subjectRepository.findById(subjectId);
                    if (subject) await this.notifyObservers(subject, existing);
                }
                await this.auditLogService.record(AuditLog.OPERACIONES.ASOCIACION_MATERIAL, ctx.usuarioId, existing.id);
                return { message: 'messages.materialDuplicateProfessor', material: existing };
            }
            // Alumno: se genera solicitud pendiente (respeta limite de 3).
            await this.assertPendingLimit(ctx.usuarioId);
            for (const subjectId of subjects) {
                await this.materialRepository.associateToSubject(existing.id, subjectId, 'Pendiente');
            }
            await this.auditLogService.record(AuditLog.OPERACIONES.ASOCIACION_MATERIAL, ctx.usuarioId, existing.id);
            return { message: 'messages.materialDuplicateStudent', material: existing };
        }

        // --- Caso: contenido nuevo ---
        const estado = esProfesor ? 'Aprobado' : 'Pendiente';
        if (!esProfesor) await this.assertPendingLimit(ctx.usuarioId);

        const material = await this.materialRepository.save({
            autorId: ctx.usuarioId,
            titulo: dto.titulo,
            tipo: dto.tipo,
            urlOrPath: dto.urlOrPath,
            fileHash: hash,
            descripcion: dto.descripcion || null,
            categories: this.toArray(dto.categories),
            estado
        });

        for (const subjectId of subjects) {
            await this.materialRepository.associateToSubject(material.id, subjectId, estado);
            if (esProfesor) {
                const subject = await this.subjectRepository.findById(subjectId);
                if (subject) await this.notifyObservers(subject, material);
            }
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
    }

    /** RD-04: un alumno no puede tener mas de 3 materiales pendientes. */
    async assertPendingLimit(alumnoId) {
        const total = await this.materialRepository.countPendingByAuthor(alumnoId);
        if (total >= 3) {
            throw new AppError('validation.pendingLimit', { status: 409, params: { max: 3 } });
        }
    }

    /** Un profesor agrega un material existente a una de sus materias. */
    async associateMaterialToSubject(materialId, subjectId, ctx) {
        const material = await this.materialRepository.findById(materialId);
        if (!material) throw new AppError('errors.notFound', { status: 404 });
        const subject = await this.subjectRepository.findById(subjectId);
        if (!subject) throw new AppError('errors.notFound', { status: 404 });

        if (ctx.rol !== 'Superadmin' && subject.profesorId !== ctx.usuarioId) {
            throw new AppError('errors.forbidden', { status: 403 });
        }

        await this.materialRepository.associateToSubject(materialId, subjectId, 'Aprobado');
        await this.notifyObservers(subject, material);
        await this.auditLogService.record(AuditLog.OPERACIONES.ASOCIACION_MATERIAL, ctx.usuarioId, materialId);
        return { message: 'messages.materialAssociated' };
    }

    /** Aprobacion de material sugerido por un alumno (RF-05). */
    async approveMaterial(materialId, subjectId, ctx) {
        const subject = await this.subjectRepository.findById(subjectId);
        if (!subject) throw new AppError('errors.notFound', { status: 404 });
        if (ctx.rol !== 'Superadmin' && subject.profesorId !== ctx.usuarioId) {
            throw new AppError('errors.forbidden', { status: 403 });
        }

        await this.materialRepository.updateAssociationState(materialId, subjectId, 'Aprobado');
        await this.materialRepository.updateEstado(materialId, 'Aprobado');
        const material = await this.materialRepository.findById(materialId);
        await this.notifyObservers(subject, material);
        await this.auditLogService.record(AuditLog.OPERACIONES.APROBACION_MATERIAL, ctx.usuarioId, materialId);
        return { message: 'messages.materialApproved' };
    }

    /** Material sugerido por alumnos pendiente de revision (panel del profesor). */
    async getPendingForProfessor(profesorId) {
        return this.materialRepository.findPendingForProfessor(profesorId);
    }

    /** Rechazo de material sugerido: se elimina la asociacion a la materia. */
    async rejectMaterial(materialId, subjectId, ctx) {
        const subject = await this.subjectRepository.findById(subjectId);
        if (!subject) throw new AppError('errors.notFound', { status: 404 });
        if (ctx.rol !== 'Superadmin' && subject.profesorId !== ctx.usuarioId) {
            throw new AppError('errors.forbidden', { status: 403 });
        }

        await this.materialRepository.deleteAssociation(materialId, subjectId);
        const remaining = await this.materialRepository.countAssociations(materialId);
        if (remaining === 0) await this.materialRepository.cancelPendingUpload(materialId);

        await this.auditLogService.record(AuditLog.OPERACIONES.APROBACION_MATERIAL, ctx.usuarioId, materialId);
        return { message: 'messages.associationRejected' };
    }

    async getPendingMaterials(usuarioId) {
        return this.materialRepository.findPendingByAuthor(usuarioId);
    }

    /** RD-04: el alumno cancela mientras siga pendiente. */
    async cancelPendingUpload(materialId, ctx) {
        const material = await this.materialRepository.findById(materialId);
        if (!material) throw new AppError('errors.notFound', { status: 404 });
        if (material.autorId !== ctx.usuarioId && ctx.rol !== 'Superadmin') {
            throw new AppError('errors.forbidden', { status: 403 });
        }
        const ok = await this.materialRepository.cancelPendingUpload(materialId);
        if (!ok) throw new AppError('errors.forbidden', { status: 409 });
        await this.auditLogService.record(AuditLog.OPERACIONES.CANCELACION_MATERIAL, ctx.usuarioId, materialId);
        return { message: 'messages.materialCancelled' };
    }

    /**
     * Un profesor (titular de alguna materia donde vive el material) o el
     * Superadmin modifica el titulo y/o la descripcion del material.
     */
    async update(materialId, dto, ctx) {
        const material = await this.materialRepository.findById(materialId);
        if (!material) throw new AppError('errors.notFound', { status: 404 });
        await this.assertCanManage(material, ctx);

        const changes = {};
        if (dto.titulo !== undefined && dto.titulo !== null) {
            changes.titulo = String(dto.titulo).trim();
        }
        if (dto.descripcion !== undefined) {
            changes.descripcion = (dto.descripcion === null ? '' : String(dto.descripcion)).trim() || null;
        }
        if (changes.titulo === undefined && changes.descripcion === undefined) {
            throw new AppError('validation.invalidData', { status: 422 });
        }

        if (changes.titulo !== undefined) {
            const validator = new ValidationHandler(this.languageManager)
                .with(new Required('titulo'))
                .with(new Length('titulo', { min: 2, max: 150 }));
            if (!validator.validateThis({ titulo: changes.titulo })) throw new ValidationError(validator.getErrors());
        }

        await this.materialRepository.update(materialId, changes);
        await this.auditLogService.record(AuditLog.OPERACIONES.MODIFICACION_MATERIAL, ctx.usuarioId, materialId);
        const updated = await this.materialRepository.findById(materialId);
        return { message: 'messages.materialUpdated', material: updated };
    }

    /**
     * Borrado / desasociacion de material (RD-04).
     * - Un alumno no puede borrar material confirmado.
     * - Si se indica subjectId, el profesor titular de esa materia (o el
     *   Superadmin) quita el material unicamente de esa materia.
     * - Sin subjectId, el profesor lo quita de todas sus materias.
     * - Superadmin sin subjectId: borrado total.
     * El material se elimina fisicamente (registro + almacenamiento) solo si
     * ya no pertenece a ninguna materia y ningun usuario lo tiene en favoritos.
     */
    /**
     * RD-04: un alumno no puede borrar material confirmado (solo cancelar sus
     * subidas pendientes). Un profesor solo borra material de sus materias;
     * el Superadmin puede borrar cualquiera.
     */
    async delete(materialId, ctx) {
        const material = await this.materialRepository.findById(materialId);
        if (!material) throw new AppError('errors.notFound', { status: 404 });

        if (ctx.rol === 'Alumno') throw new AppError('errors.forbidden', { status: 403 });

        if (ctx.rol === 'Profesor') {
            let owns = false;
            for (const subjectId of material.materiasIds || []) {
                const subject = await this.subjectRepository.findById(subjectId);
                if (subject && subject.profesorId === ctx.usuarioId) { owns = true; break; }
            }
            if (!owns) throw new AppError('errors.forbidden', { status: 403 });
        }

        await this.materialRepository.delete(materialId);
        await this.auditLogService.record(AuditLog.OPERACIONES.BORRADO_MATERIAL, ctx.usuarioId, materialId);
        return { message: 'messages.materialDeleted' };
    }

    async getGlobalContent(filters, usuarioId = null) {
        const materials = await this.materialRepository.findAllGlobal(filters);
        return this.attachFavoriteFlag(materials, usuarioId);
    }

    async getBySubject(subjectId, filters, usuarioId = null) {
        const subject = await this.subjectRepository.findById(subjectId);
        if (!subject) throw new AppError('errors.notFound', { status: 404 });
        const materials = await this.materialRepository.findBySubject(subjectId, filters);
        return { subject, materials: await this.attachFavoriteFlag(materials, usuarioId) };
    }

    /** Marca esFavorito segun los favoritos del usuario autenticado (RF favoritos). */
    async attachFavoriteFlag(materials, usuarioId) {
        if (!usuarioId || !materials || !materials.length) return materials;
        const ids = await this.materialRepository.findFavoriteIds(usuarioId);
        const set = new Set(ids.map(Number));
        materials.forEach(m => { m.esFavorito = set.has(Number(m.id)) ? 1 : 0; });
        return materials;
    }

    async toggleFavorite(materialId, usuarioId) {
        if (!materialId || !usuarioId) throw new AppError('errors.invalidData', { status: 400 });
        const material = await this.materialRepository.findById(materialId);
        if (!material) throw new AppError('errors.notFound', { status: 404 });
        return this.materialRepository.toggleFavorite(materialId, usuarioId);
    }

    async getFavorites(usuarioId, filters = {}) {
        return this.materialRepository.findFavorites(usuarioId, filters);
    }
}

module.exports = MaterialService;