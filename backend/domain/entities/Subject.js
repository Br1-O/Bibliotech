/**
* Project     : Bibliotech  |  Capa: Dominio
* Entidad Subject (materia / categoria). Actua como SUJETO OBSERVABLE
* del patron Observer (RF-03).
*/

const Observable = require('../observers/Observable');

class Subject extends Observable {
    constructor({
        id = null,
        nombre,
        descripcion = null,
        profesorId = null,
        profesores = [],
        careerYearId = null,
        estadoAsociacion = 'Activa',
        anioId = null,
        anioNombre = null,
        carreraId = null,
        carreraNombre = null,
        carreraColor = null
    }) {
        super();
        this.id = id;
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.profesorId = profesorId;
        this.profesores = Array.isArray(profesores) ? profesores : [];
        this.careerYearId = careerYearId;
        this.estadoAsociacion = estadoAsociacion;
        this.anioId = anioId;
        this.anioNombre = anioNombre;
        this.carreraId = carreraId;
        this.carreraNombre = carreraNombre;
        this.carreraColor = carreraColor;
    }

    get activa() {
        return this.estadoAsociacion === 'Activa';
    }

    get profesorIds() {
        const ids = this.profesores.map(profesor => Number(profesor.id)).filter(Boolean);
        if (!ids.length && this.profesorId) ids.push(Number(this.profesorId));
        return [...new Set(ids)];
    }

    hasProfessor(id) {
        return this.profesorIds.includes(Number(id));
    }

    /**
     * Notifica a todos los alumnos observadores que hay material nuevo.
     * @param {Object} material material aprobado y publicado
     */
    notifyObservers(material) {
        return this.notify('MATERIAL_PUBLICADO', {
            materiaId: this.id,
            materia: this.nombre,
            material
        });
    }
}

module.exports = Subject;
