SET @token_version_exists = (
    SELECT COUNT(*)
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'token_version'
);

SET @token_version_sql = IF(
    @token_version_exists = 0,
    'ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0 AFTER profile_picture',
    'SELECT 1'
);

PREPARE token_version_stmt FROM @token_version_sql;
EXECUTE token_version_stmt;
DEALLOCATE PREPARE token_version_stmt;
