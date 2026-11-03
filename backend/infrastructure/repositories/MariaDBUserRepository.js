/**
* Project     : Bibliotech  |  Capa: Infraestructura - Adaptador de Salida
* Implementacion MariaDB del repositorio de Usuarios.
*/

const db = require('../../config/db');
const TtlCache = require('../../utils/ttlCache');
const UserRepositoryInterface = require('../../domain/ports/UserRepositoryInterface');
const User = require('../../domain/entities/User');

const SELECT_USER = `
    SELECT u.id, u.role_id AS roleId, r.nombre AS roleNombre, u.nombre, u.apellido,
           u.email, u.password, u.token_version AS tokenVersion, u.reset_token AS resetToken, u.estado,
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
    constructor() {
        super();
        this.rankCache = new TtlCache({ ttlMs: 5 * 60 * 1000, maxEntries: 1 });
    }

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

    async lockById(id) {
        const [rows] = await db.execute(
            'SELECT id, xp, rank_level AS rankLevel FROM users WHERE id = ? FOR UPDATE',
            [id]
        );
        if (!rows.length) return null;
        return {
            id: Number(rows[0].id),
            xp: Number(rows[0].xp) || 0,
            rankLevel: Number(rows[0].rankLevel) || 1
        };
    }

    async loadRanks() {
        return this.rankCache.getOrSet('ranks', async () => {
            const [rows] = await db.execute(
                'SELECT rank_id AS level, title, min_xp AS minXp FROM ranks ORDER BY min_xp'
            );
            return rows.map(row => ({
                level: Number(row.level),
                title: row.title,
                minXp: Number(row.minXp)
            }));
        });
    }

    resolveRank(ranks, xp) {
        let current = ranks[0] || { level: 1, title: null, minXp: 0 };
        for (const rank of ranks) {
            if (rank.minXp <= xp) current = rank;
            else break;
        }
        return current;
    }

    async findByEmail(email) {
        const [rows] = await db.execute(`${SELECT_USER} WHERE u.email = ?`, [email]);
        return mapUser(rows[0]);
    }

    async updatePassword(id, hashedPass) {
        const [res] = await db.execute(
            `UPDATE users
                SET password = ?, reset_token = NULL, token_expiration = NULL,
                    token_version = token_version + 1
              WHERE id = ?`,
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

    async findAll(filters = {}) {
        const clauses = [];
        const params = [];
        if (filters.q) {
            clauses.push('(u.nombre LIKE ? OR u.apellido LIKE ? OR u.email LIKE ?)');
            const like = `%${filters.q}%`;
            params.push(like, like, like);
        }
        if (filters.role) {
            clauses.push('r.nombre = ?');
            params.push(filters.role);
        }
        if (filters.estado) {
            clauses.push('u.estado = ?');
            params.push(filters.estado);
        }
        const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
        const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
        const offset = Math.max(Number(filters.offset) || 0, 0);
        const [rows] = await db.execute(
            `${SELECT_USER}${where} ORDER BY u.id LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );
        const [countRows] = await db.execute(
            `SELECT COUNT(*) AS total FROM users u INNER JOIN roles r ON r.id = u.role_id${where}`,
            params
        );
        return {
            items: rows.map(u => new User(u).toSafeJSON()),
            total: Number(countRows[0].total) || 0
        };
    }

    async findByRole(nombreRol) {
        const [rows] = await db.execute(`${SELECT_USER} WHERE r.nombre = ? ORDER BY u.nombre`, [nombreRol]);
        return rows.map(u => new User(u).toSafeJSON());
    }

    /** Bloquea todas las cuentas de un rol para serializar cambios de rol. */
    async lockByRole(nombreRol) {
        const [rows] = await db.execute(
            `SELECT u.id FROM users u INNER JOIN roles r ON r.id = u.role_id
              WHERE r.nombre = ? FOR UPDATE`,
            [nombreRol]
        );
        return rows.map(row => Number(row.id));
    }
    async updateEstado(id, estado) {
        const [res] = await db.execute(
            'UPDATE users SET estado = ?, token_version = token_version + 1 WHERE id = ?',
            [estado, id]
        );
        return res.affectedRows > 0;
    }

    async updateRole(id, roleId) {
        const [res] = await db.execute(
            'UPDATE users SET role_id = ?, token_version = token_version + 1 WHERE id = ?',
            [roleId, id]
        );
        return res.affectedRows > 0;
    }

    async softDelete(id) {
        const [res] = await db.execute(
            "UPDATE users SET estado = 'Inactivo', token_version = token_version + 1 WHERE id = ?",
            [id]
        );
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

    async addXp(id, amount, current = null) {
        const base = current || await this.findById(id);
        if (!base) return { xp: 0, rankLevel: 1, rankTitle: null };
        const xp = Math.max(0, Number(base.xp) + (Number(amount) || 0));
        const rank = this.resolveRank(await this.loadRanks(), xp);
        await db.execute(
            'UPDATE users SET xp = ?, rank_level = ? WHERE id = ?',
            [xp, rank.level, id]
        );
        return { xp, rankLevel: rank.level, rankTitle: rank.title || null };
    }

    /**
     * Acredita XP una sola vez por evento. El ledger es la fuente de verdad
     * para impedir granjas de XP al desmarcar/volver a marcar una lectura.
     */
    async addXpOnce(id, amount, source, sourceId = '', current = null) {
        const key = String(sourceId);
        const [result] = await db.execute(
            `INSERT IGNORE INTO xp_ledger (user_id, source, source_id, amount)
             VALUES (?, ?, ?, ?)`,
            [id, String(source), key, Number(amount) || 0]
        );
        const awarded = result.affectedRows > 0;
        if (awarded) {
            return { awarded, ...(await this.addXp(id, amount, current)) };
        }
        const user = current || await this.findById(id);
        return {
            awarded,
            xp: Number(user?.xp) || 0,
            rankLevel: Number(user?.rankLevel) || 1,
            rankTitle: user?.rankTitle || null
        };
    }

}

module.exports = MariaDBUserRepository;
