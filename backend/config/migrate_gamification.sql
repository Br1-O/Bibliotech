-- =====================================================================
--  Bibliotech - Migracion de perfil, categorias, lecturas y gamificacion
--  Idempotente para MariaDB 10.x / MySQL 8.x.
--  No elimina registros: solo crea/ajusta el esquema necesario.
-- =====================================================================
SET NAMES utf8mb4;

DELIMITER $$

DROP PROCEDURE IF EXISTS bt_add_column$$
CREATE PROCEDURE bt_add_column(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition TEXT)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

DROP PROCEDURE IF EXISTS bt_drop_column$$
CREATE PROCEDURE bt_drop_column(IN p_table VARCHAR(64), IN p_column VARCHAR(64))
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` DROP COLUMN `', p_column, '`');
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

DROP PROCEDURE IF EXISTS bt_rename_column$$
CREATE PROCEDURE bt_rename_column(IN p_table VARCHAR(64), IN p_old VARCHAR(64), IN p_new VARCHAR(64), IN p_definition TEXT)
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_old)
       AND NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_new) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` CHANGE COLUMN `', p_old, '` `', p_new, '` ', p_definition);
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

DROP PROCEDURE IF EXISTS bt_add_fk$$
CREATE PROCEDURE bt_add_fk(IN p_table VARCHAR(64), IN p_name VARCHAR(64), IN p_definition TEXT)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = p_table
           AND CONSTRAINT_NAME = p_name AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD CONSTRAINT `', p_name, '` ', p_definition);
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

