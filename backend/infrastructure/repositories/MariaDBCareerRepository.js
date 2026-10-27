/**
* Project     : Bibliotech  |  Capa: Infraestructura - Adaptador de Salida
* Implementacion MariaDB del repositorio de carreras y anios academicos.
*/

const db = require('../../config/db');
const CareerRepositoryInterface = require('../../domain/ports/CareerRepositoryInterface');
const Career = require('../../domain/entities/Career');
const CareerYear = require('../../domain/entities/CareerYear');

const mapYear = row => (row ? new CareerYear({
    id: row.id,
    careerId: row.careerId !== undefined ? row.careerId : row.career_id,
    nombre: row.nombre,
    orden: row.orden,
    totalMaterias: row.totalMaterias,
    totalMateriales: row.totalMateriales,
    createdAt: row.createdAt !== undefined ? row.createdAt : row.created_at
}) : null);

const mapCareer = row => (row ? new Career({
    id: row.id,
    nombre: row.nombre,
    color: row.color,
    totalMaterias: row.totalMaterias,
    totalMateriales: row.totalMateriales,
    createdAt: row.createdAt !== undefined ? row.createdAt : row.created_at
}) : null);

const CAREER_SELECT = `
    SELECT c.id, c.nombre, c.color, c.created_at AS createdAt,
           (SELECT COUNT(*) FROM subjects s
              JOIN career_years cy ON cy.id = s.career_year_id
             WHERE cy.career_id = c.id) AS totalMaterias,
           (SELECT COUNT(DISTINCT ms.material_id)
              FROM material_subjects ms
              JOIN subjects s ON s.id = ms.subject_id
              JOIN career_years cy ON cy.id = s.career_year_id
             WHERE cy.career_id = c.id AND ms.estado_aprobacion = 'Aprobado') AS totalMateriales
    FROM careers c
`;

const YEAR_SELECT = `
    SELECT cy.id, cy.career_id AS careerId, cy.nombre, cy.orden, cy.created_at AS createdAt,
           (SELECT COUNT(*) FROM subjects s WHERE s.career_year_id = cy.id) AS totalMaterias,
           (SELECT COUNT(DISTINCT ms.material_id)
              FROM material_subjects ms
              JOIN subjects s ON s.id = ms.subject_id
             WHERE s.career_year_id = cy.id AND ms.estado_aprobacion = 'Aprobado') AS totalMateriales
    FROM career_years cy
`;

class MariaDBCareerRepository extends CareerRepositoryInterface {
    async save(career) {
        const [res] = await db.execute(
            'INSERT INTO careers (nombre, color) VALUES (?, ?)',
            [career.nombre, career.color]
        );
        career.id = res.insertId;
        return career;
    }

    async update(id, changes = {}) {
        const fields = [];
        const params = [];
        if (changes.nombre !== undefined) { fields.push('nombre = ?'); params.push(changes.nombre); }
        if (changes.color !== undefined) { fields.push('color = ?'); params.push(changes.color); }
        if (!fields.length) return false;
        params.push(id);
        const [res] = await db.execute(`UPDATE careers SET ${fields.join(', ')} WHERE id = ?`, params);
        return res.affectedRows > 0;
    }

    async findById(id) {
        const [rows] = await db.execute(`${CAREER_SELECT} WHERE c.id = ?`, [id]);
        const career = mapCareer(rows[0]);
        if (career) career.years = await this.findYearsByCareer(id);
        return career;
    }

    async findAll() {
        const [careersRows] = await db.execute(`${CAREER_SELECT} ORDER BY c.nombre`);
        const [yearsRows] = await db.execute(`${YEAR_SELECT} ORDER BY cy.orden, cy.nombre`);
        const yearsByCareer = new Map();
        yearsRows.map(mapYear).forEach(year => {
            if (!yearsByCareer.has(year.careerId)) yearsByCareer.set(year.careerId, []);
            yearsByCareer.get(year.careerId).push(year);
        });
        return careersRows.map(row => {
            const career = mapCareer(row);
            career.years = yearsByCareer.get(career.id) || [];
            return career;
        });
    }

    async saveYear(year) {
        const [res] = await db.execute(
            'INSERT INTO career_years (career_id, nombre, orden) VALUES (?, ?, ?)',
            [year.careerId, year.nombre, year.orden]
        );
        year.id = res.insertId;
        return year;
    }

    async updateYear(id, changes = {}) {
        const fields = [];
        const params = [];
        if (changes.nombre !== undefined) { fields.push('nombre = ?'); params.push(changes.nombre); }
        if (changes.orden !== undefined) { fields.push('orden = ?'); params.push(changes.orden); }
        if (!fields.length) return false;
        params.push(id);
        const [res] = await db.execute(`UPDATE career_years SET ${fields.join(', ')} WHERE id = ?`, params);
        return res.affectedRows > 0;
    }

    async findYearById(id) {
        const [rows] = await db.execute(`${YEAR_SELECT} WHERE cy.id = ?`, [id]);
        return mapYear(rows[0]);
    }

    async findYearsByCareer(careerId) {
        const [rows] = await db.execute(
            `${YEAR_SELECT} WHERE cy.career_id = ? ORDER BY cy.orden, cy.nombre`,
            [careerId]
        );
        return rows.map(mapYear);
    }
}

module.exports = MariaDBCareerRepository;
