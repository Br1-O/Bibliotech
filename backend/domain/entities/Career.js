/**
* Project     : Bibliotech  |  Capa: Dominio
* Entidad Career: agrupacion principal (carrera). Contiene anios academicos.
*/

class Career {
    constructor({ id = null, nombre, color = '#6f5bd3', years = [], totalMaterias = 0, totalMateriales = 0, createdAt = null }) {
        this.id = id;
        this.nombre = nombre;
        this.color = color;
        this.years = Array.isArray(years) ? years : [];
        this.totalMaterias = Number(totalMaterias) || 0;
        this.totalMateriales = Number(totalMateriales) || 0;
        this.createdAt = createdAt;
    }
}

module.exports = Career;
