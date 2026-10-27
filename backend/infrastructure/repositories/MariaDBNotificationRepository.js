/**
* Project     : Bibliotech  |  Capa: Infraestructura - Adaptador de Salida
* Implementacion MariaDB de la bandeja de notificaciones.
*/

const db = require('../../config/db');
const NotificationRepositoryInterface = require('../../domain/ports/NotificationRepositoryInterface');

class MariaDBNotificationRepository extends NotificationRepositoryInterface {
    async createForSubscribers(subjectId, materialId, alumnoIds) {
        const ids = [...new Set((alumnoIds || []).map(Number).filter(Boolean))];
        if (!ids.length) return 0;

        const values = ids.map(() => '(?, ?, ?)').join(', ');
        const params = [];
        ids.forEach(alumnoId => params.push(alumnoId, subjectId, materialId));

        const [result] = await db.query(
            `INSERT INTO notifications (usuario_id, subject_id, material_id)
             VALUES ${values}
             ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP, read_at = NULL`,
            params
        );
        return result.affectedRows;
    }

    async findByUser(userId) {
        const [rows] = await db.query(
            `SELECT n.id, n.subject_id AS subjectId, s.nombre AS subjectNombre,
                    n.material_id AS materialId, m.titulo AS materialTitulo,
                    n.created_at AS createdAt, n.read_at AS readAt,
                    CONCAT(p.nombre, ' ', p.apellido) AS profesorNombre
             FROM notifications n
             INNER JOIN subjects s ON s.id = n.subject_id
             INNER JOIN materials m ON m.id = n.material_id
             LEFT JOIN users p ON p.id = s.profesor_id
             WHERE n.usuario_id = ?
             ORDER BY n.created_at DESC, n.id DESC
             LIMIT 30`,
            [userId]
        );
        return rows;
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
}

module.exports = MariaDBNotificationRepository;
