/**
* Project     : Bibliotech  |  Capa: Infraestructura - Adaptador de Salida
* Implementacion MariaDB del repositorio de Roles.
*/

const db = require('../../config/db');
const RoleRepositoryInterface = require('../../domain/ports/RoleRepositoryInterface');
const Role = require('../../domain/entities/Role');

class MariaDBRoleRepository extends RoleRepositoryInterface {
    async save(role) {
        if (role.id) {
            await db.execute('UPDATE roles SET nombre = ?, descripcion = ? WHERE id = ?',
                [role.nombre, role.descripcion, role.id]);
            return role;
        }
        const [res] = await db.execute('INSERT INTO roles (nombre, descripcion) VALUES (?, ?)',
            [role.nombre, role.descripcion]);
        role.id = res.insertId;
        return role;
    }

    async findById(id) {
        const [rows] = await db.execute('SELECT * FROM roles WHERE id = ?', [id]);
        return rows[0] ? new Role(rows[0]) : null;
    }

    async findByName(nombre) {
        const [rows] = await db.execute('SELECT * FROM roles WHERE nombre = ?', [nombre]);
        return rows[0] ? new Role(rows[0]) : null;
    }

    async findAll() {
        const [rows] = await db.execute('SELECT * FROM roles ORDER BY id');
        return rows.map(r => new Role(r));
    }

    async delete(id) {
        const [res] = await db.execute('DELETE FROM roles WHERE id = ?', [id]);
        return res.affectedRows > 0;
    }
}

module.exports = MariaDBRoleRepository;
