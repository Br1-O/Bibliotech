/**
* Project     : Bibliotech  |  Capa: Dominio - Puerto de Salida
* Contrato del repositorio de Materias.
*/
const RepositoryInterface = require('./RepositoryInterface');

class SubjectRepositoryInterface extends RepositoryInterface {
    async save(subject)                          { return this._notImplemented('save'); }
    async findById(id)                           { return this._notImplemented('findById'); }
    async findAll(filters)                       { return this._notImplemented('findAll'); }
    async update(id, changes)                    { return this._notImplemented('update'); }
    async addProfessor(subjectId, profesorId)    { return this._notImplemented('addProfessor'); }
    async removeProfessor(subjectId, profesorId) { return this._notImplemented('removeProfessor'); }
    async replaceProfessors(subjectId, ids)      { return this._notImplemented('replaceProfessors'); }
    async requestAssociation(subjectId, profesorId) { return this._notImplemented('requestAssociation'); }
    async confirmAssociation(subjectId, profesorId) { return this._notImplemented('confirmAssociation'); }
    async rejectAssociation(subjectId)           { return this._notImplemented('rejectAssociation'); }
    async delete(id)                             { return this._notImplemented('delete'); }
}

module.exports = SubjectRepositoryInterface;
