/**
* Project     : Bibliotech  |  Capa: Dominio
* Entidad CareerYear: agrupacion secundaria (anio) dentro de una carrera.
*/

class CareerYear {
    constructor({ id = null, careerId, nombre, orden = 0, totalMaterias = 0, totalMateriales = 0, createdAt = null }) {
        this.id = id;
        this.careerId = careerId;
        this.nombre = nombre;
        this.orden = Number(orden) || 0;
        this.totalMaterias = Number(totalMaterias) || 0;
        this.totalMateriales = Number(totalMateriales) || 0;
        this.createdAt = createdAt;
    }
}

module.exports = CareerYear;
