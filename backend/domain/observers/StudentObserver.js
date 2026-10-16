/**
* Project     : Bibliotech  |  Capa: Dominio - Patron Observer
* Observador concreto: un alumno suscrito a una materia.
* RF-03: recibe el aviso cuando se publica material nuevo y aprobado.
*/

class StudentObserver {
    constructor({ alumnoId, email, materiaId, lang = 'es' }) {
        this.alumnoId = alumnoId;
        this.email = email;
        this.materiaId = materiaId;
        this.lang = lang;
        // Bandeja de notificaciones en memoria (efimera) para esta instancia.
        this.notifications = [];
    }

    /**
     * Reacciona a un evento emitido por la materia observada.
     * @returns {Object} notificacion generada
     */
    update(event, payload) {
        const notification = {
            alumnoId: this.alumnoId,
            materiaId: this.materiaId,
            evento: event,
            detalle: payload,
            fecha: new Date().toISOString()
        };
        this.notifications.push(notification);
        return notification;
    }
}

module.exports = StudentObserver;
