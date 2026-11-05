/**
* Project     : Bibliotech  |  Capa: Infraestructura - Adaptador de Salida
* Implementacion MariaDB de la bandeja de notificaciones.
*/

const db = require('../../config/db');
const NotificationRepositoryInterface = require('../../domain/ports/NotificationRepositoryInterface');

class MariaDBNotificationRepository extends NotificationRepositoryInterface {
    async createMany(userIds, { subjectId = null, materialId = null, type = 'material', message = null, actorId = null } = {}) {
        const ids = [...new Set((userIds || []).map(Number).filter(Boolean))];
        if (!ids.length) return 0;

        const values = ids.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const params = [];
        ids.forEach(usuarioId => params.push(usuarioId, actorId, subjectId, materialId, type, message));

        const [result] = await db.query(
            `INSERT INTO notifications (usuario_id, actor_id, subject_id, material_id, type, message)
             VALUES ${values}
             ON DUPLICATE KEY UPDATE id = id`,
            params
        );
        return result.affectedRows;
    }

    async createForSubscribers(subjectId, materialId, alumnoIds, options = {}) {
        return this.createMany(alumnoIds, { subjectId, materialId, type: 'material', ...options });
    }

    async createForFollowers(targetUserId, { subjectId = null, materialId = null, type = 'material', message = null, actorId = null } = {}) {
        const [result] = await db.query(
            `INSERT INTO notifications (usuario_id, actor_id, subject_id, material_id, type, message)
             SELECT subscriber_id, ?, ?, ?, ?, ?
               FROM user_subscriptions
              WHERE target_user_id = ?
             ON DUPLICATE KEY UPDATE id = id`,
            [actorId, subjectId, materialId, type, message, targetUserId]
        );
        return result.affectedRows;
    }

    async findByUser(userId, filters = {}) {
        const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
        const offset = Math.max(Number(filters.offset) || 0, 0);
        const [rows] = await db.query(
            `SELECT n.id, n.type, n.message,
                    n.subject_id AS subjectId, s.nombre AS subjectNombre,
                    n.material_id AS materialId, m.titulo AS materialTitulo,
                    n.actor_id AS actorId,
                    CONCAT(a.nombre, ' ', a.apellido) AS actorNombre,
                    a.profile_picture AS actorPicture,
                    n.created_at AS createdAt, n.read_at AS readAt,
                    CONCAT(p.nombre, ' ', p.apellido) AS profesorNombre
             FROM notifications n
             LEFT JOIN subjects s ON s.id = n.subject_id
             LEFT JOIN materials m ON m.id = n.material_id
             LEFT JOIN users a ON a.id = n.actor_id
             LEFT JOIN users p ON p.id = s.profesor_id
             WHERE n.usuario_id = ?
             ORDER BY n.created_at DESC, n.id DESC
             LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );
        return rows;
    }

    async countByUser(userId) {
        const [rows] = await db.query(
            'SELECT COUNT(*) AS total FROM notifications WHERE usuario_id = ?', [userId]
        );
        return Number(rows[0]?.total) || 0;
    }

    async countUnread(userId) {
        const [rows] = await db.query(
            'SELECT COUNT(*) AS total FROM notifications WHERE usuario_id = ? AND read_at IS NULL',
            [userId]
        );
        return Number(rows[0]?.total) || 0;
    }

    async markRead(id, userId) {
        const [result] = await db.query(
            `UPDATE notifications
             SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
             WHERE id = ? AND usuario_id = ?`,
            [id, userId]
        );
        return result.affectedRows > 0;
    }

    async markAllRead(userId) {
        const [result] = await db.query(
            `UPDATE notifications
             SET read_at = CURRENT_TIMESTAMP
             WHERE usuario_id = ? AND read_at IS NULL`,
            [userId]
        );
        return result.affectedRows || 0;
    }

    async countReadBefore(cutoff) {
        const [rows] = await db.query(
            'SELECT COUNT(*) AS total FROM notifications WHERE read_at IS NOT NULL AND read_at < ?',
            [new Date(cutoff)]
        );
        return Number(rows[0]?.total) || 0;
    }

    async deleteReadBefore(cutoff, limit = 500) {
        const [result] = await db.query(
            `DELETE FROM notifications
              WHERE read_at IS NOT NULL AND read_at < ?
              ORDER BY id
              LIMIT ?`,
            [new Date(cutoff), Math.max(1, Math.min(Number(limit) || 500, 5000))]
        );
        return result.affectedRows || 0;
    }
}

module.exports = MariaDBNotificationRepository;
