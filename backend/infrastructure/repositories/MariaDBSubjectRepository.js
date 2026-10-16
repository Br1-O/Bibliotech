/**
* Project     : Bibliotech  |  Capa: Infraestructura - Adaptador de Salida
* Implementacion MariaDB del repositorio de Materias.
*/

const db = require('../../config/db');
const SubjectRepositoryInterface = require('../../domain/ports/SubjectRepositoryInterface');
const Subject = require('../../domain/entities/Subject');

const mapSubject = row => (row ? new Subject({
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    profesorId: row.profesorId !== undefined ? row.profesorId : row.profesor_id,
    estadoAsociacion: row.estadoAsociacion !== undefined ? row.estadoAsociacion : row.estado_asociacion
}) : null);

class MariaDBSubjectRepository extends SubjectRepositoryInterface {
    async save(subject) {
        if (subject.id) {
            await db.execute(
                `UPDATE subjects SET nombre = ?, descripcion = ?, profesor_id = ?, estado_asociacion = ? WHERE id = ?`,
                [subject.nombre, subject.descripcion, subject.profesorId, subject.estadoAsociacion, subject.id]
            );
            return subject;
        }
        const [res] = await db.execute(
            `INSERT INTO subjects (nombre, descripcion, profesor_id, estado_asociacion) VALUES (?, ?, ?, ?)`,
            [subject.nombre, subject.descripcion, subject.profesorId, subject.estadoAsociacion]
        );
        subject.id = res.insertId;
        return subject;
    }

    async findById(id) {
        const [rows] = await db.execute(`
            SELECT s.*, u.nombre AS profesorNombre, u.apellido AS profesorApellido
            FROM subjects s LEFT JOIN users u ON u.id = s.profesor_id WHERE s.id = ?`, [id]);
        return mapSubject(rows[0]);
    }

    async findAll() {
        const [rows] = await db.execute(`
            SELECT s.*, u.nombre AS profesorNombre, u.apellido AS profesorApellido,
                   (SELECT COUNT(*) FROM material_subjects ms WHERE ms.subject_id = s.id) AS totalMateriales
            FROM subjects s LEFT JOIN users u ON u.id = s.profesor_id
            ORDER BY s.nombre`);
        return rows.map(r => ({
            ...mapSubject(r),
            profesorNombre: r.profesorNombre ? `${r.profesorNombre} ${r.profesorApellido || ''}`.trim() : null,
            totalMateriales: Number(r.totalMateriales) || 0
        }));
    }

    async requestAssociation(subjectId, profesorId) {
        const [res] = await db.execute(
            `UPDATE subjects SET profesor_id = ?, estado_asociacion = 'Pendiente' WHERE id = ?`,
            [profesorId, subjectId]
        );
        return res.affectedRows > 0;
    }

    async confirmAssociation(subjectId, profesorId) {
        const [res] = await db.execute(
            `UPDATE subjects SET profesor_id = COALESCE(?, profesor_id), estado_asociacion = 'Activa' WHERE id = ?`,
            [profesorId ?? null, subjectId]
        );
        return res.affectedRows > 0;
    }

    async rejectAssociation(subjectId) {
        const [res] = await db.execute(
            `UPDATE subjects SET profesor_id = NULL, estado_asociacion = 'Pendiente' WHERE id = ? AND estado_asociacion = 'Pendiente'`,
            [subjectId]
        );
        return res.affectedRows > 0;
    }

    async delete(id) {
        const [res] = await db.execute('DELETE FROM subjects WHERE id = ?', [id]);
        return res.affectedRows > 0;
    }
    async update(id, updates = {}) {
        const fields = [];
        const params = [];
        if (updates.nombre !== undefined) { fields.push('nombre = ?'); params.push(updates.nombre); }
        if (updates.descripcion !== undefined) { fields.push('descripcion = ?'); params.push(updates.descripcion); }
        if (updates.profesorId !== undefined) { fields.push('profesor_id = ?'); params.push(updates.profesorId); }
        if (updates.estadoAsociacion !== undefined) { fields.push('estado_asociacion = ?'); params.push(updates.estadoAsociacion); }
        if (!fields.length) return false;
        params.push(id);
        const [res] = await db.execute(`UPDATE subjects SET ${fields.join(', ')} WHERE id = ?`, params);
        return res.affectedRows > 0;
    }

}

module.exports = MariaDBSubjectRepository;
