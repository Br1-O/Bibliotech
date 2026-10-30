/**
* Project     : Bibliotech  |  Capa: Infraestructura - Adaptador de Salida
* Implementacion MariaDB de lecturas, progreso, rachas, insignias, backlog y seguidores.
* Los nombres de tablas/columnas siguen el esquema definido en el PRD.
*/

const db = require('../../config/db');

const rankPicture = title => `/img/profile_pictures/${title}.png`;

const mapProgress = row => {
    if (!row) return null;
    const currentPage = Number(row.currentPage) || 0;
    const totalPages = row.totalPages ? Number(row.totalPages) : null;
    return {
        materialId: Number(row.materialId),
        currentPage,
        totalPages,
        status: row.status || 'pending',
        completed: false,
        progress: totalPages ? Math.min(100, Math.round((currentPage / totalPages) * 100)) : 0,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
};

class MariaDBGamificationRepository {
    async getProfileStats(userId) {
        const [rows] = await db.execute(`
            SELECT
                (SELECT COUNT(*) FROM user_subscriptions WHERE target_user_id = ?) AS followers,
                (SELECT COUNT(*) FROM user_subscriptions WHERE subscriber_id = ?) AS following,
                (SELECT COUNT(*) FROM material_reads WHERE user_id = ?)           AS read_count,
                (SELECT COUNT(*) FROM material_favorites WHERE usuario_id = ?)    AS favorites,
                (SELECT COUNT(*) FROM materials WHERE uploaded_by = ? AND estado = 'Aprobado') AS uploads,
                (SELECT COUNT(*) FROM reading_backlog WHERE user_id = ?)          AS backlog
        `, [userId, userId, userId, userId, userId, userId]);
        return rows[0] || {};
    }

    async listBadges(userId) {
        const [rows] = await db.execute(
            'SELECT badge_key AS badgeKey, unlocked_at AS unlockedAt FROM user_badges WHERE user_id = ? ORDER BY unlocked_at',
            [userId]
        );
        return rows;
    }

    async addBadge(userId, badgeKey) {
        const [res] = await db.execute(
            'INSERT IGNORE INTO user_badges (user_id, badge_key) VALUES (?, ?)',
            [userId, badgeKey]
        );
        return res.affectedRows > 0;
    }

    async listRanks() {
        const [rows] = await db.execute(
            'SELECT rank_id AS rankId, title, min_xp AS minXp FROM ranks ORDER BY rank_id'
        );
        return rows.map(row => ({
            rankId: Number(row.rankId),
            title: row.title,
            minXp: Number(row.minXp),
            picture: rankPicture(row.title)
        }));
    }

    async getRankForXp(xp) {
        const [rows] = await db.execute(
            'SELECT rank_id AS rankId, title, min_xp AS minXp FROM ranks WHERE min_xp <= ? ORDER BY min_xp DESC LIMIT 1',
            [Number(xp) || 0]
        );
        if (!rows.length) return null;
        return {
            rankId: Number(rows[0].rankId),
            title: rows[0].title,
            minXp: Number(rows[0].minXp),
            picture: rankPicture(rows[0].title)
        };
    }

    async listReadIds(userId) {
        const [rows] = await db.execute(
            'SELECT material_id AS id FROM material_reads WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        return rows.map(row => Number(row.id));
    }

    async getRead(userId, materialId) {
        const [rows] = await db.execute(
            'SELECT material_id AS materialId, created_at AS createdAt FROM material_reads WHERE user_id = ? AND material_id = ?',
            [userId, materialId]
        );
        if (!rows.length) return null;
        const progress = await this.getProgress(userId, materialId);
        return {
            materialId: Number(rows[0].materialId),
            createdAt: rows[0].createdAt,
            ...(progress || {})
        };
    }

    async addRead(userId, materialId) {
        await db.execute(
            'INSERT IGNORE INTO material_reads (user_id, material_id) VALUES (?, ?)',
            [userId, materialId]
        );
        return this.getRead(userId, materialId);
    }

    async deleteRead(userId, materialId) {
        const [res] = await db.execute(
            'DELETE FROM material_reads WHERE user_id = ? AND material_id = ?',
            [userId, materialId]
        );
        return res.affectedRows > 0;
    }

    async getProgress(userId, materialId) {
        const [rows] = await db.execute(
            `SELECT material_id AS materialId, current_page AS currentPage, total_pages AS totalPages,
                    status, created_at AS createdAt, updated_at AS updatedAt
               FROM reading_backlog WHERE user_id = ? AND material_id = ?`,
            [userId, materialId]
        );
        return mapProgress(rows[0]);
    }

    async updateProgress(userId, materialId, currentPage, totalPages = null) {
        const requestedTotal = totalPages ? Math.max(1, Number(totalPages) || 0) : null;
        const page = Math.max(0, Number(currentPage) || 0);
        const total = requestedTotal ? Math.max(page, requestedTotal) : null;
        const status = page > 0 ? 'reading' : 'pending';

        await db.execute(
            `INSERT INTO reading_backlog (user_id, material_id, current_page, total_pages, status)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE current_page = VALUES(current_page),
                                     total_pages = COALESCE(VALUES(total_pages), total_pages),
                                     status = VALUES(status),
                                     updated_at = CURRENT_TIMESTAMP`,
            [userId, materialId, page, total, status]
        );
        return this.getProgress(userId, materialId);
    }

    async listBacklog(userId) {
        const [rows] = await db.execute(
            `SELECT material_id AS materialId, current_page AS currentPage, total_pages AS totalPages,
                    status, created_at AS createdAt, updated_at AS updatedAt
               FROM reading_backlog WHERE user_id = ? ORDER BY updated_at DESC`,
            [userId]
        );
        return rows.map(mapProgress);
    }

    async getBacklogItem(userId, materialId) {
        return this.getProgress(userId, materialId);
    }

    async addBacklog(userId, materialId) {
        await db.execute(
            `INSERT IGNORE INTO reading_backlog (user_id, material_id, status) VALUES (?, ?, 'pending')`,
            [userId, materialId]
        );
        return this.getProgress(userId, materialId);
    }

    async removeBacklog(userId, materialId) {
        const [res] = await db.execute(
            'DELETE FROM reading_backlog WHERE user_id = ? AND material_id = ?',
            [userId, materialId]
        );
        return res.affectedRows > 0;
    }

    async countFavorites(userId) {
        const [rows] = await db.execute(
            'SELECT COUNT(*) AS total FROM material_favorites WHERE usuario_id = ?', [userId]
        );
        return Number(rows[0].total) || 0;
    }

    async listFlags(userId, materialIds = []) {
        const ids = [...new Set(materialIds.map(Number).filter(Boolean))];
        const empty = { reads: new Set(), backlog: new Map() };
        if (!ids.length) return empty;
        const placeholders = ids.map(() => '?').join(',');

        const [reads] = await db.execute(
            `SELECT material_id FROM material_reads WHERE user_id = ? AND material_id IN (${placeholders})`,
            [userId, ...ids]
        );
        const [backlog] = await db.execute(
            `SELECT material_id AS materialId, current_page AS currentPage, total_pages AS totalPages, status
               FROM reading_backlog WHERE user_id = ? AND material_id IN (${placeholders})`,
            [userId, ...ids]
        );
        return {
            reads: new Set(reads.map(row => Number(row.material_id))),
            backlog: new Map(backlog.map(row => [Number(row.materialId), mapProgress(row)]))
        };
    }

    async listFollowers(userId) {
        const [rows] = await db.execute(
            'SELECT subscriber_id AS id FROM user_subscriptions WHERE target_user_id = ?', [userId]
        );
        return rows.map(row => Number(row.id));
    }

    async listFollowing(userId) {
        const [rows] = await db.execute(
            'SELECT target_user_id AS id FROM user_subscriptions WHERE subscriber_id = ?', [userId]
        );
        return rows.map(row => Number(row.id));
    }

    async countFollowers(userId) {
        const [rows] = await db.execute(
            'SELECT COUNT(*) AS total FROM user_subscriptions WHERE target_user_id = ?', [userId]
        );
        return Number(rows[0].total) || 0;
    }

    async countFollowing(userId) {
        const [rows] = await db.execute(
            'SELECT COUNT(*) AS total FROM user_subscriptions WHERE subscriber_id = ?', [userId]
        );
        return Number(rows[0].total) || 0;
    }

    async isFollowing(subscriberId, targetUserId) {
        const [rows] = await db.execute(
            'SELECT 1 FROM user_subscriptions WHERE subscriber_id = ? AND target_user_id = ?',
            [subscriberId, targetUserId]
        );
        return rows.length > 0;
    }

    async follow(subscriberId, targetUserId) {
        await db.execute(
            'INSERT IGNORE INTO user_subscriptions (subscriber_id, target_user_id) VALUES (?, ?)',
            [subscriberId, targetUserId]
        );
    }

    async unfollow(subscriberId, targetUserId) {
        const [res] = await db.execute(
            'DELETE FROM user_subscriptions WHERE subscriber_id = ? AND target_user_id = ?',
            [subscriberId, targetUserId]
        );
        return res.affectedRows > 0;
    }

    async getStreak(userId) {
        const [rows] = await db.execute(
            'SELECT current_streak AS currentStreak, last_read_date AS lastReadDate, updated_at AS updatedAt FROM reading_streaks WHERE user_id = ?',
            [userId]
        );
        if (!rows.length) return { currentStreak: 0, lastReadDate: null, updatedAt: null };
        return {
            currentStreak: Number(rows[0].currentStreak) || 0,
            lastReadDate: rows[0].lastReadDate,
            updatedAt: rows[0].updatedAt
        };
    }

    async registerActivity(userId) {
        const [rows] = await db.execute(
            'SELECT current_streak AS currentStreak, last_read_date AS lastReadDate FROM reading_streaks WHERE user_id = ?',
            [userId]
        );
        const todayKey = new Date().toISOString().slice(0, 10);
        let current = 1;
        let extended = true;

        if (rows.length) {
            const row = rows[0];
            const last = row.lastReadDate
                ? new Date(row.lastReadDate).toISOString().slice(0, 10)
                : null;
            const currentStored = Number(row.currentStreak) || 0;
            if (last === todayKey) {
                current = currentStored;
                extended = false;
            } else {
                const yesterday = new Date();
                yesterday.setUTCDate(yesterday.getUTCDate() - 1);
                const yesterdayKey = yesterday.toISOString().slice(0, 10);
                current = last === yesterdayKey ? currentStored + 1 : 1;
            }
            await db.execute(
                'UPDATE reading_streaks SET current_streak = ?, last_read_date = ? WHERE user_id = ?',
                [current, todayKey, userId]
            );
        } else {
            await db.execute(
                'INSERT INTO reading_streaks (user_id, current_streak, last_read_date) VALUES (?, 1, ?)',
                [userId, todayKey]
            );
        }
        return { currentStreak: current, lastReadDate: todayKey, extended };
    }

    async listProfilePictures() {
        const [rows] = await db.execute('SELECT rank_id AS rankId, title FROM ranks ORDER BY rank_id');
        const defaults = [1, 2, 3].map(index => ({
            key: `default-${index}`,
            label: `Default ${index}`,
            picture: `/img/profile_pictures/default-${index}.png`,
            level: 0
        }));
        const rankPictures = rows.map(row => ({
            key: `rank-${row.rankId}`,
            label: row.title,
            picture: rankPicture(row.title),
            level: Number(row.rankId)
        }));
        return [...defaults, ...rankPictures];
    }
}

module.exports = MariaDBGamificationRepository;
