/**
* Project     : Bibliotech  |  Capa: Dominio - Puerto de Salida
* Contrato del repositorio de carreras (grupo principal) y anios (grupo secundario).
*/
const RepositoryInterface = require('./RepositoryInterface');

class CareerRepositoryInterface extends RepositoryInterface {
    async save(career)                       { return this._notImplemented('save'); }
    async update(id, changes)                { return this._notImplemented('update'); }
    async findById(id)                       { return this._notImplemented('findById'); }
    async findAll()                          { return this._notImplemented('findAll'); }
    async saveYear(year)                     { return this._notImplemented('saveYear'); }
    async updateYear(id, changes)            { return this._notImplemented('updateYear'); }
    async findYearById(id)                   { return this._notImplemented('findYearById'); }
    async findYearsByCareer(careerId)        { return this._notImplemented('findYearsByCareer'); }
}

module.exports = CareerRepositoryInterface;
