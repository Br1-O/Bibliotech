/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (REST)
* AuditController: consulta del registro de auditoria (RD-06).
*/

const { ok } = require('../utils/respond');
const { parsePagination, paginationMeta } = require('../utils/pagination');

module.exports = (container) => {
    const { auditLogService } = container;

    return {
        async list(req, res, next) {
            try {
                const pagination = parsePagination(req.query);
                const result = await auditLogService.getAllLogs(pagination);
                return ok(req, res, {
                    logs: result.logs,
                    pagination: paginationMeta(result.total, pagination)
                });
            } catch (error) { return next(error); }
        },

        async byUser(req, res, next) {
            try {
                const pagination = parsePagination(req.query);
                const result = await auditLogService.getByUser(Number(req.params.id), pagination);
                return ok(req, res, {
                    logs: result.logs,
                    pagination: paginationMeta(result.total, pagination)
                });
            } catch (error) { return next(error); }
        }
    };
};
