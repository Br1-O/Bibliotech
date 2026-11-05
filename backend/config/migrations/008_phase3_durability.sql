-- Phase 3: durable side effects, idempotent audit and retention indexes.

CREATE TABLE IF NOT EXISTS outbox_events (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_type      VARCHAR(80)  NOT NULL,
    aggregate_type  VARCHAR(80)  NULL,
    aggregate_id    VARCHAR(100) NULL,
    payload         JSON         NOT NULL,
    dedupe_key      VARCHAR(191) NULL,
    status          ENUM('pending','processing','done','dead') NOT NULL DEFAULT 'pending',
    attempts        INT UNSIGNED NOT NULL DEFAULT 0,
    available_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at       DATETIME     NULL,
    locked_by       VARCHAR(100) NULL,
    last_error      TEXT         NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    processed_at    DATETIME     NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_outbox_dedupe (dedupe_key),
    KEY idx_outbox_pending (status, available_at, id),
    KEY idx_outbox_type_created (event_type, created_at),
    KEY idx_outbox_processed (status, processed_at)
) ENGINE=InnoDB;

ALTER TABLE audit_logs
    ADD COLUMN idempotency_key VARCHAR(191) NULL AFTER registro_id,
    ADD UNIQUE KEY uq_audit_idempotency (idempotency_key);

CREATE TABLE IF NOT EXISTS audit_logs_archive LIKE audit_logs;
ALTER TABLE audit_logs_archive
    ADD COLUMN archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE notifications
    ADD INDEX idx_notifications_read_created (read_at, created_at, id);
