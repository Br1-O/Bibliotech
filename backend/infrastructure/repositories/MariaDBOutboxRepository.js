const db = require('../../config/db');

function parsePayload(value) {
    if (value === null || value === undefined) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(String(value)); }
    catch (error) { return { raw: String(value) }; }
}

function map(row) {
    return {
        id: Number(row.id),
        eventType: row.event_type,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        payload: parsePayload(row.payload),
        dedupeKey: row.dedupe_key,
        status: row.status,
        attempts: Number(row.attempts) || 0,
        availableAt: row.available_at,
        lockedAt: row.locked_at,
        lockedBy: row.locked_by,
        lastError: row.last_error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        processedAt: row.processed_at
    };
}

class MariaDBOutboxRepository {
    async enqueue({
        eventType,
        payload = {},
        aggregateType = null,
        aggregateId = null,
        dedupeKey = null,
        availableAt = null
    }) {
        const available = availableAt ? new Date(availableAt) : new Date();
        const [result] = await db.query(
            `INSERT INTO outbox_events
                (event_type, aggregate_type, aggregate_id, payload, dedupe_key, available_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
            [eventType, aggregateType, aggregateId, JSON.stringify(payload), dedupeKey, available]
        );
        return { id: Number(result.insertId), eventType, payload, dedupeKey };
    }

    async claimBatch(limit, workerId) {
        const size = Math.max(1, Math.min(Number(limit) || 1, 1000));
        return db.transaction(async () => {
            const [rows] = await db.query(
                `SELECT id
                   FROM outbox_events
                  WHERE status = 'pending' AND available_at <= CURRENT_TIMESTAMP
                  ORDER BY id
                  LIMIT ?
                  FOR UPDATE SKIP LOCKED`,
                [size]
            );
            if (!rows.length) return [];
            const ids = rows.map(row => Number(row.id));
            const placeholders = ids.map(() => '?').join(',');
            await db.query(
                `UPDATE outbox_events
                    SET status = 'processing', locked_at = CURRENT_TIMESTAMP, locked_by = ?
                  WHERE id IN (${placeholders}) AND status = 'pending'`,
                [workerId, ...ids]
            );
            const [claimed] = await db.query(
                `SELECT * FROM outbox_events WHERE id IN (${placeholders}) ORDER BY id`,
                ids
            );
            return claimed.map(map);
        });
    }

    async claimById(id, workerId) {
        return db.transaction(async () => {
            const [rows] = await db.query(
                `SELECT * FROM outbox_events
                  WHERE id = ? AND status = 'pending' AND available_at <= CURRENT_TIMESTAMP
                  FOR UPDATE SKIP LOCKED`,
                [id]
            );
            if (!rows.length) return null;
            await db.query(
                `UPDATE outbox_events
                    SET status = 'processing', locked_at = CURRENT_TIMESTAMP, locked_by = ?
                  WHERE id = ? AND status = 'pending'`,
                [workerId, id]
            );
            const claimed = map(rows[0]);
            claimed.status = 'processing';
            claimed.lockedBy = workerId;
            return claimed;
        });
    }

    async markDone(id) {
        const [result] = await db.query(
            `UPDATE outbox_events
                SET status = 'done', processed_at = CURRENT_TIMESTAMP,
                    locked_at = NULL, locked_by = NULL, last_error = NULL
              WHERE id = ?`,
            [id]
        );
        return result.affectedRows > 0;
    }

    async markFailed(id, { attempts, availableAt, error, dead = false } = {}) {
        const [result] = await db.query(
            `UPDATE outbox_events
                SET status = ?, attempts = ?, available_at = ?, last_error = ?,
                    locked_at = NULL, locked_by = NULL,
                    processed_at = CASE WHEN ? = 'dead' THEN CURRENT_TIMESTAMP ELSE processed_at END
              WHERE id = ?`,
            [dead ? 'dead' : 'pending', Number(attempts) || 0, new Date(availableAt), String(error || '').slice(0, 4000), dead ? 'dead' : 'pending', id]
        );
        return result.affectedRows > 0;
    }

    async releaseStale(lockedBefore, limit = 100) {
        const [result] = await db.query(
            `UPDATE outbox_events
                SET status = 'pending', locked_at = NULL, locked_by = NULL
              WHERE status = 'processing' AND locked_at < ?
              ORDER BY id
              LIMIT ?`,
            [new Date(lockedBefore), Math.max(1, Math.min(Number(limit) || 100, 1000))]
        );
        return result.affectedRows || 0;
    }

    async findById(id) {
        const [rows] = await db.query('SELECT * FROM outbox_events WHERE id = ?', [id]);
        return rows.length ? map(rows[0]) : null;
    }

    async countByStatus() {
        const [rows] = await db.query(
            'SELECT status, COUNT(*) AS total FROM outbox_events GROUP BY status'
        );
        return Object.fromEntries(rows.map(row => [row.status, Number(row.total) || 0]));
    }

    async deleteDoneBefore(cutoff, limit = 500) {
        const [result] = await db.query(
            `DELETE FROM outbox_events
              WHERE status = 'done' AND processed_at < ?
              ORDER BY id
              LIMIT ?`,
            [new Date(cutoff), Math.max(1, Math.min(Number(limit) || 500, 5000))]
        );
        return result.affectedRows || 0;
    }
}

module.exports = MariaDBOutboxRepository;
module.exports.map = map;
