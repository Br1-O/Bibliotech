/**
* Project     : Bibliotech  |  Capa: Dominio - Puerto de Salida
* Contrato del repositorio de Roles.
*/
const RepositoryInterface = require('./RepositoryInterface');

class RoleRepositoryInterface extends RepositoryInterface {
    async save(role)            { return this._notImplemented('save'); }
    async findById(id)          { return this._notImplemented('findById'); }
    async findByName(nombre)    { return this._notImplemented('findByName'); }
    async findAll()             { return this._notImplemented('findAll'); }
    async delete(id)            { return this._notImplemented('delete'); }
}

module.exports = RoleRepositoryInterface;
