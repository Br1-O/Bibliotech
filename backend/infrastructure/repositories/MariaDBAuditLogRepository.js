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
            SELECT l.*, u.email AS usuarioEmail
            FROM audit_logs l LEFT JOIN users u ON u.id = l.usuario_id
            ORDER BY l.timestamp DESC, l.id DESC LIMIT 500`);
        return rows.map(r => ({ ...map(r), usuarioEmail: r.usuarioEmail }));
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
