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
    careerYearId: row.careerYearId !== undefined ? row.careerYearId : row.career_year_id,
    estadoAsociacion: row.estadoAsociacion !== undefined ? row.estadoAsociacion : row.estado_asociacion,
    anioId: row.anioId,
    anioNombre: row.anioNombre,
    carreraId: row.carreraId,
    carreraNombre: row.carreraNombre,
    carreraColor: row.carreraColor
}) : null);

const SUBJECT_SELECT = `
    SELECT s.*, u.nombre AS profesorNombre, u.apellido AS profesorApellido,
           cy.id AS anioId, cy.nombre AS anioNombre, cy.orden AS anioOrden,
           c.id AS carreraId, c.nombre AS carreraNombre, c.color AS carreraColor,
           (SELECT COUNT(*) FROM material_subjects ms
             WHERE ms.subject_id = s.id AND ms.estado_aprobacion = 'Aprobado') AS totalMateriales
    FROM subjects s
    LEFT JOIN users u ON u.id = s.profesor_id
    LEFT JOIN career_years cy ON cy.id = s.career_year_id
    LEFT JOIN careers c ON c.id = cy.career_id
`;

const fullName = professor => `${professor.nombre || ''} ${professor.apellido || ''}`.trim();

class MariaDBSubjectRepository extends SubjectRepositoryInterface {
    async save(subject) {
        if (subject.id) {
            await db.execute(
                `UPDATE subjects SET nombre = ?, descripcion = ?, profesor_id = ?, career_year_id = ?, estado_asociacion = ? WHERE id = ?`,
                [subject.nombre, subject.descripcion, subject.profesorId, subject.careerYearId, subject.estadoAsociacion, subject.id]
            );
            return subject;
        }
        const [res] = await db.execute(
            `INSERT INTO subjects (nombre, descripcion, profesor_id, career_year_id, estado_asociacion) VALUES (?, ?, ?, ?, ?)`,
            [subject.nombre, subject.descripcion, subject.profesorId, subject.careerYearId, subject.estadoAsociacion]
        );
        subject.id = res.insertId;
        return subject;
    }

    /** Adjunta la lista completa de profesores de cada materia. */
    async attachProfessors(subjects) {
        const list = (subjects || []).filter(Boolean);
        if (!list.length) return list;
        const ids = list.map(subject => Number(subject.id)).filter(Boolean);
        if (!ids.length) return list;
        const placeholders = ids.map(() => '?').join(',');
        const [rows] = await db.execute(`
            SELECT sp.subject_id AS subjectId, u.id, u.nombre, u.apellido
              FROM subject_professors sp
              INNER JOIN users u ON u.id = sp.profesor_id
             WHERE sp.subject_id IN (${placeholders})
             ORDER BY sp.created_at, u.id`, ids);

        const bySubject = new Map();
        rows.forEach(row => {
            const key = Number(row.subjectId);
            if (!bySubject.has(key)) bySubject.set(key, []);
            bySubject.get(key).push({
                id: Number(row.id),
                nombre: row.nombre,
                apellido: row.apellido,
                nombreCompleto: fullName(row)
            });
        });

        list.forEach(subject => {
            const profesores = bySubject.get(Number(subject.id)) || [];
            subject.profesores = profesores;
            if (!subject.profesorId && profesores.length) {
                subject.profesorId = profesores[0].id;
            }
            const primary = profesores.find(professor => Number(professor.id) === Number(subject.profesorId));
            if (primary) subject.profesorNombre = primary.nombreCompleto;
        });
        return list;
    }

    /** Sincroniza subjects.profesor_id con el primer profesor asignado. */
    async syncPrimaryProfessor(subjectId) {
        const [rows] = await db.execute(
            `SELECT profesor_id AS profesorId FROM subject_professors
              WHERE subject_id = ? ORDER BY created_at, profesor_id LIMIT 1`,
            [subjectId]
        );
        const profesorId = rows[0] ? rows[0].profesorId : null;
        await db.execute('UPDATE subjects SET profesor_id = ? WHERE id = ?', [profesorId, subjectId]);
        return profesorId;
    }

