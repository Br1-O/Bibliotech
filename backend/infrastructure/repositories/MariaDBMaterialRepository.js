/**
* Project     : Bibliotech  |  Capa: Infraestructura - Adaptador de Salida
* Implementacion MariaDB del repositorio de Material educativo.
* Incluye busqueda transversal, filtrado por materias y por etiquetas (RF-04.1).
*/

const db = require('../../config/db');
const MaterialRepositoryInterface = require('../../domain/ports/MaterialRepositoryInterface');
const Material = require('../../domain/entities/Material');

const SELECT_MATERIAL = `
    SELECT m.id, m.autor_id AS autorId, CONCAT(u.nombre, ' ', u.apellido) AS autorNombre,
           r.nombre AS autorRol, m.titulo, m.tipo, m.url_or_path AS urlOrPath,
           m.portada, m.file_hash AS fileHash,
           m.descripcion, m.categories, m.estado, m.es_favorito AS esFavorito, m.contador_favoritos AS contadorFavoritos, m.created_at AS createdAt,
           (SELECT GROUP_CONCAT(s.nombre SEPARATOR ',')
              FROM material_subjects ms JOIN subjects s ON s.id = ms.subject_id
             WHERE ms.material_id = m.id AND ms.estado_aprobacion = 'Aprobado') AS materias,
           (SELECT GROUP_CONCAT(ms.subject_id SEPARATOR ',')
              FROM material_subjects ms
             WHERE ms.material_id = m.id AND ms.estado_aprobacion = 'Aprobado') AS materiasIds,
           (SELECT GROUP_CONCAT(ms.subject_id SEPARATOR ',')
              FROM material_subjects ms
             WHERE ms.material_id = m.id) AS materiasTodosIds
    FROM materials m
    INNER JOIN users u ON u.id = m.autor_id
    INNER JOIN roles r ON r.id = u.role_id
`;

const split = value => (value ? String(value).split(',') : []);

const mapMaterial = row => {
    if (!row) return null;
    const material = new Material({ ...row, categories: split(row.categories) });
    material.materias = split(row.materias);
    material.materiasIds = split(row.materiasIds).map(Number);
    material.materiasTodosIds = split(row.materiasTodosIds).map(Number);
    material.carreras = [];
    return material;
};

