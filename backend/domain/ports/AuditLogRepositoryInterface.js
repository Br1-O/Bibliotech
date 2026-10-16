/**
* Project     : Bibliotech  |  Capa: Dominio - Puerto de Salida
* Contrato del repositorio de Auditoria (RD-06).
*/
const RepositoryInterface = require('./RepositoryInterface');

class AuditLogRepositoryInterface extends RepositoryInterface {
    async save(log)            { return this._notImplemented('save'); }
    async findAll()            { return this._notImplemented('findAll'); }
    async findByUser(userId)   { return this._notImplemented('findByUser'); }
}

module.exports = AuditLogRepositoryInterface;
