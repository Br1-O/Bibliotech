/**
* Project     : Bibliotech  |  Capa: Infraestructura - Adaptador de Salida
* Implementacion MariaDB del repositorio de Auditoria (RD-06).
*/

const db = require('../../config/db');
const AuditLogRepositoryInterface = require('../../domain/ports/AuditLogRepositoryInterface');
const AuditLog = require('../../domain/entities/AuditLog');

const map = row => {
    const log = new AuditLog({
        id: row.id,
        tipoOperacion: row.tipo_operacion,
        usuarioId: row.usuario_id,
        registroId: row.registro_id,
        timestamp: row.timestamp
    });
    log.usuarioEmail = row.usuarioEmail || null;
    log.usuarioNombre = row.usuarioNombre || null;
    log.registroTipo = row.registroTipo || AuditLog.tipoRegistro(row.tipo_operacion);
    log.registroNombre = row.registroNombre || null;
    return log;
};

const operationsFor = (tipo) => Object.entries(AuditLog.REGISTRO_TIPOS)
    .filter(([, value]) => value === tipo)
    .map(([key]) => key);

const sqlList = (values) => values.map(value => `'${String(value).replace(/'/g, "''")}'`).join(', ');

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
        const usuarioOps = sqlList(operationsFor('Usuario'));
        const materialOps = sqlList(operationsFor('Material'));
        const materiaOps = sqlList(operationsFor('Materia'));
        const rolOps = sqlList(operationsFor('Rol'));
        const carreraOps = sqlList(operationsFor('Carrera'));
        const anioOps = sqlList(operationsFor('Anio'));

        const [rows] = await db.execute(`
            SELECT l.*, u.email AS usuarioEmail,
                   CONCAT(u.nombre, ' ', u.apellido) AS usuarioNombre,
                   CASE
                       WHEN l.tipo_operacion IN (${usuarioOps}) THEN 'Usuario'
                       WHEN l.tipo_operacion IN (${materialOps}) THEN 'Material'
                       WHEN l.tipo_operacion IN (${materiaOps}) THEN 'Materia'
                       WHEN l.tipo_operacion IN (${rolOps}) THEN 'Rol'
                       WHEN l.tipo_operacion IN (${carreraOps}) THEN 'Carrera'
                       WHEN l.tipo_operacion IN (${anioOps}) THEN 'Anio'
                       ELSE NULL
                   END AS registroTipo,
                   CASE
                       WHEN l.tipo_operacion IN (${usuarioOps})
                           THEN CONCAT(u2.nombre, ' ', u2.apellido)
                       WHEN l.tipo_operacion IN (${materialOps}) THEN m.titulo
                       WHEN l.tipo_operacion IN (${materiaOps}) THEN s.nombre
                       WHEN l.tipo_operacion IN (${rolOps}) THEN r.nombre
                       WHEN l.tipo_operacion IN (${carreraOps}) THEN c.nombre
                       WHEN l.tipo_operacion IN (${anioOps}) THEN cy.nombre
                       ELSE NULL
                   END AS registroNombre
            FROM audit_logs l
            LEFT JOIN users u ON u.id = l.usuario_id
            LEFT JOIN users u2 ON u2.id = l.registro_id
            LEFT JOIN materials m ON m.id = l.registro_id
            LEFT JOIN subjects s ON s.id = l.registro_id
            LEFT JOIN roles r ON r.id = l.registro_id
            LEFT JOIN careers c ON c.id = l.registro_id
            LEFT JOIN career_years cy ON cy.id = l.registro_id
            ORDER BY l.timestamp DESC, l.id DESC`);
        return rows.map(map);
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
