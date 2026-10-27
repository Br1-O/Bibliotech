/**
* Project     : Bibliotech  |  Capa: Aplicacion - Caso de Uso
* NotificationService: bandeja de avisos por material nuevo en materias
* a las que el alumno esta suscrito.
*/

class NotificationService {
    constructor(notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    async list(usuarioId) {
        const [notifications, unreadCount] = await Promise.all([
            this.notificationRepository.findByUser(usuarioId),
            this.notificationRepository.countUnread(usuarioId)
        ]);
        return { notifications, unreadCount };
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
