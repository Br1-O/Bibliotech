/**
* Project     : Bibliotech  |  Capa: Aplicacion - Caso de Uso
* Servicio de auditoria (RD-06). Toda accion critica pasa por aqui.
*/

const AuditLog = require('../../domain/entities/AuditLog');

class AuditLogService {
    constructor(auditLogRepository, outboxService = null) {
        this.auditLogRepository = auditLogRepository;
        this.outboxService = outboxService;
    }

    /**
     * Registra una operacion auditable.
     * @param {string} tipoOperacion constante de AuditLog.OPERACIONES
     * @param {number|null} usuarioId ejecutor de la accion
     * @param {string|number|null} registroId objeto afectado
     */
    async record(tipoOperacion, usuarioId = null, registroId = null) {
        const log = {
            tipoOperacion,
            usuarioId,
            registroId,
            registroTipo: AuditLog.tipoRegistro(tipoOperacion)
        };
        if (this.outboxService) {
            await this.outboxService.enqueue('audit.record', { log }, { immediate: true });
            return log;
        }
        return this.auditLogRepository.save(log);
    }

    async recordMany(tipoOperacion, usuarioId, registroIds = []) {
        if (!registroIds.length) return [];
        const logs = registroIds.map(registroId => ({
            tipoOperacion,
            usuarioId,
            registroId,
            registroTipo: AuditLog.tipoRegistro(tipoOperacion)
        }));
        if (this.outboxService) {
            await this.outboxService.enqueue('audit.record_many', { logs }, { immediate: true });
            return logs;
        }
        return this.auditLogRepository.saveMany(logs);
    }

    async getAllLogs(filters = {}) {
        const { items, total } = await this.auditLogRepository.findAll(filters);
        return { logs: items, total };
    }

    async getByUser(userId, filters = {}) {
        const { items, total } = await this.auditLogRepository.findByUser(userId, filters);
        return { logs: items, total };
    }
}

module.exports = AuditLogService;
