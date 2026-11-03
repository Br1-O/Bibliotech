-- Phase 1: durable reading sessions, XP ledger and subject association requests.

CREATE TABLE IF NOT EXISTS reading_sessions (
    user_id            INT NOT NULL,
    material_id        INT NOT NULL,
    active_seconds     INT NOT NULL DEFAULT 0,
    started_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, material_id),
    INDEX idx_reading_sessions_updated (last_heartbeat_at),
    CONSTRAINT fk_reading_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_reading_sessions_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS xp_ledger (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    source      VARCHAR(40) NOT NULL,
    source_id   VARCHAR(64) NOT NULL DEFAULT '',
    amount      INT NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_xp_ledger_event (user_id, source, source_id),
    INDEX idx_xp_ledger_user (user_id, created_at),
    CONSTRAINT fk_xp_ledger_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subject_association_requests (
    subject_id   INT NOT NULL,
    profesor_id  INT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subject_id, profesor_id),
    INDEX idx_subject_association_requests_profesor (profesor_id),
    CONSTRAINT fk_sar_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT fk_sar_profesor FOREIGN KEY (profesor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- A subject without an assigned professor must not remain active.
UPDATE subjects s
   SET s.estado_asociacion = 'Pendiente'
 WHERE s.profesor_id IS NULL
   AND NOT EXISTS (
       SELECT 1 FROM subject_professors sp WHERE sp.subject_id = s.id
   );
