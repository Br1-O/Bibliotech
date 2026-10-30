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
           u.verification_token AS verificationToken, u.verification_expires AS verificationExpires,
           u.birthdate, u.gender, u.gender_custom AS genderCustom, u.city, u.country,
           u.github, u.instagram, u.linkedin, u.career, u.institute, u.about_me AS aboutMe, u.phone,
           u.xp, u.rank_level AS rankLevel, u.profile_picture AS profilePicture,
           rk.title AS rankTitle, rk.title AS rankNombre
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    LEFT JOIN ranks rk ON rk.rank_id = u.rank_level
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

    async updateProfile(id, data) {
        const allowed = ['nombre', 'apellido', 'birthdate', 'gender', 'gender_custom', 'city', 'country',
            'github', 'instagram', 'linkedin', 'career', 'institute', 'about_me', 'phone', 'profile_picture'];
        const sets = [];
        const values = [];
        for (const key of allowed) {
            if (data[key] !== undefined) {
                sets.push(`${key} = ?`);
                values.push(data[key]);
            }
        }
        if (!sets.length) return false;
        values.push(id);
        const [res] = await db.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);
        return res.affectedRows > 0;
    }

    async addXp(id, amount) {
        await db.execute('UPDATE users SET xp = GREATEST(0, xp + ?) WHERE id = ?', [Number(amount) || 0, id]);
        const [rows] = await db.execute(
            `SELECT xp FROM users WHERE id = ?`,
            [id]
        );
        if (!rows.length) return 0;
        const xp = Number(rows[0].xp) || 0;
        const [rankRows] = await db.execute(
            `SELECT rank_id AS level FROM ranks WHERE min_xp <= ? ORDER BY min_xp DESC LIMIT 1`,
            [xp]
        );
        const level = rankRows.length ? rankRows[0].level : 1;
        await db.execute('UPDATE users SET rank_level = ? WHERE id = ?', [level, id]);
        return xp;
    }

}

module.exports = MariaDBUserRepository;
