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
           r.nombre AS autorRol, m.uploaded_by AS uploadedBy,
           COALESCE(CONCAT(ub.nombre, ' ', ub.apellido), CONCAT(u.nombre, ' ', u.apellido)) AS uploaderNombre,
           COALESCE(ur.nombre, r.nombre) AS uploaderRol, m.author,
           m.category_id AS categoryId, cat.slug AS categorySlug, cat.nombre AS categoryNombre,
           m.titulo, m.tipo, m.url_or_path AS urlOrPath,
           m.portada, m.file_hash AS fileHash,
           m.descripcion, m.pages, m.categories, m.estado, m.es_favorito AS esFavorito,
           m.contador_favoritos AS contadorFavoritos, m.created_at AS createdAt
    FROM materials m
    INNER JOIN users u ON u.id = m.autor_id
    INNER JOIN roles r ON r.id = u.role_id
    LEFT JOIN users ub ON ub.id = m.uploaded_by
    LEFT JOIN roles ur ON ur.id = ub.role_id
    LEFT JOIN categories cat ON cat.id = m.category_id
`;

const MATERIAL_FROM = `
    FROM materials m
    INNER JOIN users u ON u.id = m.autor_id
    INNER JOIN roles r ON r.id = u.role_id
    LEFT JOIN users ub ON ub.id = m.uploaded_by
    LEFT JOIN roles ur ON ur.id = ub.role_id
    LEFT JOIN categories cat ON cat.id = m.category_id
