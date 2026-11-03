const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../middleware/rateLimit');

function response() {
    const headers = new Map();
    return {
        headers,
        setHeader: (key, value) => headers.set(key, value),
        getHeader: key => headers.get(key)
    };
}

test('createRateLimiter allows requests up to the limit and then returns 429', () => {
    const limiter = createRateLimiter({
        windowMs: 60000,
        max: 2,
        scope: 'test',
        keyGenerator: () => 'key'
    });
    const req = { ip: '127.0.0.1' };

    let error = null;
    const first = response();
    limiter(req, first, value => { error = value; });
    assert.equal(error, undefined);
    assert.equal(first.getHeader('RateLimit-Limit'), '2');
    assert.equal(first.getHeader('RateLimit-Remaining'), '1');

    const second = response();
    limiter(req, second, value => { error = value; });
    assert.equal(error, undefined);
    assert.equal(second.getHeader('RateLimit-Remaining'), '0');

    const third = response();
    limiter(req, third, value => { error = value; });
    assert.equal(error.status, 429);
    assert.ok(Number(third.getHeader('Retry-After')) >= 1);
});
