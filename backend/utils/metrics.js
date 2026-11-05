const counters = new Map();
const gauges = new Map();
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

function setGauge(name, labels = {}, value = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    gauges.set(labelKey(name, labels), numeric);
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

function recordMailError(scope = 'email') {
    increment('mail_errors_total', { scope });
}

function recordMailSent(scope = 'email') {
    increment('mail_sent_total', { scope });
}

function recordOutboxEnqueued(eventType) {
    increment('outbox_events_enqueued_total', { event_type: eventType });
}

function recordOutboxProcessed(eventType, durationMs) {
    increment('outbox_events_processed_total', { event_type: eventType });
    observe('outbox_processing_duration_ms', durationMs, { event_type: eventType });
}

function recordOutboxFailed(eventType) {
    increment('outbox_events_failed_total', { event_type: eventType });
}

function recordOutboxDead(eventType) {
    increment('outbox_events_dead_total', { event_type: eventType });
}

function recordOutboxRetry(eventType) {
    increment('outbox_events_retried_total', { event_type: eventType });
}

function recordSecurityEvent(type, route = 'unmatched') {
    increment('security_events_total', { type, route });
}

function snapshot() {
    return {
        ...Object.fromEntries([...counters.entries()].sort(([a], [b]) => a.localeCompare(b))),
        ...Object.fromEntries([...gauges.entries()].sort(([a], [b]) => a.localeCompare(b)))
    };
}

function toPrometheus() {
    return `${[...counters.entries(), ...gauges.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key} ${value}`)
        .join('\n')}\n`;
}

module.exports = {
    increment,
    setGauge,
    observe,
    recordHttp,
    recordRateLimit,
    recordUploadRejection,
    recordDbError,
    recordMailError,
    recordMailSent,
    recordOutboxEnqueued,
    recordOutboxProcessed,
    recordOutboxFailed,
    recordOutboxDead,
    recordOutboxRetry,
    recordSecurityEvent,
    snapshot,
    toPrometheus
};