`;

const split = value => (value ? String(value).split(',') : []);

const fullTextQuery = value => {
    const tokens = String(value || '')
        .trim()
        .split(/\s+/)
        .map(token => token.replace(/[+\-><()~*"@]/g, ''))
        .filter(token => token.length >= 3);
    return tokens.length ? tokens.map(token => `+${token}*`).join(' ') : null;
};

const mapMaterial = row => {
    if (!row) return null;
    const material = new Material({ ...row, categories: split(row.categories) });
    material.materias = [];
    material.materiasIds = [];
    material.materiasTodosIds = [];
    material.carreras = [];
    return material;
};

class MariaDBMaterialRepository extends MaterialRepositoryInterface {
    buildOrder(filters = {}, alias = 'm') {
        switch (filters.sort) {
            case 'oldest': return `${alias}.created_at ASC, ${alias}.id ASC`;
            case 'title': return `${alias}.titulo ASC, ${alias}.id ASC`;
            default: return `${alias}.created_at DESC, ${alias}.id DESC`;
        }
    }

    paginationClause(filters = {}) {
        const limit = Number.isInteger(Number(filters.limit)) && Number(filters.limit) > 0
            ? Math.min(Number(filters.limit), 100)
            : 20;
        const offset = Math.max(0, Number(filters.offset) || 0);
        return { sql: 'LIMIT ? OFFSET ?', params: [limit, offset] };
    }

    async countWhere(where, params) {
        const [rows] = await db.execute(
            `SELECT COUNT(*) AS total ${MATERIAL_FROM} WHERE ${where.join(' AND ')}`,
            params
        );
        return Number(rows[0].total) || 0;
    }

    /** Carga todas las asociaciones de detalle para una fila puntual. */
    async attachAllAssociations(materials) {
        const list = (materials || []).filter(Boolean);
        if (!list.length) return list;
        const ids = list.map(material => Number(material.id)).filter(Boolean);
        const placeholders = ids.map(() => '?').join(',');
        const [rows] = await db.execute(`
            SELECT ms.material_id AS materialId, ms.subject_id AS subjectId,
                   ms.estado_aprobacion AS estadoAprobacion, s.nombre AS subjectNombre
              FROM material_subjects ms
              INNER JOIN subjects s ON s.id = ms.subject_id
             WHERE ms.material_id IN (${placeholders})`, ids);
        const byMaterial = new Map();
        rows.forEach(row => {
            const key = Number(row.materialId);
            if (!byMaterial.has(key)) byMaterial.set(key, []);
            byMaterial.get(key).push({
                id: Number(row.subjectId),
                nombre: row.subjectNombre,
                estadoAprobacion: row.estadoAprobacion
            });
        });
        list.forEach(material => {
            const associations = byMaterial.get(Number(material.id)) || [];
            material.materiasTodosIds = associations.map(item => item.id);
            material.materiasIds = associations
                .filter(item => item.estadoAprobacion === 'Aprobado')
                .map(item => item.id);
            material.materias = associations
                .filter(item => item.estadoAprobacion === 'Aprobado')
                .map(item => item.nombre);
        });
        return list;
    }

    async findByHashesForUpdate(hashes = []) {
        const unique = [...new Set(hashes.filter(Boolean))];
        if (!unique.length) return new Map();
        const placeholders = unique.map(() => '?').join(',');
        const [rows] = await db.execute(
            `SELECT id, file_hash AS fileHash, pages FROM materials
              WHERE file_hash IN (${placeholders}) FOR UPDATE`,
            unique
        );
        return new Map(rows.map(row => [row.fileHash, row]));
    }

    async saveMany(materials = []) {
        if (!materials.length) return [];
        const placeholders = materials.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const params = [];
        materials.forEach(material => {
            params.push(
                material.autorId, material.uploadedBy || material.autorId, material.author || null,
                material.categoryId || 5, material.titulo, material.tipo, material.urlOrPath,
                material.portada || null, material.fileHash, material.descripcion,
                material.pages || null,
                Array.isArray(material.categories) ? material.categories.join(',') : (material.categories || ''),
                material.estado
            );
        });
        await db.execute(
            `INSERT INTO materials (autor_id, uploaded_by, author, category_id, titulo, tipo, url_or_path, portada, file_hash, descripcion, pages, categories, estado)
             VALUES ${placeholders}`,
            params
        );
        const hashes = materials.map(material => material.fileHash).filter(Boolean);
        if (!hashes.length) return materials;
        const hashPlaceholders = hashes.map(() => '?').join(',');
        const [rows] = await db.execute(
            `SELECT id, file_hash AS fileHash FROM materials WHERE file_hash IN (${hashPlaceholders})`,
            hashes
        );
        const byHash = new Map(rows.map(row => [row.fileHash, Number(row.id)]));
        materials.forEach(material => {
            material.id = byHash.get(material.fileHash) || null;
            material.materias = [];
            material.materiasIds = [];
            material.materiasTodosIds = [];
            material.carreras = [];
        });
        return materials;
    }

    async syncTagsMany(materials = []) {
        const list = (materials || []).filter(material => material && material.id);
        if (!list.length) return;
        const ids = list.map(material => Number(material.id));
        const placeholders = ids.map(() => '?').join(',');
        await db.execute(`DELETE FROM material_tags WHERE material_id IN (${placeholders})`, ids);
        const pairs = [];
        list.forEach(material => {
            const tags = [...new Set((material.categories || [])
                .map(tag => String(tag || '').trim().toLowerCase())
                .filter(Boolean))];
            tags.forEach(tag => pairs.push([Number(material.id), tag]));
        });
        if (!pairs.length) return;
        await db.query(
            `INSERT IGNORE INTO material_tags (material_id, tag) VALUES ${pairs.map(() => '(?, ?)').join(', ')}`,
            pairs.flat()
        );
    }

    async syncTags(materialId, tags = []) {
        const normalized = [...new Set((tags || [])
            .map(tag => String(tag || '').trim().toLowerCase())
            .filter(Boolean))];
        await db.execute('DELETE FROM material_tags WHERE material_id = ?', [materialId]);
        if (!normalized.length) return;
        await db.query(
            `INSERT IGNORE INTO material_tags (material_id, tag) VALUES ${normalized.map(() => '(?, ?)').join(', ')}`,
            normalized.flatMap(tag => [materialId, tag])
        );
    }

    async save(material) {
        const categories = Array.isArray(material.categories)
            ? material.categories.join(',')
            : (material.categories || '');
        const [res] = await db.execute(
            `INSERT INTO materials (autor_id, uploaded_by, author, category_id, titulo, tipo, url_or_path, portada, file_hash, descripcion, pages, categories, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [material.autorId, material.uploadedBy || material.autorId, material.author || null,
             material.categoryId || 5, material.titulo, material.tipo, material.urlOrPath,
             material.portada || null, material.fileHash, material.descripcion,
             material.pages || null, categories, material.estado]
        );
        material.id = res.insertId;
        await this.syncTags(material.id, material.categories);
        if (!material.materias) material.materias = [];
        if (!material.materiasIds) material.materiasIds = [];
        if (!material.materiasTodosIds) material.materiasTodosIds = [];
        if (!material.carreras) material.carreras = [];
        return material;
    }

    async findBasicById(id) {
        const [rows] = await db.execute(
            'SELECT id, titulo, pages FROM materials WHERE id = ?',
            [id]
        );
        if (!rows.length) return null;
        return {
            id: Number(rows[0].id),
            titulo: rows[0].titulo,
            pages: rows[0].pages ? Number(rows[0].pages) : null
        };
    }

    async findById(id) {
        const [rows] = await db.execute(`${SELECT_MATERIAL} WHERE m.id = ?`, [id]);
        const material = mapMaterial(rows[0]);
        if (!material) return null;
        await this.attachAllAssociations([material]);
        return material;
    }

    async findByHash(hash) {
        const [rows] = await db.execute(`${SELECT_MATERIAL} WHERE m.file_hash = ?`, [hash]);
        return mapMaterial(rows[0]);
    }

    /**
     * Serializa las subidas concurrentes del mismo contenido. El bloqueo de
     * hueco sobre el indice unico evita que dos transacciones inserten el hash.
     */
    async findByHashForUpdate(hash) {
        const [rows] = await db.execute(`${SELECT_MATERIAL} WHERE m.file_hash = ? FOR UPDATE`, [hash]);
        return mapMaterial(rows[0]);
    }

    async lockAuthor(authorId) {
        await db.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [authorId]);
    }

    buildFilters(filters = {}, alias = 'm') {
        const clauses = [];
        const params = [];
        if (filters.q) {
            const query = fullTextQuery(filters.q);
            if (query) {
                clauses.push(`(EXISTS (
                    SELECT 1 FROM material_search mse
                     WHERE mse.material_id = ${alias}.id
                       AND MATCH(mse.search_text) AGAINST (? IN BOOLEAN MODE)
                ) OR EXISTS (
                    SELECT 1 FROM user_search us
                     WHERE us.user_id = ${alias}.autor_id
                       AND MATCH(us.search_text) AGAINST (? IN BOOLEAN MODE)
                ))`);
                params.push(query, query);
            } else {
                clauses.push(`(${alias}.titulo LIKE ? OR ${alias}.author LIKE ?)`);
                const like = `%${filters.q}%`;
                params.push(like, like);
            }
        }
        if (filters.tipo) {
            clauses.push(`${alias}.tipo = ?`);
            params.push(filters.tipo);
        }
        if (filters.category) {
            if (/^\d+$/.test(String(filters.category))) {
                clauses.push(`${alias}.category_id = ?`);
                params.push(Number(filters.category));
            } else {
                clauses.push(`cat.slug = ?`);
                params.push(filters.category);
            }
        }
        if (filters.uploadYear && /^\d{4}$/.test(String(filters.uploadYear))) {
            const year = Number(filters.uploadYear);
            clauses.push(`${alias}.created_at >= ? AND ${alias}.created_at < ?`);
            params.push(`${year}-01-01 00:00:00`, `${year + 1}-01-01 00:00:00`);
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
            const normalized = [...new Set(filters.tags.map(tag => String(tag || '').trim().toLowerCase()).filter(Boolean))];
            normalized.forEach(tag => {
                clauses.push(`EXISTS (SELECT 1 FROM material_tags mt
                              WHERE mt.material_id = ${alias}.id AND mt.tag = ?)`);
                params.push(tag);
            });
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
            SELECT ms.material_id AS materialId, ms.is_mandatory AS isMandatory,
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
                isMandatory: Boolean(row.isMandatory),
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
            material.isMandatory = entry.subjects.some(subject => subject.isMandatory);
            material.carreras = entry.careers;
        });
        return materials;
    }

    async findAllGlobal(filters = {}) {
        const { clauses, params } = this.buildFilters(filters);
        // El catalogo global muestra todo material aprobado, aunque ya no
        // tenga materias asociadas: sigue disponible para reasociarlo.
        const where = [`m.estado = 'Aprobado'`, ...clauses];
        const page = this.paginationClause(filters);
        const [rows] = await db.execute(
            `${SELECT_MATERIAL} WHERE ${where.join(' AND ')}
             ORDER BY ${this.buildOrder(filters)} ${page.sql}`,
            [...params, ...page.params]
        );
        const total = await this.countWhere(where, params);
        return { items: await this.attachCareers(rows.map(mapMaterial)), total };
    }

    async findBySubject(subjectId, filters = {}) {
        const { clauses, params } = this.buildFilters(filters);
        const link = `INNER JOIN material_subjects msx
                        ON msx.material_id = m.id AND msx.subject_id = ?
                       AND msx.estado_aprobacion = 'Aprobado'
                       ${filters.mandatory ? 'AND msx.is_mandatory = 1' : ''}`;
        const where = [`m.estado = 'Aprobado'`, ...clauses];
        const queryParams = [subjectId, ...params];
        const page = this.paginationClause(filters);
        const order = !filters.sort || filters.sort === 'newest'
            ? 'msx.material_id DESC, m.id DESC'
            : this.buildOrder(filters);
        const [rows] = await db.execute(
            `${SELECT_MATERIAL} ${link} WHERE ${where.join(' AND ')}
             ORDER BY ${order} ${page.sql}`,
            [...queryParams, ...page.params]
        );
        const countWhere = [
            `m.estado = 'Aprobado'`,
            `EXISTS (SELECT 1 FROM material_subjects msx WHERE msx.material_id = m.id
                     AND msx.subject_id = ? AND msx.estado_aprobacion = 'Aprobado'
                     ${filters.mandatory ? 'AND msx.is_mandatory = 1' : ''})`,
            ...clauses
        ];
        const total = await this.countWhere(countWhere, queryParams);
        return { items: await this.attachCareers(rows.map(mapMaterial)), total };
    }

    async findByAuthor(authorId, filters = {}) {
        const { clauses, params } = this.buildFilters(filters);
        const where = [`m.autor_id = ?`];
        const queryParams = [authorId];
        if (filters.estado) {
            where.push('m.estado = ?');
            queryParams.push(filters.estado);
        }
        where.push(...clauses);
        queryParams.push(...params);
        const page = this.paginationClause(filters);
        const [rows] = await db.execute(
            `${SELECT_MATERIAL} WHERE ${where.join(' AND ')}
             ORDER BY ${this.buildOrder(filters)} ${page.sql}`,
            [...queryParams, ...page.params]
        );
        const total = await this.countWhere(where, queryParams);
        return { items: await this.attachCareers(rows.map(mapMaterial)), total };
    }

    async findPendingByAuthor(authorId, filters = {}) {
        const where = [`m.autor_id = ?`, `m.estado = 'Pendiente'`];
        const page = this.paginationClause(filters);
        const [rows] = await db.execute(
            `${SELECT_MATERIAL} WHERE ${where.join(' AND ')}
             ORDER BY ${this.buildOrder(filters)} ${page.sql}`,
            [authorId, ...page.params]
        );
        const total = await this.countWhere(where, [authorId]);
        return { items: rows.map(mapMaterial), total };
    }

    /** Material sugerido por alumnos pendiente de revision en las materias del profesor. */
    async findPendingForProfessor(profesorId, filters = {}) {
        const page = this.paginationClause(filters);
        const [rows] = await db.execute(`
            SELECT m.id, m.autor_id AS autorId, CONCAT(u.nombre, ' ', u.apellido) AS autorNombre,
                   m.uploaded_by AS uploadedBy,
                   COALESCE(CONCAT(ub.nombre, ' ', ub.apellido), CONCAT(u.nombre, ' ', u.apellido)) AS uploaderNombre,
                   COALESCE(ur.nombre, r.nombre) AS uploaderRol,
                   m.titulo, m.tipo, m.url_or_path AS urlOrPath, m.portada, m.file_hash AS fileHash,
                   m.descripcion, m.pages, m.categories, m.estado, m.es_favorito AS esFavorito, m.contador_favoritos AS contadorFavoritos, m.created_at AS createdAt,
                   ms.subject_id AS subjectId, s.nombre AS subjectNombre
            FROM material_subjects ms
            INNER JOIN materials m ON m.id = ms.material_id
            INNER JOIN subjects s ON s.id = ms.subject_id
            INNER JOIN users u ON u.id = m.autor_id
            INNER JOIN roles r ON r.id = u.role_id
            LEFT JOIN users ub ON ub.id = m.uploaded_by
            LEFT JOIN roles ur ON ur.id = ub.role_id
            WHERE ms.estado_aprobacion = 'Pendiente'
              AND EXISTS (SELECT 1 FROM subject_professors sp
                           WHERE sp.subject_id = s.id AND sp.profesor_id = ?)
            ORDER BY m.created_at DESC ${page.sql}`, [profesorId, ...page.params]);
        const [countRows] = await db.execute(`
            SELECT COUNT(*) AS total
              FROM material_subjects ms
              INNER JOIN materials m ON m.id = ms.material_id
              INNER JOIN subjects s ON s.id = ms.subject_id
             WHERE ms.estado_aprobacion = 'Pendiente'
               AND EXISTS (SELECT 1 FROM subject_professors sp
                            WHERE sp.subject_id = s.id AND sp.profesor_id = ?)`, [profesorId]);
        return {
            items: rows.map(r => {
                const material = new Material({ ...r, categories: split(r.categories) });
                material.subjectId = r.subjectId;
                material.subjectNombre = r.subjectNombre;
                return material;
            }),
            total: Number(countRows[0].total) || 0
        };
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
             ON DUPLICATE KEY UPDATE estado_aprobacion =
                IF(estado_aprobacion = 'Aprobado', 'Aprobado', VALUES(estado_aprobacion))`,
            [materialId, subjectId, estado]
        );
        return true;
    }

    async findAssociation(materialId, subjectId) {
        const [rows] = await db.execute(
            `SELECT material_id AS materialId, subject_id AS subjectId,
                    estado_aprobacion AS estadoAprobacion, is_mandatory AS isMandatory
               FROM material_subjects WHERE material_id = ? AND subject_id = ?`,
            [materialId, subjectId]
        );
        if (!rows.length) return null;
        return {
            materialId: Number(rows[0].materialId),
            subjectId: Number(rows[0].subjectId),
            estadoAprobacion: rows[0].estadoAprobacion,
            isMandatory: Boolean(rows[0].isMandatory)
        };
    }

    async updateAssociationState(materialId, subjectId, estado) {
        const [res] = await db.execute(
            `UPDATE material_subjects SET estado_aprobacion = ? WHERE material_id = ? AND subject_id = ?`,
            [estado, materialId, subjectId]
        );
        return res.affectedRows > 0;
    }

    async approveAssociation(materialId, subjectId) {
        const [res] = await db.execute(
            `UPDATE material_subjects
                SET estado_aprobacion = 'Aprobado'
              WHERE material_id = ? AND subject_id = ? AND estado_aprobacion = 'Pendiente'`,
            [materialId, subjectId]
        );
        return res.affectedRows > 0;
    }

    async updateEstado(materialId, estado) {
        const [res] = await db.execute(
            `UPDATE materials SET estado = ? WHERE id = ?`, [estado, materialId]
        );
        return res.affectedRows > 0;
    }

    async markApproved(materialId) {
        const [rows] = await db.execute(
            'SELECT estado FROM materials WHERE id = ? FOR UPDATE',
            [materialId]
        );
        if (!rows.length || !['Pendiente', 'Aprobado'].includes(rows[0].estado)) return false;
        if (rows[0].estado === 'Pendiente') {
            await db.execute("UPDATE materials SET estado = 'Aprobado' WHERE id = ?", [materialId]);
        }
        return true;
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
        if (changes.pages !== undefined) { fields.push('pages = ?'); params.push(changes.pages); }
        if (changes.portada !== undefined) { fields.push('portada = ?'); params.push(changes.portada); }
        if (changes.tipo !== undefined) { fields.push('tipo = ?'); params.push(changes.tipo); }
        if (changes.urlOrPath !== undefined) { fields.push('url_or_path = ?'); params.push(changes.urlOrPath); }
        if (changes.fileHash !== undefined) { fields.push('file_hash = ?'); params.push(changes.fileHash); }
        if (changes.categories !== undefined) {
            fields.push('categories = ?');
            params.push(Array.isArray(changes.categories) ? changes.categories.join(',') : changes.categories);
        }
        if (changes.author !== undefined) { fields.push('author = ?'); params.push(changes.author); }
        if (changes.categoryId !== undefined) { fields.push('category_id = ?'); params.push(changes.categoryId); }
        if (!fields.length) return false;
        params.push(materialId);
        const [res] = await db.execute(`UPDATE materials SET ${fields.join(', ')} WHERE id = ?`, params);
        if (res.affectedRows > 0 && changes.categories !== undefined) {
            await this.syncTags(materialId, changes.categories);
        }
        return res.affectedRows > 0;
    }

    async delete(materialId) {
        const [res] = await db.execute('DELETE FROM materials WHERE id = ?', [materialId]);
        return res.affectedRows > 0;
    }
    // Favorites methods
    async toggleFavorite(materialId, userId) {
        return db.transaction(async () => {
            await db.execute('SELECT id FROM materials WHERE id = ? FOR UPDATE', [materialId]);
            const [existing] = await db.execute(
                'SELECT id FROM material_favorites WHERE material_id = ? AND usuario_id = ? FOR UPDATE',
                [materialId, userId]
            );
            let favorited;
            if (existing.length > 0) {
                await db.execute('DELETE FROM material_favorites WHERE id = ?', [existing[0].id]);
                favorited = false;
            } else {
                await db.execute(
                    'INSERT INTO material_favorites (material_id, usuario_id) VALUES (?, ?)',
                    [materialId, userId]
                );
                favorited = true;
            }
            await db.execute(
                `UPDATE materials
                    SET contador_favoritos = (SELECT COUNT(*) FROM material_favorites WHERE material_id = ?)
                  WHERE id = ?`,
                [materialId, materialId]
            );
            return { favorited, contadorFavoritos: await this.countFavorites(materialId) };
        });
    }

    async findFavorites(userId, filters = {}) {
        const built = this.buildFilters(filters, 'm');
        const where = [`mf.usuario_id = ?`, "m.estado = 'Aprobado'", ...built.clauses];
        const params = [userId, ...built.params];
        const page = this.paginationClause(filters);
        const [rows] = await db.execute(
            `${SELECT_MATERIAL} INNER JOIN material_favorites mf ON mf.material_id = m.id
             WHERE ${where.join(' AND ')}
             ORDER BY mf.created_at DESC, m.id DESC ${page.sql}`,
            [...params, ...page.params]
        );
        const [countRows] = await db.execute(
            `SELECT COUNT(*) AS total ${MATERIAL_FROM}
             INNER JOIN material_favorites mf ON mf.material_id = m.id
             WHERE ${where.join(' AND ')}`, params
        );
        const materials = rows.map(row => {
            const material = mapMaterial(row);
            if (material) material.esFavorito = 1;
            return material;
        });
        return { items: await this.attachCareers(materials), total: Number(countRows[0].total) || 0 };
    }

    async findFavoriteIds(userId, materialIds = null) {
        if (!userId) return [];
        if (Array.isArray(materialIds)) {
            const ids = [...new Set(materialIds.map(Number).filter(Boolean))];
            if (!ids.length) return [];
            const placeholders = ids.map(() => '?').join(',');
            const [rows] = await db.execute(
                `SELECT material_id AS id FROM material_favorites
                  WHERE usuario_id = ? AND material_id IN (${placeholders})`,
                [userId, ...ids]
            );
            return rows.map(r => Number(r.id));
        }
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

    async setSubjectMandatory(materialId, subjectId, isMandatory) {
        const [res] = await db.execute(
            'UPDATE material_subjects SET is_mandatory = ? WHERE material_id = ? AND subject_id = ?',
            [isMandatory ? 1 : 0, materialId, subjectId]
        );
        return res.affectedRows > 0;
    }

    async getSubjectMandatory(materialId, subjectId) {
        const [rows] = await db.execute(
            'SELECT is_mandatory AS isMandatory FROM material_subjects WHERE material_id = ? AND subject_id = ?',
            [materialId, subjectId]
        );
        return rows.length ? Boolean(rows[0].isMandatory) : null;
    }

    async countApprovedByUploader(uploaderId) {
        const [rows] = await db.execute(
            `SELECT COUNT(*) AS total FROM materials WHERE uploaded_by = ? AND estado = 'Aprobado'`,
            [uploaderId]
        );
        return Number(rows[0].total) || 0;
    }

    async findByIds(ids = []) {
        const unique = [...new Set(ids.map(Number).filter(Boolean))];
        if (!unique.length) return [];
        const placeholders = unique.map(() => '?').join(',');
        const [rows] = await db.execute(
            `${SELECT_MATERIAL} WHERE m.id IN (${placeholders}) ORDER BY m.created_at DESC`,
            unique
        );
        return this.attachCareers(rows.map(mapMaterial));
    }

    async findFilterOptions() {
        const [rangeRows] = await db.execute(
            `SELECT MIN(created_at) AS minDate, MAX(created_at) AS maxDate
               FROM materials WHERE estado = 'Aprobado'`
        );
        const [categories] = await db.execute(
            `SELECT id, slug, nombre FROM categories ORDER BY nombre`
        );
        const minYear = rangeRows[0]?.minDate ? new Date(rangeRows[0].minDate).getFullYear() : null;
        const maxYear = rangeRows[0]?.maxDate ? new Date(rangeRows[0].maxDate).getFullYear() : null;
        const years = [];
        if (minYear && maxYear) {
            for (let year = maxYear; year >= minYear; year -= 1) years.push(year);
        }
        return {
            years,
            categories: categories.map(row => ({
                id: Number(row.id), slug: row.slug, nombre: row.nombre
            }))
        };
    }
}

module.exports = MariaDBMaterialRepository;
