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

class MariaDBAuditLogRepository extends AuditLogRepositoryInterface {
    async save(log) {
        const registroTipo = log.registroTipo || AuditLog.tipoRegistro(log.tipoOperacion);
        const idempotencyKey = log.idempotencyKey || null;
        const [res] = await db.execute(
            `INSERT ${idempotencyKey ? 'IGNORE ' : ''}INTO audit_logs
                (tipo_operacion, usuario_id, registro_id, registro_tipo, idempotency_key)
             VALUES (?, ?, ?, ?, ?)`,
            [log.tipoOperacion, log.usuarioId, log.registroId, registroTipo, idempotencyKey]
        );
        log.id = res.insertId;
        log.registroTipo = registroTipo;
        if (idempotencyKey && !log.id) {
            const [rows] = await db.execute(
                'SELECT id FROM audit_logs WHERE idempotency_key = ? LIMIT 1',
                [idempotencyKey]
            );
            if (!rows.length) throw new Error('Audit insert was ignored without a matching idempotency key');
            log.id = rows[0].id;
        }
        return log;
    }

    async saveMany(logs = []) {
        if (!logs.length) return logs;
        const keys = logs.map(log => log.idempotencyKey || null);
        const idempotent = keys.every(Boolean);
        const placeholders = logs.map(() => '(?, ?, ?, ?, ?)').join(', ');
        const params = logs.flatMap((log, index) => [
            log.tipoOperacion,
            log.usuarioId,
            log.registroId,
            log.registroTipo || AuditLog.tipoRegistro(log.tipoOperacion),
            keys[index]
        ]);
        const [result] = await db.execute(
            `INSERT ${idempotent ? 'IGNORE ' : ''}INTO audit_logs
                (tipo_operacion, usuario_id, registro_id, registro_tipo, idempotency_key)
             VALUES ${placeholders}`,
            params
        );
        if (idempotent && Number(result.affectedRows) < logs.length) {
            const uniqueKeys = [...new Set(keys)];
            const keyPlaceholders = uniqueKeys.map(() => '?').join(',');
            const [rows] = await db.execute(
                `SELECT idempotency_key FROM audit_logs WHERE idempotency_key IN (${keyPlaceholders})`,
                uniqueKeys
            );
            const existing = new Set(rows.map(row => row.idempotency_key));
            const missing = uniqueKeys.filter(key => !existing.has(key));
            if (missing.length) throw new Error(`Audit batch ignored without matching idempotency keys: ${missing.length}`);
        }
        return logs;
    }

    /** Carga nombres de los objetivos de una pagina sin seis joins por fila. */
    async attachRegistroNombres(logs) {
        const groups = { Usuario: new Set(), Material: new Set(), Materia: new Set(), Rol: new Set(), Carrera: new Set(), Anio: new Set() };
        logs.forEach(log => {
            if (log.registroTipo && groups[log.registroTipo] && log.registroId) {
                groups[log.registroTipo].add(Number(log.registroId));
            }
        });
        const load = async (ids, sql) => {
            if (!ids.length) return new Map();
            const placeholders = ids.map(() => '?').join(',');
            const [rows] = await db.execute(sql.replace('__IDS__', placeholders), ids);
            return new Map(rows.map(row => [Number(row.id), row.nombre]));
        };
        const [usuarios, materiales, materias, roles, carreras, anios] = await Promise.all([
            load([...groups.Usuario], `SELECT id, CONCAT(nombre, ' ', apellido) AS nombre FROM users WHERE id IN (__IDS__)`),
            load([...groups.Material], `SELECT id, titulo AS nombre FROM materials WHERE id IN (__IDS__)`),
            load([...groups.Materia], `SELECT id, nombre FROM subjects WHERE id IN (__IDS__)`),
            load([...groups.Rol], `SELECT id, nombre FROM roles WHERE id IN (__IDS__)`),
            load([...groups.Carrera], `SELECT id, nombre FROM careers WHERE id IN (__IDS__)`),
            load([...groups.Anio], `SELECT id, nombre FROM career_years WHERE id IN (__IDS__)`)
        ]);
        const names = { Usuario: usuarios, Material: materiales, Materia: materias, Rol: roles, Carrera: carreras, Anio: anios };
        logs.forEach(log => {
            const mapForType = names[log.registroTipo];
            log.registroNombre = mapForType ? (mapForType.get(Number(log.registroId)) || null) : null;
        });
        return logs;
    }

    async findAll(filters = {}) {
        const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
        const offset = Math.max(Number(filters.offset) || 0, 0);
        const [rows] = await db.execute(`
            SELECT l.*, u.email AS usuarioEmail,
                   CONCAT(u.nombre, ' ', u.apellido) AS usuarioNombre
              FROM audit_logs l
              LEFT JOIN users u ON u.id = l.usuario_id
             ORDER BY l.timestamp DESC, l.id DESC
             LIMIT ? OFFSET ?`, [limit, offset]);
        const [countRows] = await db.execute('SELECT COUNT(*) AS total FROM audit_logs');
        return {
            items: await this.attachRegistroNombres(rows.map(map)),
            total: Number(countRows[0].total) || 0
        };
    }

    async findByUser(userId, filters = {}) {
        const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
        const offset = Math.max(Number(filters.offset) || 0, 0);
        const [rows] = await db.execute(
            `SELECT * FROM audit_logs WHERE usuario_id = ?
              ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );
        const [countRows] = await db.execute(
            'SELECT COUNT(*) AS total FROM audit_logs WHERE usuario_id = ?', [userId]
        );
        return {
            items: await this.attachRegistroNombres(rows.map(map)),
            total: Number(countRows[0].total) || 0
        };
    }
}

module.exports = MariaDBAuditLogRepository;
