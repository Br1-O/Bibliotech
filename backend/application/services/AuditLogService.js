/**
* Project     : Bibliotech  |  Capa: Aplicacion - Caso de Uso
* Servicio de auditoria (RD-06). Toda accion critica pasa por aqui.
*/

const AuditLog = require('../../domain/entities/AuditLog');

class AuditLogService {
    constructor(auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Registra una operacion auditable.
     * @param {string} tipoOperacion constante de AuditLog.OPERACIONES
     * @param {number|null} usuarioId ejecutor de la accion
     * @param {string|number|null} registroId objeto afectado
     */
    async record(tipoOperacion, usuarioId = null, registroId = null) {
        // La auditoria es parte de la operacion: si no se puede registrar,
        // la transaccion del caso de uso debe revertirse.
        return this.auditLogRepository.save({ tipoOperacion, usuarioId, registroId });
    }

    async recordMany(tipoOperacion, usuarioId, registroIds = []) {
        if (!registroIds.length) return [];
        return this.auditLogRepository.saveMany(registroIds.map(registroId => ({
            tipoOperacion,
            usuarioId,
            registroId,
            registroTipo: AuditLog.tipoRegistro(tipoOperacion)
        })));
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
