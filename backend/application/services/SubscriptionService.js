/**
* Project     : Bibliotech  |  Capa: Aplicacion - Caso de Uso
* SubscriptionService: suscripcion de alumnos (patron Observer, RF-03)
* y moderacion / baneo por parte del profesor titular (RF-05).
*/

const db = require('../../config/db');
const AuditLog = require('../../domain/entities/AuditLog');
const AppError = require('../../utils/AppError');

class SubscriptionService {
    constructor(subscriptionRepository, subjectRepository, userRepository, auditLogService, languageManager) {
        this.subscriptionRepository = subscriptionRepository;
        this.subjectRepository = subjectRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.languageManager = languageManager;
    }

    /** RF-03: el alumno se suscribe a una materia. */
    async subscribe(alumnoId, materiaId) {
        return db.transaction(async () => {
            const subject = await this.subjectRepository.findById(materiaId);
            if (!subject || !subject.activa) throw new AppError('errors.notFound', { status: 404 });

            const subscription = await this.subscriptionRepository.subscribe(alumnoId, materiaId);
            if (subscription && subscription.baneado) {
                throw new AppError('errors.forbidden', { status: 403 });
            }
            await this.auditLogService.record(AuditLog.OPERACIONES.SUSCRIPCION, alumnoId, materiaId);
            return { message: 'messages.subscribed' };
        });
    }

    async unsubscribe(alumnoId, materiaId) {
        return db.transaction(async () => {
            const existing = await this.subscriptionRepository.findByAlumnoAndMateria(alumnoId, materiaId);
            if (!existing) throw new AppError('errors.notFound', { status: 404 });
            await this.subscriptionRepository.delete(existing.id);
            return { message: 'messages.unsubscribed' };
        });
    }

    /** RF-05: el profesor titular banea a un alumno infractor. */
    async banStudent(alumnoId, materiaId, ctx) {
        return db.transaction(async () => {
            const subject = await this.subjectRepository.findById(materiaId);
            if (!subject) throw new AppError('errors.notFound', { status: 404 });
            if (ctx.rol !== 'Superadmin' && !subject.hasProfessor(ctx.usuarioId)) {
                throw new AppError('errors.forbidden', { status: 403 });
            }

            await this.subscriptionRepository.banStudent(alumnoId, materiaId);
            await this.auditLogService.record(AuditLog.OPERACIONES.BANEO_ALUMNO, ctx.usuarioId, alumnoId);
            return { message: 'messages.banned' };
        });
    }

    async getMySubscriptions(alumnoId) {
        return this.subscriptionRepository.findByAlumno(alumnoId);
    }

    async getObservers(materiaId) {
        return this.subscriptionRepository.getObservers(materiaId);
    }
}

module.exports = SubscriptionService;
