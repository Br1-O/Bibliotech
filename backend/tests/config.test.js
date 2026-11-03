const test = require('node:test');
const assert = require('node:assert/strict');
const { validateConfig, estimateEntropyBits, FALLBACK_SECRETS } = require('../config/env');

const strongSecret = 'Q7v!m2R#x9L@p4T$z8K&w1N*e6C^h3J%';
const baseEnv = {
    NODE_ENV: 'development',
    DB_HOST: 'localhost',
    DB_USER: 'bibliotech',
    DB_NAME: 'bibliotech',
    JWT_SECRET: strongSecret
};

test('validateConfig accepts a minimal development configuration', () => {
    const config = validateConfig(baseEnv);
    assert.equal(config.port, 3000);
    assert.equal(config.jwt.algorithm, 'HS256');
    assert.equal(config.security.exposeDevTokens, false);
    assert.deepEqual(config.cors.origins, ['http://localhost:3000', 'http://127.0.0.1:3000']);
});

test('validateConfig rejects short, fallback and low-entropy secrets', () => {
    assert.throws(() => validateConfig({ ...baseEnv, JWT_SECRET: 'short' }), /at least 32 characters/);
    assert.throws(() => validateConfig({ ...baseEnv, JWT_SECRET: 'change-me' }), /known or default/);
    assert.throws(() => validateConfig({ ...baseEnv, JWT_SECRET: 'a'.repeat(40) }), /128 bits/);
    assert.equal(FALLBACK_SECRETS.has('change-me'), true);
});

test('validateConfig rejects wildcard CORS and missing production CORS', () => {
    assert.throws(() => validateConfig({ ...baseEnv, CORS_ORIGINS: '*' }), /wildcard/);
    assert.throws(() => validateConfig({ ...baseEnv, NODE_ENV: 'production' }), /CORS_ORIGINS is required/);
    assert.throws(
        () => validateConfig({ ...baseEnv, NODE_ENV: 'production', CORS_ORIGINS: 'https://example.com', EXPOSE_DEV_TOKENS: 'true' }),
        /EXPOSE_DEV_TOKENS/
    );
});

test('validateConfig requires a metrics token in production when metrics are enabled', () => {
    assert.throws(
        () => validateConfig({
            ...baseEnv,
            NODE_ENV: 'production',
            CORS_ORIGINS: 'https://example.com',
            METRICS_ENABLED: 'true'
        }),
        /METRICS_TOKEN/
    );
});

test('estimateEntropyBits grows with character diversity', () => {
    assert.ok(estimateEntropyBits(strongSecret) >= 128);
    assert.ok(estimateEntropyBits('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') < 128);
});