DROP PROCEDURE IF EXISTS bt_drop_index$$
CREATE PROCEDURE bt_drop_index(IN p_table VARCHAR(64), IN p_index VARCHAR(64))
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` DROP INDEX `', p_index, '`');
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------
-- 1. Categorias
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    slug         VARCHAR(50)  NOT NULL UNIQUE,
    nombre       VARCHAR(100) NOT NULL,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO categories (id, slug, nombre) VALUES
    (1,  'fiction',     'Ficción'),
    (2,  'literature',  'Literatura'),
    (3,  'poetry',      'Poesía'),
    (4,  'drama',       'Drama'),
    (5,  'technical',   'Técnico'),
    (6,  'science',     'Ciencia'),
    (7,  'business',    'Negocios'),
    (8,  'education',   'Educación'),
    (9,  'medicine',    'Medicina'),
    (10, 'law',         'Derecho'),
    (11, 'non-fiction', 'No ficción'),
    (12, 'self-help',   'Autoayuda'),
    (13, 'biography',   'Biografía'),
    (14, 'history',     'Historia'),
    (15, 'philosophy',  'Filosofía'),
    (16, 'religion',    'Religión'),
    (17, 'arts',        'Artes'),
    (18, 'hobbies',     'Pasatiempos'),
    (19, 'travel',      'Viajes'),
    (20, 'sports',      'Deportes'),
    (21, 'cooking',     'Cocina'),
    (22, 'kids',        'Infantil'),
    (23, 'young-adult', 'Juvenil')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- ---------------------------------------------------------------------
-- 2. Rangos y campos de perfil/gamificacion en users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ranks (
    rank_id  INT PRIMARY KEY,
    title    VARCHAR(100) NOT NULL UNIQUE,
    min_xp   INT          NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Compatibilidad con el esquema preliminar (level/nombre/picture).
CALL bt_rename_column('ranks', 'level', 'rank_id', 'INT NOT NULL');
CALL bt_rename_column('ranks', 'nombre', 'title', 'VARCHAR(100) NOT NULL');
CALL bt_drop_column('ranks', 'picture');
CALL bt_drop_column('ranks', 'created_at');

INSERT INTO ranks (rank_id, title, min_xp) VALUES
    (1, 'Entusiasta de Hello World', 0),
    (2, 'Estudiante de Sintaxis',    100),
    (3, 'Escritor de Scripts',       300),
    (4, 'Creador de Módulos',        700),
    (5, 'Constructor de Sistemas',   1300),
    (6, 'Analista de Patrones',      2100),
    (7, 'Gurú del Clean Code',       3200),
    (8, 'Arquitecto de Software',    4800),
    (9, 'Root de la Biblioteca',     7000)
ON DUPLICATE KEY UPDATE title = VALUES(title), min_xp = VALUES(min_xp);

CALL bt_add_column('users', 'age', 'INT NULL');
CALL bt_add_column('users', 'gender', 'VARCHAR(30) NOT NULL DEFAULT ''-''');
CALL bt_add_column('users', 'city', 'VARCHAR(100) NOT NULL DEFAULT ''-''');
CALL bt_add_column('users', 'country', 'VARCHAR(100) NOT NULL DEFAULT ''-''');
CALL bt_add_column('users', 'github', 'VARCHAR(255) NOT NULL DEFAULT ''-''');
CALL bt_add_column('users', 'instagram', 'VARCHAR(255) NOT NULL DEFAULT ''-''');
CALL bt_add_column('users', 'phone', 'VARCHAR(30) NOT NULL DEFAULT ''-''');
CALL bt_add_column('users', 'xp', 'INT NOT NULL DEFAULT 0');
CALL bt_add_column('users', 'rank_level', 'INT NOT NULL DEFAULT 1');
CALL bt_add_column('users', 'profile_picture', 'VARCHAR(255) NOT NULL DEFAULT ''/img/profile_pictures/default-1.png''');
CALL bt_add_fk('users', 'fk_users_rank', 'FOREIGN KEY (rank_level) REFERENCES ranks(rank_id)');

-- ---------------------------------------------------------------------
-- 3. Categoria y autor en materials
-- ---------------------------------------------------------------------
CALL bt_add_column('materials', 'uploaded_by', 'INT NULL');
CALL bt_add_column('materials', 'author', 'VARCHAR(150) NULL');
CALL bt_add_column('materials', 'category_id', 'INT NOT NULL DEFAULT 5');
UPDATE materials SET uploaded_by = autor_id WHERE uploaded_by IS NULL;
UPDATE materials SET category_id = 5 WHERE category_id IS NULL OR category_id = 0;
CALL bt_add_fk('materials', 'fk_materials_uploader', 'FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL');
CALL bt_add_fk('materials', 'fk_materials_category', 'FOREIGN KEY (category_id) REFERENCES categories(id)');

-- ---------------------------------------------------------------------
-- 4. Obligatoriedad por materia
-- ---------------------------------------------------------------------
CALL bt_add_column('material_subjects', 'is_mandatory', 'TINYINT(1) NOT NULL DEFAULT 0');

-- ---------------------------------------------------------------------
-- 5. Notificaciones generalizadas
-- ---------------------------------------------------------------------
ALTER TABLE notifications
    MODIFY COLUMN subject_id  INT NULL,
    MODIFY COLUMN material_id INT NULL;
CALL bt_add_column('notifications', 'actor_id', 'INT NULL');
CALL bt_add_column('notifications', 'type', 'VARCHAR(50) NOT NULL DEFAULT ''material''');
CALL bt_add_column('notifications', 'message', 'VARCHAR(255) NULL');
CALL bt_add_fk('notifications', 'fk_notifications_actor', 'FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL');
CALL bt_drop_index('notifications', 'uq_notification_usuario_material');

SET @idx_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
       AND INDEX_NAME = 'uq_notification_usuario_material'
);
SET @ddl = IF(@idx_exists = 0,
    'ALTER TABLE notifications ADD UNIQUE KEY uq_notification_usuario_material (usuario_id, type, subject_id, material_id)',
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- 6. Lecturas, backlog, seguidores, rachas e insignias (nombres del PRD)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_reads (
    user_id      INT NOT NULL,
    material_id  INT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, material_id),
    INDEX idx_material_reads_material (material_id),
    CONSTRAINT fk_reads_user     FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
    CONSTRAINT fk_reads_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CALL bt_rename_column('material_reads', 'usuario_id', 'user_id', 'INT NOT NULL');
CALL bt_drop_column('material_reads', 'current_page');
CALL bt_drop_column('material_reads', 'total_pages');
CALL bt_drop_column('material_reads', 'progress');
CALL bt_drop_column('material_reads', 'last_read_at');

CREATE TABLE IF NOT EXISTS reading_backlog (
    user_id       INT NOT NULL,
    material_id   INT NOT NULL,
    current_page  INT NOT NULL DEFAULT 0,
    total_pages   INT NULL,
    status        ENUM('pending','reading','completed') NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, material_id),
    INDEX idx_backlog_material (material_id),
    CONSTRAINT fk_backlog_user     FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
    CONSTRAINT fk_backlog_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$
DROP PROCEDURE IF EXISTS bt_migrate_backlog_status$$
CREATE PROCEDURE bt_migrate_backlog_status()
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reading_backlog' AND COLUMN_NAME = 'completed') THEN
        UPDATE reading_backlog SET status = 'completed' WHERE completed = 1 AND status <> 'completed';
    END IF;
END$$
DELIMITER ;

CALL bt_rename_column('reading_backlog', 'usuario_id', 'user_id', 'INT NOT NULL');
CALL bt_add_column('reading_backlog', 'current_page', 'INT NOT NULL DEFAULT 0');
CALL bt_add_column('reading_backlog', 'total_pages', 'INT NULL');
CALL bt_add_column('reading_backlog', 'status', 'ENUM(''pending'',''reading'',''completed'') NOT NULL DEFAULT ''pending''');
CALL bt_add_column('reading_backlog', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
CALL bt_migrate_backlog_status();
CALL bt_drop_column('reading_backlog', 'completed');
CALL bt_drop_column('reading_backlog', 'completed_at');

CREATE TABLE IF NOT EXISTS user_subscriptions (
    subscriber_id  INT NOT NULL,
    target_user_id INT NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subscriber_id, target_user_id),
    INDEX idx_user_subscriptions_target (target_user_id),
    CONSTRAINT fk_usub_subscriber FOREIGN KEY (subscriber_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_usub_target     FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CALL bt_rename_column('user_subscriptions', 'seguidor_id', 'subscriber_id', 'INT NOT NULL');
CALL bt_rename_column('user_subscriptions', 'seguido_id', 'target_user_id', 'INT NOT NULL');
CALL bt_drop_index('user_subscriptions', 'idx_user_subscriptions_followed');

CREATE TABLE IF NOT EXISTS reading_streaks (
    user_id         INT PRIMARY KEY,
    current_streak  INT NOT NULL DEFAULT 0,
    last_read_date  DATE NULL,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_streaks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CALL bt_rename_column('reading_streaks', 'usuario_id', 'user_id', 'INT NOT NULL');
CALL bt_rename_column('reading_streaks', 'last_activity', 'last_read_date', 'DATE NULL');
CALL bt_drop_column('reading_streaks', 'longest_streak');

CREATE TABLE IF NOT EXISTS user_badges (
    user_id     INT NOT NULL,
    badge_key   VARCHAR(50) NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, badge_key),
    CONSTRAINT fk_badges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CALL bt_rename_column('user_badges', 'usuario_id', 'user_id', 'INT NOT NULL');
CALL bt_rename_column('user_badges', 'earned_at', 'unlocked_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

DROP PROCEDURE IF EXISTS bt_migrate_backlog_status;
DROP PROCEDURE IF EXISTS bt_add_column;
DROP PROCEDURE IF EXISTS bt_drop_column;
DROP PROCEDURE IF EXISTS bt_rename_column;
DROP PROCEDURE IF EXISTS bt_add_fk;
DROP PROCEDURE IF EXISTS bt_drop_index;
