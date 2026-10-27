/**
* Project     : Bibliotech  |  Capa: Infraestructura - Adaptador de Salida
* Implementacion MariaDB del repositorio de Usuarios.
*/

const db = require('../../config/db');
const UserRepositoryInterface = require('../../domain/ports/UserRepositoryInterface');
const User = require('../../domain/entities/User');

const SELECT_USER = `
    SELECT u.id, u.role_id AS roleId, r.nombre AS roleNombre, u.nombre, u.apellido,
           u.email, u.password, u.reset_token AS resetToken, u.estado,
           u.token_expiration AS tokenExpiration, u.created_at AS createdAt,
           u.verification_token AS verificationToken, u.verification_expires AS verificationExpires
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
`;

const mapUser = row => (row ? new User(row) : null);

class MariaDBUserRepository extends UserRepositoryInterface {
    async save(user) {
        const [res] = await db.execute(
            `INSERT INTO users (role_id, nombre, apellido, email, password) VALUES (?, ?, ?, ?, ?)`,
            [user.roleId, user.nombre, user.apellido, user.email, user.password]
        );
        user.id = res.insertId;
        return user;
    }

    async findById(id) {
        const [rows] = await db.execute(`${SELECT_USER} WHERE u.id = ?`, [id]);
        return mapUser(rows[0]);
    }

    async findByEmail(email) {
        const [rows] = await db.execute(`${SELECT_USER} WHERE u.email = ?`, [email]);
        return mapUser(rows[0]);
    }

    async updatePassword(id, hashedPass) {
        const [res] = await db.execute(
            `UPDATE users SET password = ?, reset_token = NULL, token_expiration = NULL WHERE id = ?`,
            [hashedPass, id]
        );
        return res.affectedRows > 0;
    }

    async setResetToken(email, token, expiration) {
        const [res] = await db.execute(
            `UPDATE users SET reset_token = ?, token_expiration = ? WHERE email = ?`,
            [token, expiration, email]
        );
        return res.affectedRows > 0;
    }

    async findByResetToken(token) {
        const [rows] = await db.execute(`${SELECT_USER} WHERE u.reset_token = ?`, [token]);
        return mapUser(rows[0]);
    }

    async findAll() {
        const [rows] = await db.execute(`${SELECT_USER} ORDER BY u.id`);
        return rows.map(u => new User(u).toSafeJSON());
    }

    async findByRole(nombreRol) {
        const [rows] = await db.execute(`${SELECT_USER} WHERE r.nombre = ? ORDER BY u.nombre`, [nombreRol]);
        return rows.map(u => new User(u).toSafeJSON());
    }
    async updateEstado(id, estado) {
        const [res] = await db.execute('UPDATE users SET estado = ? WHERE id = ?', [estado, id]);
        return res.affectedRows > 0;
    }

    async softDelete(id) {
        const [res] = await db.execute("UPDATE users SET estado = 'Inactivo' WHERE id = ?", [id]);
        return res.affectedRows > 0;
    }

    async setVerificationToken(email, token, expiration) {
        const [res] = await db.execute(
            `UPDATE users SET verification_token = ?, verification_expires = ?, estado = 'PendienteVerificacion' WHERE email = ?`,
            [token, expiration, email]
        );
        return res.affectedRows > 0;
    }

    async findByVerificationToken(token) {
        const [rows] = await db.execute(`${SELECT_USER} WHERE u.verification_token = ?`, [token]);
        return mapUser(rows[0]);
    }

    async verifyUser(id) {
        const [res] = await db.execute(
            `UPDATE users SET estado = 'Activo', verification_token = NULL, verification_expires = NULL WHERE id = ?`,
            [id]
        );
        return res.affectedRows > 0;
    }

}

module.exports = MariaDBUserRepository;
