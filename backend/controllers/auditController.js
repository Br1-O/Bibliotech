/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (REST)
* AuditController: consulta del registro de auditoria (RD-06).
*/

const { ok } = require('../utils/respond');

module.exports = (container) => {
    const { auditLogService } = container;

    return {
        async list(req, res, next) {
            try {
                const logs = await auditLogService.getAllLogs();
                return ok(req, res, { logs });
            } catch (error) { return next(error); }
        },

        async byUser(req, res, next) {
            try {
                const logs = await auditLogService.getByUser(Number(req.params.id));
                return ok(req, res, { logs });
            } catch (error) { return next(error); }
        }
    };
};
