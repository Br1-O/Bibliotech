const counters = new Map();
const durationBuckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

function labelKey(name, labels = {}) {
    const entries = Object.entries(labels)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .sort(([a], [b]) => a.localeCompare(b));
    const suffix = entries.length
        ? `{${entries.map(([key, value]) => `${key}="${String(value).replace(/["\\\n]/g, '_')}"`).join(',')}}`
        : '';
    return `${name}${suffix}`;
}

function increment(name, labels = {}, amount = 1) {
    const key = labelKey(name, labels);
    counters.set(key, (counters.get(key) || 0) + amount);
}

function observe(name, value, labels = {}) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    increment(`${name}_count`, labels);
    increment(`${name}_sum`, labels, numeric);
    for (const bucket of durationBuckets) {
        if (numeric <= bucket) increment(`${name}_bucket`, { ...labels, le: bucket });
    }
    increment(`${name}_bucket`, { ...labels, le: '+Inf' });
}

function recordHttp({ method, route, status, durationMs }) {
    increment('http_requests_total', { method, route, status });
    observe('http_request_duration_ms', durationMs, { method, route });
}

function recordRateLimit(scope) {
    increment('auth_rate_limit_hits_total', { scope });
}

function recordUploadRejection(reason) {
    increment('upload_rejected_total', { reason });
}

function recordDbError(operation = 'query') {
    increment('db_errors_total', { operation });
}

function recordMailError() {
    increment('mail_errors_total');
}

function snapshot() {
    return Object.fromEntries([...counters.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function toPrometheus() {
    return `${[...counters.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key} ${value}`)
        .join('\n')}\n`;
}

module.exports = {
    increment,
    observe,
    recordHttp,
    recordRateLimit,
    recordUploadRejection,
    recordDbError,
    recordMailError,
    snapshot,
    toPrometheus
};
