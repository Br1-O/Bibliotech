/**
* Project     : Bibliotech  |  Capa: Dominio - Puerto de Salida
* Contrato del repositorio de Suscripciones (patron Observer).
*/
const RepositoryInterface = require('./RepositoryInterface');

class SubscriptionRepositoryInterface extends RepositoryInterface {
    async save(subscription)                       { return this._notImplemented('save'); }
    async findById(id)                             { return this._notImplemented('findById'); }
    async findByAlumnoAndMateria(alumnoId, materiaId) { return this._notImplemented('findByAlumnoAndMateria'); }
    async subscribe(alumnoId, materiaId)           { return this._notImplemented('subscribe'); }
    async banStudent(alumnoId, materiaId)          { return this._notImplemented('banStudent'); }
    async getObservers(materiaId)                  { return this._notImplemented('getObservers'); }
    async findByAlumno(alumnoId)                   { return this._notImplemented('findByAlumno'); }
    async delete(id)                               { return this._notImplemented('delete'); }
}

module.exports = SubscriptionRepositoryInterface;
