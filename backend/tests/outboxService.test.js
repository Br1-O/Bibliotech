const test = require('node:test');
const assert = require('node:assert/strict');
const OutboxService = require('../application/services/OutboxService');

function createRepository(initialEvents = []) {
    const events = new Map(initialEvents.map(event => [event.id, { ...event }]));
    const calls = { markDone: [], markFailed: [] };
    let nextId = Math.max(0, ...events.keys()) + 1;

    return {
        events,
        calls,
        async enqueue({ eventType, payload, dedupeKey = null }) {
            if (dedupeKey) {
                const existing = [...events.values()].find(event => event.dedupeKey === dedupeKey);
                if (existing) return { id: existing.id, eventType: existing.eventType, payload: existing.payload };
            }
            const id = nextId++;
            events.set(id, {
                id,
                eventType,
                payload,
                dedupeKey,
                status: 'pending',
                attempts: 0,
                availableAt: new Date(0)
            });
            return { id, eventType, payload, dedupeKey };
        },
        async claimById(id) {
            const event = events.get(id);
            if (!event || event.status !== 'pending' || event.availableAt > new Date()) return null;
            event.status = 'processing';
            return { ...event };
        },
        async claimBatch(limit) {
            return [...events.values()]
                .filter(event => event.status === 'pending' && event.availableAt <= new Date())
                .slice(0, limit)
                .map(event => {
                    event.status = 'processing';
                    return { ...event };
                });
        },
        async markDone(id) {
            const event = events.get(id);
            event.status = 'done';
            calls.markDone.push(id);
            return true;
        },
        async markFailed(id, details) {
            const event = events.get(id);
            event.status = details.dead ? 'dead' : 'pending';
            event.attempts = details.attempts;
            event.availableAt = details.availableAt;
            calls.markFailed.push({ id, ...details });
            return true;
        },
        async countByStatus() {
            const counts = {};
            for (const event of events.values()) counts[event.status] = (counts[event.status] || 0) + 1;
            return counts;
        }
    };
}

test('immediate enqueue runs the handler and marks the event done', async () => {
    const repository = createRepository();
    const service = new OutboxService({ outboxRepository: repository });
    const handled = [];
    service.registerHandler('test.event', async (payload, event) => {
        handled.push({ payload, id: event.id });
    });

    const event = await service.enqueue('test.event', { value: 1 }, { immediate: true });

    assert.deepEqual(handled, [{ payload: { value: 1 }, id: event.id }]);
    assert.equal(repository.events.get(event.id).status, 'done');
    assert.deepEqual(repository.calls.markDone, [event.id]);
});

test('retryable failures schedule a backoff and preserve pending status', async () => {
    const repository = createRepository();
    const service = new OutboxService({
        outboxRepository: repository,
        maxAttempts: 3,
        baseBackoffMs: 100,
        maxBackoffMs: 1000
    });
    service.registerHandler('test.event', async () => {
        throw new Error('temporary');
    });

    const event = await service.enqueue('test.event', {}, { immediate: true });

    const failed = repository.calls.markFailed[0];
    assert.equal(failed.attempts, 1);
    assert.equal(failed.dead, false);
    assert.equal(failed.error, 'temporary');
    assert.ok(failed.availableAt.getTime() > Date.now());
    assert.equal(repository.events.get(event.id).status, 'pending');
});

test('the final failed attempt becomes a dead letter', async () => {
    const repository = createRepository();
    const service = new OutboxService({ outboxRepository: repository, maxAttempts: 1 });
    service.registerHandler('test.event', async () => {
        throw new Error('permanent');
    });

    const event = await service.enqueue('test.event', {}, { immediate: true });

    assert.equal(repository.calls.markFailed[0].dead, true);
    assert.equal(repository.events.get(event.id).status, 'dead');
});

test('an unregistered handler follows the retry path', async () => {
    const repository = createRepository();
    const service = new OutboxService({ outboxRepository: repository, maxAttempts: 2 });

    await service.enqueue('missing.event', {}, { immediate: true });

    assert.match(repository.calls.markFailed[0].error, /No outbox handler registered/);
    assert.equal(repository.calls.markFailed[0].dead, false);
});

test('flush drains batches until there is no pending work', async () => {
    const repository = createRepository();
    const service = new OutboxService({ outboxRepository: repository });
    const handled = [];
    service.registerHandler('test.event', async (payload, event) => {
        handled.push(event.id);
    });

    await service.enqueue('test.event', { value: 1 });
    await service.enqueue('test.event', { value: 2 });

    const processed = await service.flush({ limit: 1, maxBatches: 5 });

    assert.equal(processed, 2);
    assert.deepEqual(handled, [1, 2]);
    assert.deepEqual(await service.countByStatus(), { done: 2 });
});
