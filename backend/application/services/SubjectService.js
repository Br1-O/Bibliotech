/**
* Project     : Bibliotech  |  Capa: Aplicacion - Caso de Uso
* SubjectService: gestion de materias (categorias) y asociacion de profesores (RF-02).
*/

const db = require('../../config/db');
const Subject = require('../../domain/entities/Subject');
const AuditLog = require('../../domain/entities/AuditLog');
const AppError = require('../../utils/AppError');
const TtlCache = require('../../utils/ttlCache');
const ValidationHandler = require('../../validator/ValidationHandler');
const Required = require('../../validator/rules/Required');
const Length = require('../../validator/rules/Length');

const requireId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('validation.invalidData', { status: 422 });
    }
    return id;
};

const optionalId = (value) => {
    if (value === null || value === undefined || value === '') return null;
    return requireId(value);
};

class SubjectService {
    constructor(subjectRepository, userRepository, auditLogService, languageManager, careerRepository = null) {
        this.subjectRepository = subjectRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.languageManager = languageManager;
        this.careerRepository = careerRepository;
        this.referenceCache = new TtlCache({ ttlMs: 60000, maxEntries: 50 });
    }

    async createSubject(dto, usuarioId = null) {
        const validator = new ValidationHandler(this.languageManager)
            .with(new Required('nombre'))
            .with(new Length('nombre', { min: 2, max: 100 }))
            .with(new Length('descripcion', { min: 0, max: 500 }));
        if (!validator.validateThis(dto)) throw validator.toError();

        const profesorIds = await this.resolveProfessorIds(dto);
        const careerYearId = await this.resolveCareerYear(dto.careerYearId);

        const result = await db.transaction(async () => {
            const subject = await this.subjectRepository.save(new Subject({
                nombre: dto.nombre,
                descripcion: dto.descripcion || null,
                profesorId: profesorIds[0] || null,
                careerYearId,
                estadoAsociacion: profesorIds.length ? 'Activa' : 'Pendiente'
            }));
            if (profesorIds.length) await this.subjectRepository.replaceProfessors(subject.id, profesorIds);

            await this.auditLogService.record(AuditLog.OPERACIONES.ALTA_MATERIA, usuarioId, subject.id);
            for (const profesorId of profesorIds) {
                await this.auditLogService.record(AuditLog.OPERACIONES.ASOCIACION_MATERIA, usuarioId, subject.id);
            }
            return this.subjectRepository.findById(subject.id);
        });
        this.referenceCache.clear();
        return result;
    }

    /** Normaliza profesorId/profesorIds y valida que todos sean profesores. */
    async resolveProfessorIds(dto = {}) {
        const raw = dto.profesorIds !== undefined ? dto.profesorIds : dto.profesorId;
        if (raw === undefined || raw === null || raw === '') return [];
        const values = Array.isArray(raw) ? raw : [raw];
        const ids = [...new Set(values.map(Number))];
        if (ids.some(id => !Number.isInteger(id) || id <= 0)) {
            throw new AppError('validation.invalidData', { status: 422 });
        }
        for (const id of ids) {
            const profesor = await this.userRepository.findById(id);
            if (!profesor || !profesor.isProfesor()) throw new AppError('errors.notFound', { status: 404 });
        }
        return ids;
    }

    /** Un profesor solicita asociarse a una materia existente. */
    async requestAssociation(subjectId, profesorId) {
        subjectId = requireId(subjectId);
        profesorId = requireId(profesorId);
        const result = await db.transaction(async () => {
            const subject = await this.subjectRepository.findById(subjectId);
            if (!subject) throw new AppError('errors.notFound', { status: 404 });
            if (subject.hasProfessor(profesorId)) {
                throw new AppError('validation.invalidState', { status: 409 });
            }

            await this.subjectRepository.requestAssociation(subjectId, profesorId);
            await this.auditLogService.record(AuditLog.OPERACIONES.SOLICITUD_MATERIA, profesorId, subjectId);
            return { message: 'messages.associationRequested' };
        });
        this.referenceCache.clear();
        return result;
    }

