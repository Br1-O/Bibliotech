const test = require('node:test');
const assert = require('node:assert/strict');
const { ok } = require('../utils/respond');
const errorMiddleware = require('../middleware/errorMiddleware');
const AppError = require('../utils/AppError');

const response = () => {
    const state = { status: 200, body: null, headers: {} };
    return {
        state,
        setHeader(name, value) {
            state.headers[name] = value;
        },
        status(code) {
            state.status = code;
            return this;
        },
        json(body) {
            state.body = body;
            return this;
        }
    };
};

test('ok responses keep their payload and add the request id', () => {
    const res = response();
    ok({ id: 'req-1', t: (key) => key }, res, { message: 'messages.loginSuccess', token: 'x' });

    assert.equal(res.state.status, 200);
    assert.deepEqual(res.state.body, {
        message: 'messages.loginSuccess',
        token: 'x',
        requestId: 'req-1'
    });
});

test('ok responses interpolate message parameters from the payload', () => {
    const res = response();
    ok({ id: 'req-3', t: (key, params) => `${key}:${params.created}/${params.skipped}` }, res, {
        message: 'messages.batchUploaded',
        created: 2,
        skipped: 1
    });

    assert.equal(res.state.body.message, 'messages.batchUploaded:2/1');
    assert.equal(res.state.body.created, 2);
    assert.equal(res.state.body.skipped, 1);
});

test('errors expose message, code and requestId', () => {
    const res = response();
    errorMiddleware(
        new AppError('errors.forbidden', { status: 403 }),
        {
            id: 'req-2',
            t: (key) => key
        },
        res,
        () => {}
    );

    assert.equal(res.state.status, 403);
    assert.equal(res.state.body.message, 'errors.forbidden');
    assert.equal(res.state.body.code, 'errors.forbidden');
    assert.equal(res.state.body.requestId, 'req-2');
    assert.equal(res.state.headers['X-Request-Id'], 'req-2');
});