class MariaDBMaterialRepository extends MaterialRepositoryInterface {
    async save(material) {
        const categories = Array.isArray(material.categories)
            ? material.categories.join(',')
            : (material.categories || '');
        const [res] = await db.execute(
            `INSERT INTO materials (autor_id, titulo, tipo, url_or_path, portada, file_hash, descripcion, categories, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [material.autorId, material.titulo, material.tipo, material.urlOrPath,
             material.portada || null, material.fileHash, material.descripcion, categories, material.estado]
        );
        material.id = res.insertId;
        if (!material.materias) material.materias = [];
        if (!material.materiasIds) material.materiasIds = [];
        if (!material.materiasTodosIds) material.materiasTodosIds = [];
        if (!material.carreras) material.carreras = [];
        return material;
    }

    async findById(id) {
        const [rows] = await db.execute(`${SELECT_MATERIAL} WHERE m.id = ?`, [id]);
        return mapMaterial(rows[0]);
    }

    async findByHash(hash) {
        const [rows] = await db.execute(`${SELECT_MATERIAL} WHERE m.file_hash = ?`, [hash]);
        return mapMaterial(rows[0]);
    }

    buildFilters(filters = {}, alias = 'm') {
        const clauses = [];
        const params = [];
        if (filters.q) {
            clauses.push(`(${alias}.titulo LIKE ? OR ${alias}.categories LIKE ? OR ${alias}.descripcion LIKE ? OR u.nombre LIKE ? OR u.apellido LIKE ?)`);
            const like = `%${filters.q}%`;
            params.push(like, like, like, like, like);
        }
        if (filters.tipo) {
            clauses.push(`${alias}.tipo = ?`);
            params.push(filters.tipo);
        }
        if (filters.subjects && filters.subjects.length) {
            const placeholders = filters.subjects.map(() => '?').join(',');
            clauses.push(`EXISTS (SELECT 1 FROM material_subjects ms
                          WHERE ms.material_id = ${alias}.id AND ms.estado_aprobacion = 'Aprobado'
                          AND ms.subject_id IN (${placeholders}))`);
            params.push(...filters.subjects);
        }
        if (filters.careers && filters.careers.length) {
            const placeholders = filters.careers.map(() => '?').join(',');
            clauses.push(`EXISTS (SELECT 1 FROM material_subjects ms
                          JOIN subjects sc ON sc.id = ms.subject_id
                          JOIN career_years cyc ON cyc.id = sc.career_year_id
                          WHERE ms.material_id = ${alias}.id AND ms.estado_aprobacion = 'Aprobado'
                          AND cyc.career_id IN (${placeholders}))`);
            params.push(...filters.careers);
        }
        if (filters.years && filters.years.length) {
            const placeholders = filters.years.map(() => '?').join(',');
            clauses.push(`EXISTS (SELECT 1 FROM material_subjects ms
                          JOIN subjects sy ON sy.id = ms.subject_id
                          WHERE ms.material_id = ${alias}.id AND ms.estado_aprobacion = 'Aprobado'
                          AND sy.career_year_id IN (${placeholders}))`);
            params.push(...filters.years);
        }
        if (filters.tags && filters.tags.length) {
            const andTags = filters.tags.map(() => `${alias}.categories LIKE ?`).join(' AND ');
            clauses.push(`(${andTags})`);
            filters.tags.forEach(tag => params.push(`%${tag}%`));
        }
        return { clauses, params };
    }

    /**
     * Adjunta las materias y carreras/anios en los que aparece cada material.
     * Una sola consulta evita perder el color de la carrera de cada materia.
     */
    async attachCareers(materials) {
        if (!materials || !materials.length) return materials;
        const ids = materials.map(material => material.id).filter(Boolean);
        if (!ids.length) return materials;
        const placeholders = ids.map(() => '?').join(',');
        const [rows] = await db.execute(`
            SELECT ms.material_id AS materialId,
                   s.id AS subjectId, s.nombre AS subjectNombre,
                   c.id AS careerId, c.nombre AS careerNombre, c.color AS careerColor,
                   cy.id AS yearId, cy.nombre AS yearNombre
              FROM material_subjects ms
              JOIN subjects s ON s.id = ms.subject_id
              LEFT JOIN career_years cy ON cy.id = s.career_year_id
              LEFT JOIN careers c ON c.id = cy.career_id
             WHERE ms.material_id IN (${placeholders}) AND ms.estado_aprobacion = 'Aprobado'
             ORDER BY c.nombre, cy.orden, s.nombre`, ids);
        const byMaterial = new Map();
        rows.forEach(row => {
            const key = Number(row.materialId);
            if (!byMaterial.has(key)) byMaterial.set(key, { subjects: [], careers: [] });
            const entry = byMaterial.get(key);
            entry.subjects.push({
                id: Number(row.subjectId),
                nombre: row.subjectNombre,
                carreraId: row.careerId ? Number(row.careerId) : null,
                carreraNombre: row.careerNombre || null,
                carreraColor: row.careerColor || null,
                anioId: row.yearId ? Number(row.yearId) : null,
                anioNombre: row.yearNombre || null
            });
            if (row.careerId) {
                const exists = entry.careers.some(item =>
                    item.id === Number(row.careerId) && item.anioId === Number(row.yearId));
                if (!exists) {
                    entry.careers.push({
                        id: Number(row.careerId),
                        nombre: row.careerNombre,
                        color: row.careerColor,
                        anioId: Number(row.yearId),
                        anioNombre: row.yearNombre
                    });
                }
            }
        });
        materials.forEach(material => {
            const entry = byMaterial.get(Number(material.id)) || { subjects: [], careers: [] };
            material.materiasDetalle = entry.subjects;
            material.materias = entry.subjects.map(subject => subject.nombre);
            material.materiasIds = entry.subjects.map(subject => subject.id);
            material.carreras = entry.careers;
        });
        return materials;
    }

    async findAllGlobal(filters = {}) {
        const { clauses, params } = this.buildFilters(filters);
        // El catalogo global muestra todo material aprobado, aunque ya no
        // tenga materias asociadas: sigue disponible para reasociarlo.
        const where = [`m.estado = 'Aprobado'`, ...clauses];
        const [rows] = await db.execute(
            `${SELECT_MATERIAL} WHERE ${where.join(' AND ')} ORDER BY m.created_at DESC`, params
        );
        return this.attachCareers(rows.map(mapMaterial));
    }

    async findBySubject(subjectId, filters = {}) {
        const { clauses, params } = this.buildFilters(filters);
        const where = [
            `m.estado = 'Aprobado'`,
            `EXISTS (SELECT 1 FROM material_subjects msx WHERE msx.material_id = m.id
                     AND msx.subject_id = ? AND msx.estado_aprobacion = 'Aprobado')`,
            ...clauses
        ];
        const [rows] = await db.execute(
            `${SELECT_MATERIAL} WHERE ${where.join(' AND ')} ORDER BY m.created_at DESC`,
            [subjectId, ...params]
        );
        return this.attachCareers(rows.map(mapMaterial));
    }

    async findByAuthor(authorId, filters = {}) {
        const { clauses, params } = this.buildFilters(filters);
        const where = [`m.autor_id = ?`];
        if (filters.estado === 'Aprobado' || filters.estado) where.push('m.estado = ?');
        where.push(...clauses);
        const queryParams = [authorId];
        if (filters.estado) queryParams.push(filters.estado);
        queryParams.push(...params);
        const [rows] = await db.execute(
            `${SELECT_MATERIAL} WHERE ${where.join(' AND ')} ORDER BY m.created_at DESC`,
            queryParams
        );
        return this.attachCareers(rows.map(mapMaterial));
    }

    async findPendingByAuthor(authorId) {
        const [rows] = await db.execute(
            `${SELECT_MATERIAL} WHERE m.autor_id = ? AND m.estado = 'Pendiente' ORDER BY m.created_at DESC`,
            [authorId]
        );
        return rows.map(mapMaterial);
    }

    /** Material sugerido por alumnos pendiente de revision en las materias del profesor. */
    async findPendingForProfessor(profesorId) {
        const [rows] = await db.execute(`
            SELECT m.id, m.autor_id AS autorId, CONCAT(u.nombre, ' ', u.apellido) AS autorNombre,
                   m.titulo, m.tipo, m.url_or_path AS urlOrPath, m.portada, m.file_hash AS fileHash,
                   m.descripcion, m.categories, m.estado, m.es_favorito AS esFavorito, m.contador_favoritos AS contadorFavoritos, m.created_at AS createdAt,
                   ms.subject_id AS subjectId, s.nombre AS subjectNombre
            FROM material_subjects ms
            INNER JOIN materials m ON m.id = ms.material_id
            INNER JOIN subjects s ON s.id = ms.subject_id
            INNER JOIN users u ON u.id = m.autor_id
            WHERE ms.estado_aprobacion = 'Pendiente'
              AND EXISTS (SELECT 1 FROM subject_professors sp
                           WHERE sp.subject_id = s.id AND sp.profesor_id = ?)
            ORDER BY m.created_at DESC`, [profesorId]);

        return rows.map(r => {
            const material = new Material({ ...r, categories: split(r.categories) });
            material.subjectId = r.subjectId;
            material.subjectNombre = r.subjectNombre;
            return material;
        });
    }

    async countPendingByAuthor(authorId) {
        const [rows] = await db.execute(
            `SELECT COUNT(*) AS total FROM materials WHERE autor_id = ? AND estado = 'Pendiente'`,
            [authorId]
        );
        return Number(rows[0].total) || 0;
    }

    async associateToSubject(materialId, subjectId, estado = 'Pendiente') {
        await db.execute(
            `INSERT INTO material_subjects (material_id, subject_id, estado_aprobacion)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE estado_aprobacion = VALUES(estado_aprobacion)`,
            [materialId, subjectId, estado]
        );
        return true;
    }

    async updateAssociationState(materialId, subjectId, estado) {
        const [res] = await db.execute(
            `UPDATE material_subjects SET estado_aprobacion = ? WHERE material_id = ? AND subject_id = ?`,
            [estado, materialId, subjectId]
        );
        return res.affectedRows > 0;
    }

    async updateEstado(materialId, estado) {
        const [res] = await db.execute(
            `UPDATE materials SET estado = ? WHERE id = ?`, [estado, materialId]
        );
        return res.affectedRows > 0;
    }

    async deleteAssociation(materialId, subjectId) {
        const [res] = await db.execute(
            `DELETE FROM material_subjects WHERE material_id = ? AND subject_id = ?`,
            [materialId, subjectId]
        );
        return res.affectedRows > 0;
    }

    async countAssociations(materialId) {
        const [rows] = await db.execute(
            `SELECT COUNT(*) AS total FROM material_subjects WHERE material_id = ?`, [materialId]
        );
        return Number(rows[0].total) || 0;
    }

    async cancelPendingUpload(materialId) {
        const [res] = await db.execute(
            `UPDATE materials
                SET estado = 'Cancelado', url_or_path = NULL, portada = NULL, file_hash = NULL
              WHERE id = ? AND estado = 'Pendiente'`,
            [materialId]
        );
        if (res.affectedRows > 0) {
            await db.execute('DELETE FROM material_subjects WHERE material_id = ?', [materialId]);
        }
        return res.affectedRows > 0;
    }

    async rejectPendingUpload(materialId) {
        const [res] = await db.execute(
            `UPDATE materials
                SET estado = 'Rechazado', url_or_path = NULL, portada = NULL, file_hash = NULL
              WHERE id = ? AND estado = 'Pendiente'`,
            [materialId]
        );
        if (res.affectedRows > 0) {
            await db.execute('DELETE FROM material_subjects WHERE material_id = ?', [materialId]);
        }
        return res.affectedRows > 0;
    }

    /** Actualiza los datos editables del material. */
    async update(materialId, changes = {}) {
        const fields = [];
        const params = [];
        if (changes.titulo !== undefined) { fields.push('titulo = ?'); params.push(changes.titulo); }
        if (changes.descripcion !== undefined) { fields.push('descripcion = ?'); params.push(changes.descripcion); }
        if (changes.portada !== undefined) { fields.push('portada = ?'); params.push(changes.portada); }
        if (changes.tipo !== undefined) { fields.push('tipo = ?'); params.push(changes.tipo); }
        if (changes.urlOrPath !== undefined) { fields.push('url_or_path = ?'); params.push(changes.urlOrPath); }
        if (changes.fileHash !== undefined) { fields.push('file_hash = ?'); params.push(changes.fileHash); }
        if (changes.categories !== undefined) {
            fields.push('categories = ?');
            params.push(Array.isArray(changes.categories) ? changes.categories.join(',') : changes.categories);
        }
        if (!fields.length) return false;
        params.push(materialId);
        const [res] = await db.execute(`UPDATE materials SET ${fields.join(', ')} WHERE id = ?`, params);
        return res.affectedRows > 0;
    }

    async delete(materialId) {
        const [res] = await db.execute('DELETE FROM materials WHERE id = ?', [materialId]);
        return res.affectedRows > 0;
    }
    // Favorites methods
    async toggleFavorite(materialId, userId) {
        const [existing] = await db.execute(
            'SELECT id FROM material_favorites WHERE material_id = ? AND usuario_id = ?',
            [materialId, userId]
        );
        let favorited;
        if (existing.length > 0) {
            await db.execute('DELETE FROM material_favorites WHERE id = ?', [existing[0].id]);
            await db.execute('UPDATE materials SET contador_favoritos = GREATEST(contador_favoritos - 1, 0) WHERE id = ?', [materialId]);
            favorited = false;
        } else {
            await db.execute('INSERT INTO material_favorites (material_id, usuario_id) VALUES (?, ?)', [materialId, userId]);
            await db.execute('UPDATE materials SET contador_favoritos = contador_favoritos + 1 WHERE id = ?', [materialId]);
            favorited = true;
        }
        return { favorited, contadorFavoritos: await this.countFavorites(materialId) };
    }

    async findFavorites(userId, filters = {}) {
        const built = this.buildFilters(filters, 'm');
        const clauses = built.clauses;
        const params = built.params;
        const where = [`mf.usuario_id = ?`, "m.estado = 'Aprobado'", ...clauses];
        let sql = `${SELECT_MATERIAL} INNER JOIN material_favorites mf ON mf.material_id = m.id
                   WHERE ${where.join(' AND ')} ORDER BY mf.created_at DESC`;
        if (filters.limit !== undefined) {
            const limit = Math.max(0, parseInt(filters.limit, 10) || 0);
            const offset = Math.max(0, parseInt(filters.offset, 10) || 0);
            sql += ` LIMIT ${limit} OFFSET ${offset}`;
        }
        const [rows] = await db.execute(sql, [userId, ...params]);
        const materials = rows.map(row => {
            const material = mapMaterial(row);
            if (material) material.esFavorito = 1;
            return material;
        });
        return this.attachCareers(materials);
    }

    async findFavoriteIds(userId) {
        if (!userId) return [];
        const [rows] = await db.execute(
            'SELECT material_id AS id FROM material_favorites WHERE usuario_id = ?', [userId]
        );
        return rows.map(r => Number(r.id));
    }

    async countFavorites(materialId) {
        const [rows] = await db.execute(
            'SELECT COUNT(*) AS total FROM material_favorites WHERE material_id = ?', [materialId]
        );
        return Number(rows[0].total) || 0;
    }
}

module.exports = MariaDBMaterialRepository;
