/**
* Project     : Bibliotech  |  Capa: Infraestructura
* Contenedor de inyeccion de dependencias (RNF-03).
* Permite intercambiar el adaptador de persistencia (MariaDB <-> MongoDB)
* cambiando unicamente las implementaciones registradas aqui.
*/

const MariaDBRoleRepository = require('./repositories/MariaDBRoleRepository');
const MariaDBUserRepository = require('./repositories/MariaDBUserRepository');
const MariaDBSubjectRepository = require('./repositories/MariaDBSubjectRepository');
const MariaDBMaterialRepository = require('./repositories/MariaDBMaterialRepository');
const MariaDBSubscriptionRepository = require('./repositories/MariaDBSubscriptionRepository');
const MariaDBAuditLogRepository = require('./repositories/MariaDBAuditLogRepository');
const MariaDBThematicTagRepository = require('./repositories/MariaDBThematicTagRepository');
const MariaDBNotificationRepository = require('./repositories/MariaDBNotificationRepository');
const ThematicTagService = require('../application/services/ThematicTagService');

const AuditLogService = require('../application/services/AuditLogService');
const AuthService = require('../application/services/AuthService');
const RoleService = require('../application/services/RoleService');
const SubjectService = require('../application/services/SubjectService');
const MaterialService = require('../application/services/MaterialService');
const SubscriptionService = require('../application/services/SubscriptionService');
const NotificationService = require('../application/services/NotificationService');
const LanguageManager = require('../validator/LanguageManager');
const fileHelper = require('../utils/fileHelper');

/**
 * Construye el grafo de dependencias. Cambiar el motor de persistencia
 * se reduce a sustituir estas instancias de repositorio.
 */
function buildContainer() {
    const roleRepository = new MariaDBRoleRepository();
    const userRepository = new MariaDBUserRepository();
    const subjectRepository = new MariaDBSubjectRepository();
    const materialRepository = new MariaDBMaterialRepository();
    const subscriptionRepository = new MariaDBSubscriptionRepository();
    const auditLogRepository = new MariaDBAuditLogRepository();
    const thematicTagRepository = new MariaDBThematicTagRepository();
    const notificationRepository = new MariaDBNotificationRepository();

    const languageManager = new LanguageManager();
    const auditLogService = new AuditLogService(auditLogRepository);
    const thematicTagService = new ThematicTagService(thematicTagRepository, auditLogService);

    return {
        // Repositorios (puertos de salida)
        roleRepository,
        userRepository,
        subjectRepository,
        materialRepository,
        subscriptionRepository,
        auditLogRepository,
        thematicTagRepository,
        notificationRepository,

        // Infraestructura de soporte
        languageManager,

        // Servicios de aplicacion (puertos de entrada)
        auditLogService,
        roleService: new RoleService(roleRepository, auditLogService, languageManager),
        authService: new AuthService(userRepository, roleRepository, auditLogService, languageManager, require('../application/services/mail/MailerService').mailerService),
        subjectService: new SubjectService(subjectRepository, userRepository, auditLogService, languageManager),
        materialService: new MaterialService(materialRepository, subjectRepository, subscriptionRepository, auditLogService, languageManager, thematicTagService, fileHelper, notificationRepository),
        subscriptionService: new SubscriptionService(subscriptionRepository, subjectRepository, userRepository, auditLogService, languageManager),
        notificationService: new NotificationService(notificationRepository),
        thematicTagService
    };
}

module.exports = { buildContainer };
