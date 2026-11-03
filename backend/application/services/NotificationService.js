/**
* Project     : Bibliotech  |  Capa: Aplicacion - Caso de Uso
* NotificationService: bandeja de avisos por material nuevo en materias
* a las que el alumno esta suscrito.
*/

class NotificationService {
    constructor(notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    async list(usuarioId, filters = {}) {
        const [notifications, unreadCount, total] = await Promise.all([
            this.notificationRepository.findByUser(usuarioId, filters),
            this.notificationRepository.countUnread(usuarioId),
            this.notificationRepository.countByUser(usuarioId)
        ]);
        return { notifications, unreadCount, total };
    }

    async markRead(id, usuarioId) {
        await this.notificationRepository.markRead(id, usuarioId);
        return { read: true };
    }

    async markAllRead(usuarioId) {
        const marked = await this.notificationRepository.markAllRead(usuarioId);
        return { read: true, marked };
    }
}

module.exports = NotificationService;