    async addProfessor(subjectId, profesorId) {
        await db.execute(
            `INSERT INTO subject_professors (subject_id, profesor_id)
             VALUES (?, ?) ON DUPLICATE KEY UPDATE profesor_id = VALUES(profesor_id)`,
            [subjectId, profesorId]
        );
        return this.syncPrimaryProfessor(subjectId);
    }

    async removeProfessor(subjectId, profesorId) {
        const [res] = await db.execute(
            'DELETE FROM subject_professors WHERE subject_id = ? AND profesor_id = ?',
            [subjectId, profesorId]
        );
        await this.syncPrimaryProfessor(subjectId);
        return res.affectedRows > 0;
    }

    async replaceProfessors(subjectId, profesorIds = []) {
        const ids = [...new Set((profesorIds || []).map(Number).filter(Boolean))];
        await db.execute('DELETE FROM subject_professors WHERE subject_id = ?', [subjectId]);
        for (const profesorId of ids) {
            await db.execute(
                'INSERT INTO subject_professors (subject_id, profesor_id) VALUES (?, ?)',
                [subjectId, profesorId]
            );
        }
        await this.syncPrimaryProfessor(subjectId);
        return ids;
    }

    async findById(id) {
        const [rows] = await db.execute(`${SUBJECT_SELECT} WHERE s.id = ?`, [id]);
        const subject = mapSubject(rows[0]);
        if (!subject) return null;
        await this.attachProfessors([subject]);
        return subject;
    }

    async findAll(filters = {}) {
        const clauses = [];
        const params = [];
        if (filters.careerId) { clauses.push('c.id = ?'); params.push(filters.careerId); }
        if (filters.yearId) { clauses.push('cy.id = ?'); params.push(filters.yearId); }
        if (filters.profesorId) {
            clauses.push('EXISTS (SELECT 1 FROM subject_professors spf WHERE spf.subject_id = s.id AND spf.profesor_id = ?)');
            params.push(filters.profesorId);
        }
        if (filters.q) {
            clauses.push(`(s.nombre LIKE ? OR s.descripcion LIKE ? OR EXISTS (
                SELECT 1 FROM subject_professors spq
                INNER JOIN users uq ON uq.id = spq.profesor_id
                WHERE spq.subject_id = s.id AND (uq.nombre LIKE ? OR uq.apellido LIKE ?)
            ))`);
            const like = `%${filters.q}%`;
            params.push(like, like, like, like);
        }
        const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
        const [rows] = await db.execute(`${SUBJECT_SELECT}${where} ORDER BY c.nombre, cy.orden, s.nombre`, params);
        const subjects = rows.map(r => {
            const subject = mapSubject(r);
            subject.profesorNombre = r.profesorNombre ? `${r.profesorNombre} ${r.profesorApellido || ''}`.trim() : null;
            subject.totalMateriales = Number(r.totalMateriales) || 0;
            return subject;
        });
        await this.attachProfessors(subjects);
        return subjects;
    }

    async requestAssociation(subjectId, profesorId) {
        await this.addProfessor(subjectId, profesorId);
        const [res] = await db.execute(
            `UPDATE subjects SET profesor_id = ?, estado_asociacion = 'Pendiente' WHERE id = ?`,
            [profesorId, subjectId]
        );
        return res.affectedRows > 0;
    }

    async confirmAssociation(subjectId, profesorId) {
        if (profesorId) await this.addProfessor(subjectId, profesorId);
        const [res] = await db.execute(
            `UPDATE subjects SET estado_asociacion = 'Activa' WHERE id = ?`,
            [subjectId]
        );
        await this.syncPrimaryProfessor(subjectId);
        return res.affectedRows > 0;
    }

    async rejectAssociation(subjectId) {
        await db.execute('DELETE FROM subject_professors WHERE subject_id = ?', [subjectId]);
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
        if (updates.careerYearId !== undefined) { fields.push('career_year_id = ?'); params.push(updates.careerYearId); }
        if (updates.estadoAsociacion !== undefined) { fields.push('estado_asociacion = ?'); params.push(updates.estadoAsociacion); }
        if (!fields.length) return false;
        params.push(id);
        const [res] = await db.execute(`UPDATE subjects SET ${fields.join(', ')} WHERE id = ?`, params);
        return res.affectedRows > 0;
    }

}

module.exports = MariaDBSubjectRepository;
