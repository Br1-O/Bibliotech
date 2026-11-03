const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { getConfig } = require('../config/env');
const { createAuthMiddleware } = require('../middleware/authMiddleware');

function user(overrides = {}) {
    return {
        id: 7,
        roleNombre: 'Alumno',
        tokenVersion: 0,
        isActivo: () => true,
        ...overrides
    };
}

function tokenFor(userData, overrides = {}) {
    const config = getConfig().jwt;
    return jwt.sign({
        id: userData.id,
        role: userData.roleNombre,
        ver: userData.tokenVersion,
        ...overrides
    }, config.secret, {
        algorithm: config.algorithm,
        issuer: config.issuer,
        audience: config.audience,
        expiresIn: '5m'
    });
}

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
    };
}

test('verifyToken attaches the database user when token version and role match', async () => {
    const current = user();
    const middleware = createAuthMiddleware({
        userRepository: { findById: async () => current }
    });
    const req = { headers: { authorization: `Bearer ${tokenFor(current)}` }, t: key => key };
    const res = response();
    let nextCalled = false;

    await middleware.verifyToken(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.usuarioId, 7);
    assert.equal(req.rol, 'Alumno');
    assert.equal(req.usuario, current);
});

test('verifyToken rejects revoked tokens after token_version changes', async () => {
    const issued = user({ tokenVersion: 0 });
    const current = user({ tokenVersion: 1 });
    const middleware = createAuthMiddleware({
        userRepository: { findById: async () => current }
    });
    const req = { headers: { authorization: `Bearer ${tokenFor(issued)}` }, t: key => key };
    const res = response();

    await middleware.verifyToken(req, res, () => {});
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'errors.invalidToken');
});

test('verifyToken rejects role changes and inactive users', async () => {
    const issued = user({ roleNombre: 'Alumno' });
    const changed = user({ roleNombre: 'Profesor' });
    const middleware = createAuthMiddleware({
        userRepository: { findById: async () => changed }
    });
    const res = response();
    await middleware.verifyToken(
        { headers: { authorization: `Bearer ${tokenFor(issued)}` }, t: key => key },
        res,
        () => {}
    );
    assert.equal(res.statusCode, 401);

    const inactive = user({ isActivo: () => false });
    const inactiveMiddleware = createAuthMiddleware({
        userRepository: { findById: async () => inactive }
    });
    const inactiveRes = response();
    await inactiveMiddleware.verifyToken(
        { headers: { authorization: `Bearer ${tokenFor(inactive)}` }, t: key => key },
        inactiveRes,
        () => {}
    );
    assert.equal(inactiveRes.statusCode, 401);
});

test('optionalAuth stays anonymous for invalid tokens but propagates database errors', async () => {
    const middleware = createAuthMiddleware({
        userRepository: { findById: async () => { throw new Error('db down'); } }
    });
    const req = { headers: { authorization: 'Bearer not-a-token' }, t: key => key };
    let nextValue = null;
    await middleware.optionalAuth(req, response(), value => { nextValue = value; });
    assert.equal(nextValue, undefined);

    const dbError = new Error('db down');
    const failing = createAuthMiddleware({
        userRepository: { findById: async () => { throw dbError; } }
    });
    const valid = user();
    const validToken = tokenFor(valid);
    await failing.optionalAuth(
        { headers: { authorization: `Bearer ${validToken}` }, t: key => key },
        response(),
        value => { nextValue = value; }
    );
    assert.equal(nextValue, dbError);
});

test('optionalFileAuth attaches a user from the file cookie and stays anonymous when invalid', async () => {
    const current = user();
    const middleware = createAuthMiddleware({
        userRepository: { findById: async () => current }
    });
    const token = tokenFor(current);
    const req = { headers: { cookie: `bt_file_access=${token}` }, t: key => key };
    let nextValue = null;
    await middleware.optionalFileAuth(req, response(), value => { nextValue = value; });
    assert.equal(nextValue, undefined);
    assert.equal(req.usuarioId, 7);

    const anonymous = { headers: { cookie: 'bt_file_access=not-a-token' }, t: key => key };
    await middleware.optionalFileAuth(anonymous, response(), value => { nextValue = value; });
    assert.equal(nextValue, undefined);
    assert.equal(anonymous.usuarioId, undefined);
});
