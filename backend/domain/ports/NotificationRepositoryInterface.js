/**
* Project     : Bibliotech  |  Capa: Dominio - Puerto de Salida
* Contrato del repositorio de notificaciones de los alumnos suscriptores.
*/
const RepositoryInterface = require('./RepositoryInterface');

class NotificationRepositoryInterface extends RepositoryInterface {
    async createForSubscribers(subjectId, materialId, alumnoIds) { return this._notImplemented('createForSubscribers'); }
    async findByUser(userId)                                     { return this._notImplemented('findByUser'); }
    async countUnread(userId)                                    { return this._notImplemented('countUnread'); }
    async markRead(id, userId)                                   { return this._notImplemented('markRead'); }
    async markAllRead(userId)                                    { return this._notImplemented('markAllRead'); }
}

module.exports = NotificationRepositoryInterface;
