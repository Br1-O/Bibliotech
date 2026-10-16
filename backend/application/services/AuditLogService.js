/**
* Project     : Bibliotech  |  Capa: Aplicacion - Caso de Uso
* Servicio de auditoria (RD-06). Toda accion critica pasa por aqui.
*/

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
        // La auditoria nunca debe interrumpir el flujo principal.
        try {
            return await this.auditLogRepository.save({ tipoOperacion, usuarioId, registroId });
        } catch (error) {
            console.error(`[AUDIT] No se pudo registrar "${tipoOperacion}": ${error.message}`);
            return null;
        }
    }

    async getAllLogs() {
        return this.auditLogRepository.findAll();
    }

    async getByUser(userId) {
        return this.auditLogRepository.findByUser(userId);
    }
}

module.exports = AuditLogService;
