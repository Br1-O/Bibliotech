/**
* Project     : Bibliotech  |  Capa: Dominio - Puerto de Salida
* Contrato del repositorio de Materias.
*/
const RepositoryInterface = require('./RepositoryInterface');

class SubjectRepositoryInterface extends RepositoryInterface {
    async save(subject)                          { return this._notImplemented('save'); }
    async findById(id)                           { return this._notImplemented('findById'); }
    async findAll()                              { return this._notImplemented('findAll'); }
    async requestAssociation(subjectId, profesorId) { return this._notImplemented('requestAssociation'); }
    async confirmAssociation(subjectId, profesorId) { return this._notImplemented('confirmAssociation'); }
    async rejectAssociation(subjectId)           { return this._notImplemented('rejectAssociation'); }
    async delete(id)                             { return this._notImplemented('delete'); }
}

module.exports = SubjectRepositoryInterface;
