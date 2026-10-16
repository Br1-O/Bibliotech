/**
* Project     : Bibliotech  |  Capa: Dominio
* Entidad Subject (materia / categoria). Actua como SUJETO OBSERVABLE
* del patron Observer (RF-03).
*/

const Observable = require('../observers/Observable');

class Subject extends Observable {
    constructor({ id = null, nombre, descripcion = null, profesorId = null, estadoAsociacion = 'Activa' }) {
        super();
        this.id = id;
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.profesorId = profesorId;
        this.estadoAsociacion = estadoAsociacion;
    }

    get activa() {
        return this.estadoAsociacion === 'Activa';
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
