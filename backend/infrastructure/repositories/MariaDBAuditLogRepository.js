/**
* Project     : Bibliotech  |  Capa: Infraestructura - Adaptador de Salida
* Implementacion MariaDB del repositorio de Auditoria (RD-06).
*/

const db = require('../../config/db');
const AuditLogRepositoryInterface = require('../../domain/ports/AuditLogRepositoryInterface');
const AuditLog = require('../../domain/entities/AuditLog');

const map = row => new AuditLog({
    id: row.id,
    tipoOperacion: row.tipo_operacion,
    usuarioId: row.usuario_id,
    registroId: row.registro_id,
    timestamp: row.timestamp
});

class MariaDBAuditLogRepository extends AuditLogRepositoryInterface {
    async save(log) {
        const [res] = await db.execute(
            `INSERT INTO audit_logs (tipo_operacion, usuario_id, registro_id) VALUES (?, ?, ?)`,
            [log.tipoOperacion, log.usuarioId, log.registroId]
        );
        log.id = res.insertId;
        return log;
    }

    async findAll() {
        const [rows] = await db.execute(`
            SELECT l.*, u.email AS usuarioEmail, 
                   CONCAT(u.nombre, ' ', u.apellido) AS usuarioNombre,
                   COALESCE(m.titulo, s.nombre, u2.nombre, CONCAT(u2.nombre, ' ', u2.apellido)) AS registroNombre
            FROM audit_logs l 
            LEFT JOIN users u ON u.id = l.usuario_id
            LEFT JOIN materials m ON m.id = l.registro_id
            LEFT JOIN subjects s ON s.id = l.registro_id
            LEFT JOIN users u2 ON u2.id = l.registro_id
            ORDER BY l.timestamp DESC, l.id DESC LIMIT 500`);
        return rows.map(r => ({ ...map(r), usuarioEmail: r.usuarioEmail, usuarioNombre: r.usuarioNombre, registroNombre: r.registroNombre }));
    }

    async findByUser(userId) {
        const [rows] = await db.execute(
            `SELECT * FROM audit_logs WHERE usuario_id = ? ORDER BY timestamp DESC, id DESC`,
            [userId]
        );
        return rows.map(map);
    }
}

module.exports = MariaDBAuditLogRepository;
