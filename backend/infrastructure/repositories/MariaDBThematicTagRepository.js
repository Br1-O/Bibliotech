/**
* Project     : Bibliotech
*/

const db = require('../../config/db');
const ThematicTagRepositoryInterface = require('../../domain/ports/ThematicTagRepositoryInterface');
const ThematicTag = require('../../domain/entities/ThematicTag');

const map = row => (row ? new ThematicTag(row) : null);

class MariaDBThematicTagRepository extends ThematicTagRepositoryInterface {
    async findAll(filters = {}) {
        let query = 'SELECT * FROM thematic_tags ORDER BY categoria, nombre';
        const params = [];
        const [rows] = await db.execute(query, params);
        return rows.map(map);
    }

    async findById(id) {
        const [rows] = await db.execute('SELECT * FROM thematic_tags WHERE id = ?', [id]);
        return map(rows[0]);
    }

    async findByNameCategory(nombre, categoria) {
        const [rows] = await db.execute('SELECT * FROM thematic_tags WHERE nombre = ? AND categoria = ?', [nombre, categoria]);
        return map(rows[0]);
    }

    async save(tag) {
        const [res] = await db.execute(
            'INSERT INTO thematic_tags (nombre, categoria, creado_por) VALUES (?, ?, ?)',
            [tag.nombre, tag.categoria, tag.creadoPor || null]
        );
        tag.id = res.insertId;
        return tag;
    }

    async ban(id) {
        const [res] = await db.execute('UPDATE thematic_tags SET baneado = 1 WHERE id = ?', [id]);
        return res.affectedRows > 0;
    }

    async delete(id) {
        const [res] = await db.execute('DELETE FROM thematic_tags WHERE id = ?', [id]);
        return res.affectedRows > 0;
    }
}

module.exports = MariaDBThematicTagRepository;
