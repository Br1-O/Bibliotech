/**
* Project     : Bibliotech  |  Capa: Infraestructura - Adaptador de Salida
* Implementacion MariaDB del repositorio de Suscripciones (patron Observer).
*/

const db = require('../../config/db');
const SubscriptionRepositoryInterface = require('../../domain/ports/SubscriptionRepositoryInterface');
const Subscription = require('../../domain/entities/Subscription');

const map = row => (row ? new Subscription(row) : null);

class MariaDBSubscriptionRepository extends SubscriptionRepositoryInterface {
    async save(subscription) {
        const [res] = await db.execute(
            `INSERT INTO subscriptions (alumno_id, materia_id, estado) VALUES (?, ?, ?)`,
            [subscription.alumnoId, subscription.materiaId, subscription.estado]
        );
        subscription.id = res.insertId;
        return subscription;
    }

    async findById(id) {
        const [rows] = await db.execute('SELECT * FROM subscriptions WHERE id = ?', [id]);
        return map(rows[0]);
    }

    async findByAlumnoAndMateria(alumnoId, materiaId) {
        const [rows] = await db.execute(
            'SELECT * FROM subscriptions WHERE alumno_id = ? AND materia_id = ?',
            [alumnoId, materiaId]
        );
        return map(rows[0]);
    }

    async subscribe(alumnoId, materiaId) {
        await db.execute(
            `INSERT INTO subscriptions (alumno_id, materia_id, estado) VALUES (?, ?, 'Suscrito')
             ON DUPLICATE KEY UPDATE estado = 'Suscrito'`,
            [alumnoId, materiaId]
        );
        return this.findByAlumnoAndMateria(alumnoId, materiaId);
    }

    async banStudent(alumnoId, materiaId) {
        const [res] = await db.execute(
            `UPDATE subscriptions SET estado = 'Baneado' WHERE alumno_id = ? AND materia_id = ?`,
            [alumnoId, materiaId]
        );
        return res.affectedRows > 0;
    }

    // Observadores activos (no baneados) de una materia.
    async getObservers(materiaId) {
        const [rows] = await db.execute(
            `SELECT s.id, s.alumno_id AS alumnoId, s.materia_id AS materiaId, s.estado,
                    u.email, u.nombre, u.apellido
             FROM subscriptions s INNER JOIN users u ON u.id = s.alumno_id
             WHERE s.materia_id = ? AND s.estado = 'Suscrito'`,
            [materiaId]
        );
        return rows;
    }

    async findByAlumno(alumnoId) {
        const [rows] = await db.execute(
            `SELECT s.*, s.materia_id AS materiaId, s.alumno_id AS alumnoId,
                    sub.nombre AS materiaNombre, sub.descripcion AS materiaDescripcion,
                    sub.profesor_id AS profesorId
             FROM subscriptions s INNER JOIN subjects sub ON sub.id = s.materia_id
             WHERE s.alumno_id = ? ORDER BY s.created_at DESC`,
            [alumnoId]
        );
        return rows;
    }

    async delete(id) {
        const [res] = await db.execute('DELETE FROM subscriptions WHERE id = ?', [id]);
        return res.affectedRows > 0;
    }
}

module.exports = MariaDBSubscriptionRepository;
