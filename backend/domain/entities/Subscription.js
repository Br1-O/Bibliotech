/**
* Project     : Bibliotech  |  Capa: Dominio
* Entidad Subscription (patron Observer, RF-05).
*/

class Subscription {
    constructor({ id = null, alumnoId, materiaId, estado = 'Suscrito', createdAt = null }) {
        this.id = id;
        this.alumnoId = alumnoId;
        this.materiaId = materiaId;
        this.estado = estado;
        this.createdAt = createdAt;
    }

    get baneado() {
        return this.estado === 'Baneado';
    }

    ban() {
        this.estado = 'Baneado';
    }

    reactivate() {
        this.estado = 'Suscrito';
    }
}

module.exports = Subscription;