    /** El superadministrador confirma una solicitud concreta. */
    async confirmAssociation(subjectId, profesorId = null, usuarioId = null) {
        subjectId = requireId(subjectId);
        profesorId = optionalId(profesorId);
        const result = await db.transaction(async () => {
            const subject = await this.subjectRepository.findById(subjectId);
            if (!subject) throw new AppError('errors.notFound', { status: 404 });

            const request = await this.subjectRepository.findAssociationRequest(subjectId, profesorId);
            if (!request) throw new AppError('errors.notFound', { status: 404 });

            await this.subjectRepository.addProfessor(subjectId, request.profesorId);
            await this.subjectRepository.deleteAssociationRequest(subjectId, request.profesorId);
            await this.subjectRepository.update(subjectId, { estadoAsociacion: 'Activa' });
            await this.auditLogService.record(AuditLog.OPERACIONES.ASOCIACION_MATERIA, usuarioId, subjectId);
            return { message: 'messages.associationConfirmed' };
        });
        this.referenceCache.clear();
        return result;
    }

    async rejectAssociation(subjectId, usuarioId = null, profesorId = null) {
        subjectId = requireId(subjectId);
        profesorId = optionalId(profesorId);
        const result = await db.transaction(async () => {
            const subject = await this.subjectRepository.findById(subjectId);
            if (!subject) throw new AppError('errors.notFound', { status: 404 });

            const request = await this.subjectRepository.findAssociationRequest(subjectId, profesorId);
            if (!request) throw new AppError('errors.notFound', { status: 404 });

            await this.subjectRepository.deleteAssociationRequest(subjectId, request.profesorId);
            await this.auditLogService.record(AuditLog.OPERACIONES.SOLICITUD_MATERIA, usuarioId, subjectId);
            return { message: 'messages.associationRejected' };
        });
        this.referenceCache.clear();
        return result;
    }

    /** Valida que el anio exista y devuelve su id (o null si no se indica). */
    async resolveCareerYear(rawId) {
        if (rawId === undefined || rawId === null || rawId === '') return null;
        const id = Number(rawId);
        if (!Number.isInteger(id) || id <= 0) {
            throw new AppError('validation.invalidData', { status: 422 });
        }
        if (this.careerRepository) {
            const year = await this.careerRepository.findYearById(id);
            if (!year) throw new AppError('errors.notFound', { status: 404 });
        }
        return id;
    }

    async getAllSubjects(filters = {}) {
        const key = `subjects:${JSON.stringify(filters)}`;
        return this.referenceCache.getOrSet(key, () => this.subjectRepository.findAll(filters));
    }

    async getSubjectById(id) {
        const subject = await this.subjectRepository.findById(id);
        if (!subject) throw new AppError('errors.notFound', { status: 404 });
        return subject;
    }

    async updateSubject(subjectId, dto, usuarioId = null) {
        const subject = await this.subjectRepository.findById(subjectId);
        if (!subject) throw new AppError('errors.notFound', { status: 404 });

        const updates = {};
        if (dto.nombre !== undefined && dto.nombre !== null) updates.nombre = String(dto.nombre).trim();
        if (dto.descripcion !== undefined) updates.descripcion = dto.descripcion;
        if (dto.careerYearId !== undefined) updates.careerYearId = await this.resolveCareerYear(dto.careerYearId);
        const professorUpdate = dto.profesorIds !== undefined || dto.profesorId !== undefined;
        const profesorIds = professorUpdate ? await this.resolveProfessorIds(dto) : null;

        if (updates.nombre !== undefined) {
            const validator = new ValidationHandler(this.languageManager)
                .with(new Required('nombre'))
                .with(new Length('nombre', { min: 2, max: 100 }));
            if (!validator.validateThis({ nombre: updates.nombre })) throw validator.toError();
        }

        const result = await db.transaction(async () => {
            if (Object.keys(updates).length) await this.subjectRepository.update(subjectId, updates);
            if (professorUpdate) {
                await this.subjectRepository.replaceProfessors(subjectId, profesorIds);
                await this.subjectRepository.update(subjectId, {
                    estadoAsociacion: profesorIds.length ? 'Activa' : 'Pendiente'
                });
                await this.subjectRepository.clearAssociationRequests(subjectId);
            }
            await this.auditLogService.record(AuditLog.OPERACIONES.MODIFICACION_MATERIA, usuarioId, subjectId);
            return this.subjectRepository.findById(subjectId);
        });
        this.referenceCache.clear();
        return result;
    }
}

module.exports = SubjectService;
