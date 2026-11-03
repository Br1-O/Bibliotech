const { getConfig } = require('../config/env');

const LEVEL_WEIGHT = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const SENSITIVE_KEY = /(password|passwd|secret|token|authorization|cookie|api[_-]?key)/i;

function maskEmail(value) {
    const text = String(value || '');
    const at = text.indexOf('@');
    if (at <= 0) return '[redacted]';
    return `${text.slice(0, 1)}***${text.slice(at)}`;
}

function sanitize(value, key = '', depth = 0) {
    if (depth > 4) return '[truncated]';
    if (value === null || value === undefined) return value;
    if (key && SENSITIVE_KEY.test(key)) return '[redacted]';
    if (key && /email/i.test(key)) return maskEmail(value);
    if (value instanceof Error) {
        return { name: value.name, message: value.message, code: value.code || null };
    }
    if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitize(item, '', depth + 1));
    if (typeof value === 'object') {
        const result = {};
        for (const [entryKey, entryValue] of Object.entries(value)) {
            result[entryKey] = sanitize(entryValue, entryKey, depth + 1);
        }
        return result;
    }
    if (typeof value === 'string' && value.length > 1000) return `${value.slice(0, 1000)}...`;
    return value;
}

function write(level, event, fields = {}) {
    const config = getConfig();
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[config.logging.level]) return;
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        ...sanitize(fields)
    };
    const output = JSON.stringify(entry);
    if (level === 'error') console.error(output);
    else if (level === 'warn') console.warn(output);
    else console.log(output);
}

function child(base = {}) {
    const bind = fields => ({ ...base, ...fields });
    return {
        debug: (event, fields = {}) => write('debug', event, bind(fields)),
        info: (event, fields = {}) => write('info', event, bind(fields)),
        warn: (event, fields = {}) => write('warn', event, bind(fields)),
        error: (event, fields = {}) => write('error', event, bind(fields)),
        child: extra => child(bind(extra))
    };
}

const logger = child();

module.exports = { logger, maskEmail, sanitize };
