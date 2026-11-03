SET @actor_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'actor_id'
);
SET @actor_sql = IF(@actor_exists = 0,
    'ALTER TABLE notifications ADD COLUMN actor_id INT NULL AFTER usuario_id', 'SELECT 1');
PREPARE actor_stmt FROM @actor_sql; EXECUTE actor_stmt; DEALLOCATE PREPARE actor_stmt;

SET @type_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type'
);
SET @type_sql = IF(@type_exists = 0,
    'ALTER TABLE notifications ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT ''material'' AFTER material_id', 'SELECT 1');
PREPARE type_stmt FROM @type_sql; EXECUTE type_stmt; DEALLOCATE PREPARE type_stmt;

SET @message_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'message'
);
SET @message_sql = IF(@message_exists = 0,
    'ALTER TABLE notifications ADD COLUMN message VARCHAR(255) NULL AFTER type', 'SELECT 1');
PREPARE message_stmt FROM @message_sql; EXECUTE message_stmt; DEALLOCATE PREPARE message_stmt;

ALTER TABLE notifications MODIFY subject_id INT NULL, MODIFY material_id INT NULL;

SET @has_unique = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
       AND INDEX_NAME = 'uq_notification_usuario_material'
);
SET @unique_has_type = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
       AND INDEX_NAME = 'uq_notification_usuario_material' AND COLUMN_NAME = 'type'
);
SET @drop_unique_sql = IF(@has_unique > 0 AND @unique_has_type = 0,
    'ALTER TABLE notifications DROP INDEX uq_notification_usuario_material', 'SELECT 1');
PREPARE drop_unique_stmt FROM @drop_unique_sql; EXECUTE drop_unique_stmt; DEALLOCATE PREPARE drop_unique_stmt;

SET @new_unique_sql = IF(@unique_has_type = 0,
    'ALTER TABLE notifications ADD UNIQUE KEY uq_notification_usuario_material (usuario_id, type, subject_id, material_id)',
    'SELECT 1');
PREPARE new_unique_stmt FROM @new_unique_sql; EXECUTE new_unique_stmt; DEALLOCATE PREPARE new_unique_stmt;

SET @actor_fk_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
       AND CONSTRAINT_NAME = 'fk_notifications_actor'
);
SET @actor_fk_sql = IF(@actor_fk_exists = 0,
    'ALTER TABLE notifications ADD CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL',
    'SELECT 1');
PREPARE actor_fk_stmt FROM @actor_fk_sql; EXECUTE actor_fk_stmt; DEALLOCATE PREPARE actor_fk_stmt;
