CREATE TABLE IF NOT EXISTS notifications (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id   INT NOT NULL,
    subject_id   INT NOT NULL,
    material_id  INT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at      DATETIME NULL,
    UNIQUE KEY uq_notification_usuario_material (usuario_id, subject_id, material_id),
    INDEX idx_notifications_inbox (usuario_id, read_at, created_at),
    CONSTRAINT fk_notifications_usuario  FOREIGN KEY (usuario_id)  REFERENCES users(id)     ON DELETE CASCADE,
    CONSTRAINT fk_notifications_subject  FOREIGN KEY (subject_id)  REFERENCES subjects(id)  ON DELETE CASCADE,
    CONSTRAINT fk_notifications_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);
