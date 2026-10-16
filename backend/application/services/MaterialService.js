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

const PENDING_LIMIT = 3;

class MaterialService {
    constructor(materialRepository, subjectRepository, subscriptionRepository, auditLogService, languageManager) {
        this.materialRepository = materialRepository;
        this.subjectRepository = subjectRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.auditLogService = auditLogService;
        this.languageManager = languageManager;
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

    async getGlobalContent(filters) {
        return this.materialRepository.findAllGlobal(filters);
    }

    async getBySubject(subjectId, filters) {
        const subject = await this.subjectRepository.findById(subjectId);
        if (!subject) throw new AppError('errors.notFound', { status: 404 });
        const materials = await this.materialRepository.findBySubject(subjectId, filters);
        return { subject, materials };
    }
}

module.exports = MaterialService;
