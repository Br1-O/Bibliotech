/**
* Project     : Bibliotech  |  Capa: Aplicacion - Caso de Uso
* SubjectService: gestion de materias (categorias) y asociacion de profesores (RF-02).
*/

const Subject = require('../../domain/entities/Subject');
const AuditLog = require('../../domain/entities/AuditLog');
const AppError = require('../../utils/AppError');
const ValidationHandler = require('../../validator/ValidationHandler');
const ValidationError = require('../../validator/ValidationError');
const Required = require('../../validator/rules/Required');
const Length = require('../../validator/rules/Length');

class SubjectService {
    constructor(subjectRepository, userRepository, auditLogService, languageManager) {
        this.subjectRepository = subjectRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.languageManager = languageManager;
    }

    async createSubject(dto, usuarioId = null) {
        const validator = new ValidationHandler(this.languageManager)
            .with(new Required('nombre'))
            .with(new Length('nombre', { min: 2, max: 100 }))
            .with(new Length('descripcion', { min: 0, max: 500 }));
        if (!validator.validateThis(dto)) throw new ValidationError(validator.getErrors());

        if (dto.profesorId) {
            const profesor = await this.userRepository.findById(dto.profesorId);
            if (!profesor || !profesor.isProfesor()) throw new AppError('errors.notFound', { status: 404 });
        }

        const subject = await this.subjectRepository.save(new Subject({
            nombre: dto.nombre,
            descripcion: dto.descripcion || null,
            profesorId: dto.profesorId || null,
            estadoAsociacion: 'Activa'
        }));

        await this.auditLogService.record(AuditLog.OPERACIONES.ALTA_MATERIA, usuarioId, subject.id);
        if (dto.profesorId) {
            await this.auditLogService.record(AuditLog.OPERACIONES.ASOCIACION_MATERIA, usuarioId, subject.id);
        }
        return subject;
    }

    /** Un profesor solicita asociarse a una materia existente. */
    async requestAssociation(subjectId, profesorId) {
        const subject = await this.subjectRepository.findById(subjectId);
        if (!subject) throw new AppError('errors.notFound', { status: 404 });

        await this.subjectRepository.requestAssociation(subjectId, profesorId);
        await this.auditLogService.record(AuditLog.OPERACIONES.SOLICITUD_MATERIA, profesorId, subjectId);
        return { message: 'messages.associationRequested' };
    }

    /** El superadministrador confirma la asociacion. */
    async confirmAssociation(subjectId, profesorId = null, usuarioId = null) {
        const subject = await this.subjectRepository.findById(subjectId);
        if (!subject) throw new AppError('errors.notFound', { status: 404 });

        await this.subjectRepository.confirmAssociation(subjectId, profesorId);
        await this.auditLogService.record(AuditLog.OPERACIONES.ASOCIACION_MATERIA, usuarioId, subjectId);
        return { message: 'messages.associationConfirmed' };
    }

    async rejectAssociation(subjectId, usuarioId = null) {
        const subject = await this.subjectRepository.findById(subjectId);
        if (!subject) throw new AppError('errors.notFound', { status: 404 });

        await this.subjectRepository.rejectAssociation(subjectId);
        await this.auditLogService.record(AuditLog.OPERACIONES.SOLICITUD_MATERIA, usuarioId, subjectId);
        return { message: 'messages.associationRejected' };
    }

    async getAllSubjects() {
        return this.subjectRepository.findAll();
    }

    async getSubjectById(id) {
        const subject = await this.subjectRepository.findById(id);
        if (!subject) throw new AppError('errors.notFound', { status: 404 });
        return subject;
    }
}

module.exports = SubjectService;
