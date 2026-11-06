const js = require('@eslint/js');

const nodeGlobals = {
    require: 'readonly',
    module: 'readonly',
    exports: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',
    process: 'readonly',
    console: 'readonly',
    Buffer: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    setInterval: 'readonly',
    clearInterval: 'readonly',
    setImmediate: 'readonly',
    URL: 'readonly',
    URLSearchParams: 'readonly',
    TextEncoder: 'readonly',
    fetch: 'readonly',
    AbortController: 'readonly',
    performance: 'readonly',
    queueMicrotask: 'readonly',
    FormData: 'readonly',
    Headers: 'readonly',
    Request: 'readonly',
    Response: 'readonly',
    Blob: 'readonly'
};

module.exports = [
    {
        ignores: ['node_modules/**', 'uploads/**', 'backups/**', 'coverage/**']
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'commonjs',
            globals: nodeGlobals
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^(next|_)', caughtErrors: 'none' }],
            'no-empty': 'off',
            'no-useless-escape': 'off',
            'no-control-regex': 'off',
            'no-console': 'off'
        }
    },
    {
        files: ['domain/ports/**/*.js', 'tests/**/*.js', 'scripts/**/*.js'],
        rules: {
            'no-unused-vars': 'off'
        }
    }
];
