const test = require('node:test');
const assert = require('node:assert/strict');
const GamificationService = require('../application/services/GamificationService');

const now = Date.UTC(2026, 0, 1, 12, 0, 0);
const ago = seconds => new Date(now - seconds * 1000);

test('nextActiveSeconds trusts elapsed server time and ignores client values', () => {
    assert.equal(GamificationService.nextActiveSeconds(0, ago(10), now), 10);
    assert.equal(GamificationService.nextActiveSeconds(120, ago(45), now), 165);
});

test('nextActiveSeconds caps each heartbeat gap at 120 seconds', () => {
    assert.equal(GamificationService.nextActiveSeconds(0, ago(240), now), 120);
});

test('nextActiveSeconds discards stale or future sessions', () => {
    assert.equal(GamificationService.nextActiveSeconds(200, ago(301), now), 0);
    assert.equal(GamificationService.nextActiveSeconds(200, ago(-5), now), 0);
    assert.equal(GamificationService.nextActiveSeconds(200, null, now), 0);
});

test('nextActiveSeconds limits the total daily session', () => {
    const max = 24 * 60 * 60;
    assert.equal(GamificationService.nextActiveSeconds(max - 5, ago(10), now), max);
});
