/**
* Project     : Bibliotech  |  Capa: Infraestructura
* Contenedor de inyeccion de dependencias (RNF-03).
* Permite intercambiar el adaptador de persistencia (MariaDB <-> MongoDB)
* cambiando unicamente las implementaciones registradas aqui.
*/

const { getConfig } = require('../config/env');
const MariaDBRoleRepository = require('./repositories/MariaDBRoleRepository');
const MariaDBUserRepository = require('./repositories/MariaDBUserRepository');
const MariaDBCareerRepository = require('./repositories/MariaDBCareerRepository');
const MariaDBSubjectRepository = require('./repositories/MariaDBSubjectRepository');
const MariaDBMaterialRepository = require('./repositories/MariaDBMaterialRepository');
const MariaDBSubscriptionRepository = require('./repositories/MariaDBSubscriptionRepository');
const MariaDBAuditLogRepository = require('./repositories/MariaDBAuditLogRepository');
const MariaDBThematicTagRepository = require('./repositories/MariaDBThematicTagRepository');
const MariaDBNotificationRepository = require('./repositories/MariaDBNotificationRepository');
const MariaDBGamificationRepository = require('./repositories/MariaDBGamificationRepository');
const MariaDBOutboxRepository = require('./repositories/MariaDBOutboxRepository');
const OutboxService = require('../application/services/OutboxService');
const OutboxWorker = require('./workers/OutboxWorker');
const ThematicTagService = require('../application/services/ThematicTagService');
const GamificationService = require('../application/services/GamificationService');

const AuditLog = require('../domain/entities/AuditLog');
const AuditLogService = require('../application/services/AuditLogService');
const AuthService = require('../application/services/AuthService');
const RoleService = require('../application/services/RoleService');
const CareerService = require('../application/services/CareerService');
const SubjectService = require('../application/services/SubjectService');
const MaterialService = require('../application/services/MaterialService');
const SubscriptionService = require('../application/services/SubscriptionService');
const NotificationService = require('../application/services/NotificationService');
const { mailerService } = require('../application/services/mail/MailerService');
const LanguageManager = require('../validator/LanguageManager');
const fileHelper = require('../utils/fileHelper');
const metrics = require('../utils/metrics');
const { createAuthMiddleware } = require('../middleware/authMiddleware');

/**
 * Construye el grafo de dependencias. Cambiar el motor de persistencia
 * se reduce a sustituir estas instancias de repositorio.
 */
function buildContainer() {
    const config = getConfig();
    const roleRepository = new MariaDBRoleRepository();
    const userRepository = new MariaDBUserRepository();
    const careerRepository = new MariaDBCareerRepository();
    const subjectRepository = new MariaDBSubjectRepository();
    const materialRepository = new MariaDBMaterialRepository();
    const subscriptionRepository = new MariaDBSubscriptionRepository();
    const auditLogRepository = new MariaDBAuditLogRepository();
    const thematicTagRepository = new MariaDBThematicTagRepository();
    const notificationRepository = new MariaDBNotificationRepository();
    const gamificationRepository = new MariaDBGamificationRepository();
    const outboxRepository = new MariaDBOutboxRepository();

    const outboxService = new OutboxService({
        outboxRepository,
        workerId: `api-${process.pid}`,
        maxAttempts: config.outbox.maxAttempts,
        baseBackoffMs: config.outbox.baseBackoffMs,
        maxBackoffMs: config.outbox.maxBackoffMs
    });

    outboxService.registerHandler('notification.create_many', (payload) =>
        notificationRepository.createMany(payload.userIds, payload.data));
    outboxService.registerHandler('notification.create_for_subscribers', (payload) =>
        notificationRepository.createForSubscribers(
            payload.subjectId,
            payload.materialId,
            payload.alumnoIds,
            payload.options || {}
        ));
    outboxService.registerHandler('notification.create_for_followers', (payload) =>
        notificationRepository.createForFollowers(payload.targetUserId, payload.data));
    outboxService.registerHandler('audit.record', async (payload, event) => {
        const log = new AuditLog(payload.log);
        log.idempotencyKey = `outbox:${event.id}`;
        return auditLogRepository.save(log);
    });
    outboxService.registerHandler('audit.record_many', async (payload, event) => {
        const logs = payload.logs.map((item, index) => {
            const log = new AuditLog(item);
            log.idempotencyKey = `outbox:${event.id}:${index}`;
            return log;
        });
        return auditLogRepository.saveMany(logs);
    });
    outboxService.registerHandler('email.send', async (payload) => {
        try {
            const result = await mailerService.send(payload);
            metrics.recordMailSent('outbox');
            return result;
        } catch (error) {
            metrics.recordMailError('outbox');
            throw error;
        }
    });

    const outboxWorker = new OutboxWorker({
        outboxService,
        intervalMs: config.outbox.pollIntervalMs,
        batchSize: config.outbox.batchSize,
        staleMs: config.outbox.staleMs
    });

    const languageManager = new LanguageManager();
    const auditLogService = new AuditLogService(auditLogRepository, outboxService);
    const thematicTagService = new ThematicTagService(thematicTagRepository, auditLogService);
    const gamificationService = new GamificationService({
        gamificationRepository,
        userRepository,
        materialRepository,
        notificationRepository,
        outboxService
    });

    return {
        // Repositorios (puertos de salida)
        roleRepository,
        userRepository,
        careerRepository,
        subjectRepository,
        materialRepository,
        subscriptionRepository,
        auditLogRepository,
        thematicTagRepository,
        notificationRepository,
        gamificationRepository,
        outboxRepository,

        // Infraestructura de soporte
        languageManager,
        outboxService,
        outboxWorker,
        authMiddleware: createAuthMiddleware({ userRepository }),

        // Servicios de aplicacion (puertos de entrada)
        auditLogService,
        roleService: new RoleService(roleRepository, auditLogService, languageManager),
        authService: new AuthService(userRepository, roleRepository, auditLogService, languageManager, mailerService, outboxService),
        careerService: new CareerService(careerRepository, auditLogService, languageManager),
        subjectService: new SubjectService(subjectRepository, userRepository, auditLogService, languageManager, careerRepository),
        materialService: new MaterialService(materialRepository, subjectRepository, subscriptionRepository, auditLogService, languageManager, thematicTagService, fileHelper, notificationRepository, gamificationService, outboxService),
        subscriptionService: new SubscriptionService(subscriptionRepository, subjectRepository, userRepository, auditLogService, languageManager),
        notificationService: new NotificationService(notificationRepository),
        thematicTagService,
        gamificationService
    };
}

module.exports = { buildContainer };
