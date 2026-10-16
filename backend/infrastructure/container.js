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

const AuditLogService = require('../application/services/AuditLogService');
const AuthService = require('../application/services/AuthService');
const RoleService = require('../application/services/RoleService');
const SubjectService = require('../application/services/SubjectService');
const MaterialService = require('../application/services/MaterialService');
const SubscriptionService = require('../application/services/SubscriptionService');
const LanguageManager = require('../validator/LanguageManager');

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

    const languageManager = new LanguageManager();
    const auditLogService = new AuditLogService(auditLogRepository);

    return {
        // Repositorios (puertos de salida)
        roleRepository,
        userRepository,
        subjectRepository,
        materialRepository,
        subscriptionRepository,
        auditLogRepository,

        // Infraestructura de soporte
        languageManager,

        // Servicios de aplicacion (puertos de entrada)
        auditLogService,
        roleService: new RoleService(roleRepository, auditLogService, languageManager),
        authService: new AuthService(userRepository, roleRepository, auditLogService, languageManager),
        subjectService: new SubjectService(subjectRepository, userRepository, auditLogService, languageManager),
        materialService: new MaterialService(materialRepository, subjectRepository, subscriptionRepository, auditLogService, languageManager),
        subscriptionService: new SubscriptionService(subscriptionRepository, subjectRepository, userRepository, auditLogService, languageManager)
    };
}

module.exports = { buildContainer };
