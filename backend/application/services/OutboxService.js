const db = require('../../config/db');
const { logger } = require('../../utils/logger');
const metrics = require('../../utils/metrics');

class OutboxService {
    constructor({
        outboxRepository,
        workerId = `worker-${process.pid}`,
        maxAttempts = 5,
        baseBackoffMs = 5000,
        maxBackoffMs = 300000
    } = {}) {
        this.outboxRepository = outboxRepository;
        this.workerId = workerId;
        this.maxAttempts = Math.max(1, Number(maxAttempts) || 5);
        this.baseBackoffMs = Math.max(100, Number(baseBackoffMs) || 5000);
        this.maxBackoffMs = Math.max(this.baseBackoffMs, Number(maxBackoffMs) || 300000);
        this.handlers = new Map();
    }

    registerHandler(eventType, handler) {
        if (typeof handler !== 'function') throw new Error('Outbox handler must be a function');
        this.handlers.set(eventType, handler);
        return this;
    }

    async enqueue(eventType, payload = {}, options = {}) {
        const event = await this.outboxRepository.enqueue({
            eventType,
            payload,
            aggregateType: options.aggregateType || null,
            aggregateId: options.aggregateId || null,
            dedupeKey: options.dedupeKey || null,
            availableAt: options.availableAt || null
        });
        metrics.recordOutboxEnqueued(eventType);

        if (options.immediate) {
            if (db.inTransaction()) {
                const eventId = event.id;
                db.afterCommit(() => this.processById(eventId).catch(error => {
                    logger.error('outbox.immediate_failed', { eventId, eventType, error });
                }));
            } else {
                await this.processById(event.id);
            }
        }
        return event;
    }

    async processById(eventId) {
        for (let attempt = 0; attempt < 20; attempt += 1) {
            const event = await this.outboxRepository.claimById(eventId, this.workerId);
            if (event) return this.processClaimed(event);
            const current = await this.outboxRepository.findById(eventId);
            if (!current) return false;
            if (current.status === 'done' || current.status === 'dead') return false;
            if (current.status === 'pending' && new Date(current.availableAt).getTime() > Date.now()) return false;
            if (current.status === 'pending') continue;
            await new Promise(resolve => setTimeout(resolve, 25));
        }
        return false;
    }

    async processBatch(limit = 20) {
        const events = await this.outboxRepository.claimBatch(limit, this.workerId);
        let processed = 0;
        for (const event of events) {
            if (await this.processClaimed(event)) processed += 1;
        }
        return processed;
    }

    async processClaimed(event) {
        const startedAt = process.hrtime.bigint();
        try {
            const handler = this.handlers.get(event.eventType);
            if (!handler) throw new Error(`No outbox handler registered for ${event.eventType}`);
            await handler(event.payload, event);
            await this.outboxRepository.markDone(event.id);
            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
            metrics.recordOutboxProcessed(event.eventType, durationMs);
            logger.info('outbox.processed', {
                eventId: event.id,
                eventType: event.eventType,
                attempts: event.attempts,
                durationMs: Math.round(durationMs * 100) / 100
            });
            return true;
        } catch (error) {
            const attempts = Number(event.attempts || 0) + 1;
            const dead = attempts >= this.maxAttempts;
            const delay = Math.min(this.maxBackoffMs, this.baseBackoffMs * (2 ** Math.max(0, attempts - 1)));
            const availableAt = new Date(Date.now() + delay);
            await this.outboxRepository.markFailed(event.id, {
                attempts,
                availableAt,
                error: error?.message || String(error),
                dead
            });
            metrics.recordOutboxFailed(event.eventType);
            if (dead) metrics.recordOutboxDead(event.eventType);
            else metrics.recordOutboxRetry(event.eventType);
            logger.warn(dead ? 'outbox.dead_letter' : 'outbox.retry_scheduled', {
                eventId: event.id,
                eventType: event.eventType,
                attempts,
                delayMs: dead ? null : delay,
                error
            });
            return false;
        }
    }

    async flush({ limit = 50, maxBatches = 20 } = {}) {
        let total = 0;
        for (let batch = 0; batch < maxBatches; batch += 1) {
            const processed = await this.processBatch(limit);
            total += processed;
            if (!processed) break;
        }
        return total;
    }

    async countByStatus() {
        return this.outboxRepository.countByStatus();
    }
}

module.exports = OutboxService;
