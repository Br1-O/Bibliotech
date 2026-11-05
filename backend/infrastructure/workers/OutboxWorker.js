const { logger } = require('../../utils/logger');
const metrics = require('../../utils/metrics');

class OutboxWorker {
    constructor({
        outboxService,
        intervalMs = 1000,
        batchSize = 20,
        staleMs = 300000,
        loggerInstance = logger
    } = {}) {
        this.outboxService = outboxService;
        this.intervalMs = Math.max(250, Number(intervalMs) || 1000);
        this.batchSize = Math.max(1, Number(batchSize) || 20);
        this.staleMs = Math.max(1000, Number(staleMs) || 300000);
        this.logger = loggerInstance;
        this.timer = null;
        this.running = false;
        this.lastStaleCheck = 0;
        this.lastGaugeUpdate = 0;
    }

    async start() {
        if (this.timer) return;
        await this.releaseStale();
        await this.updateGauges();
        this.timer = setInterval(() => {
            this.poll().catch(error => this.logger.error('outbox.worker_failed', { error }));
        }, this.intervalMs);
        this.timer.unref?.();
        this.poll().catch(error => this.logger.error('outbox.worker_failed', { error }));
        this.logger.info('outbox.worker_started', {
            intervalMs: this.intervalMs,
            batchSize: this.batchSize
        });
    }

    async stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        while (this.running) {
            await new Promise(resolve => setTimeout(resolve, 25));
        }
        this.logger.info('outbox.worker_stopped');
    }

    async releaseStale() {
        if (Date.now() - this.lastStaleCheck < Math.min(this.staleMs, 60000)) return 0;
        this.lastStaleCheck = Date.now();
        const released = await this.outboxService.outboxRepository.releaseStale(
            new Date(Date.now() - this.staleMs)
        );
        if (released) this.logger.warn('outbox.stale_events_released', { released });
        return released;
    }

    async poll() {
        if (this.running) return 0;
        this.running = true;
        try {
            await this.releaseStale().catch(error => {
                this.logger.warn('outbox.stale_check_failed', { error });
            });
            const processed = await this.outboxService.processBatch(this.batchSize);
            if (processed || Date.now() - this.lastGaugeUpdate >= 10000) {
                await this.updateGauges();
            }
            return processed;
        } finally {
            this.running = false;
        }
    }

    async updateGauges() {
        const counts = await this.outboxService.countByStatus();
        for (const status of ['pending', 'processing', 'done', 'dead']) {
            metrics.setGauge('outbox_events', { status }, counts[status] || 0);
        }
        this.lastGaugeUpdate = Date.now();
    }
}

module.exports = OutboxWorker;
