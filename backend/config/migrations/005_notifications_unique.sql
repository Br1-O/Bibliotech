-- Make notification uniqueness null-safe without resetting read state on duplicates.

DELETE newer
  FROM notifications newer
  INNER JOIN notifications older
    ON newer.usuario_id = older.usuario_id
   AND newer.type = older.type
   AND newer.subject_id <=> older.subject_id
   AND newer.material_id <=> older.material_id
   AND newer.message <=> older.message
   AND newer.id > older.id;

SET @old_unique = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
       AND INDEX_NAME = 'uq_notification_usuario_material'
);
SET @drop_old_sql = IF(@old_unique > 0,
    'ALTER TABLE notifications DROP INDEX uq_notification_usuario_material', 'SELECT 1');
PREPARE drop_old_stmt FROM @drop_old_sql; EXECUTE drop_old_stmt; DEALLOCATE PREPARE drop_old_stmt;

SET @subject_key_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'subject_key'
);
SET @subject_key_sql = IF(@subject_key_exists = 0,
    'ALTER TABLE notifications ADD COLUMN subject_key INT AS (IFNULL(subject_id, 0)) VIRTUAL AFTER subject_id',
    'SELECT 1');
PREPARE subject_key_stmt FROM @subject_key_sql; EXECUTE subject_key_stmt; DEALLOCATE PREPARE subject_key_stmt;

SET @material_key_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'material_key'
);
SET @material_key_sql = IF(@material_key_exists = 0,
    'ALTER TABLE notifications ADD COLUMN material_key INT AS (IFNULL(material_id, 0)) VIRTUAL AFTER material_id',
    'SELECT 1');
PREPARE material_key_stmt FROM @material_key_sql; EXECUTE material_key_stmt; DEALLOCATE PREPARE material_key_stmt;

SET @message_key_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'message_key'
);
SET @message_key_sql = IF(@message_key_exists = 0,
    'ALTER TABLE notifications ADD COLUMN message_key VARCHAR(255) AS (IFNULL(message, '''')) VIRTUAL AFTER message',
    'SELECT 1');
PREPARE message_key_stmt FROM @message_key_sql; EXECUTE message_key_stmt; DEALLOCATE PREPARE message_key_stmt;

SET @new_unique = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
       AND INDEX_NAME = 'uq_notification_event'
);
SET @new_unique_sql = IF(@new_unique = 0,
    'ALTER TABLE notifications ADD UNIQUE KEY uq_notification_event (usuario_id, type, subject_key, material_key, message_key)',
    'SELECT 1');
PREPARE new_unique_stmt FROM @new_unique_sql; EXECUTE new_unique_stmt; DEALLOCATE PREPARE new_unique_stmt;
