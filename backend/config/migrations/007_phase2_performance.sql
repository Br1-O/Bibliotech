-- Phase 2: searchable projections, normalized tags, audit type and hot-path indexes.

CREATE TABLE IF NOT EXISTS material_search (
    material_id  INT NOT NULL PRIMARY KEY,
    search_text  TEXT NOT NULL,
    FULLTEXT KEY ft_material_search (search_text),
    CONSTRAINT fk_material_search_material FOREIGN KEY (material_id)
        REFERENCES materials(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_search (
    user_id      INT NOT NULL PRIMARY KEY,
    search_text  TEXT NOT NULL,
    FULLTEXT KEY ft_user_search (search_text),
    CONSTRAINT fk_user_search_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS material_tags (
    material_id  INT NOT NULL,
    tag          VARCHAR(100) NOT NULL,
    PRIMARY KEY (material_id, tag),
    INDEX idx_material_tags_tag (tag, material_id),
    CONSTRAINT fk_material_tags_material FOREIGN KEY (material_id)
        REFERENCES materials(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO material_search (material_id, search_text)
SELECT id, CONCAT_WS(' ', titulo, author, categories, descripcion) FROM materials;

INSERT IGNORE INTO user_search (user_id, search_text)
SELECT id, CONCAT_WS(' ', nombre, apellido, email) FROM users;

DROP TRIGGER IF EXISTS materials_search_after_insert;
CREATE TRIGGER materials_search_after_insert
AFTER INSERT ON materials
FOR EACH ROW
INSERT INTO material_search (material_id, search_text)
VALUES (NEW.id, CONCAT_WS(' ', NEW.titulo, NEW.author, NEW.categories, NEW.descripcion))
ON DUPLICATE KEY UPDATE search_text = VALUES(search_text);

DROP TRIGGER IF EXISTS materials_search_after_update;
CREATE TRIGGER materials_search_after_update
AFTER UPDATE ON materials
FOR EACH ROW
INSERT INTO material_search (material_id, search_text)
VALUES (NEW.id, CONCAT_WS(' ', NEW.titulo, NEW.author, NEW.categories, NEW.descripcion))
ON DUPLICATE KEY UPDATE search_text = VALUES(search_text);

DROP TRIGGER IF EXISTS users_search_after_insert;
CREATE TRIGGER users_search_after_insert
AFTER INSERT ON users
FOR EACH ROW
INSERT INTO user_search (user_id, search_text)
VALUES (NEW.id, CONCAT_WS(' ', NEW.nombre, NEW.apellido, NEW.email))
ON DUPLICATE KEY UPDATE search_text = VALUES(search_text);

DROP TRIGGER IF EXISTS users_search_after_update;
CREATE TRIGGER users_search_after_update
AFTER UPDATE ON users
FOR EACH ROW
INSERT INTO user_search (user_id, search_text)
VALUES (NEW.id, CONCAT_WS(' ', NEW.nombre, NEW.apellido, NEW.email))
ON DUPLICATE KEY UPDATE search_text = VALUES(search_text);

INSERT IGNORE INTO material_tags (material_id, tag)
SELECT material_id, tag
FROM (
    SELECT m.id AS material_id,
           LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(m.categories, ',', numbers.n), ',', -1))) AS tag
      FROM materials m
      JOIN (
          SELECT ones.n + tens.n * 10 + 1 AS n
            FROM (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) ones
           CROSS JOIN (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) tens
      ) numbers
        ON numbers.n <= 1 + LENGTH(m.categories) - LENGTH(REPLACE(m.categories, ',', ''))
     WHERE m.categories IS NOT NULL AND m.categories <> ''
) parsed
WHERE parsed.tag <> '';

ALTER TABLE materials
  ADD INDEX idx_materials_estado_created (estado, created_at, id),
  ADD INDEX idx_materials_autor_estado_created (autor_id, estado, created_at, id),
  ADD INDEX idx_materials_uploader_estado_created (uploaded_by, estado, created_at, id),
  ADD INDEX idx_materials_category_estado_created (category_id, estado, created_at, id),
  ADD INDEX idx_materials_tipo_estado_created (tipo, estado, created_at, id);

ALTER TABLE material_subjects
  ADD INDEX idx_ms_subject_state_material (subject_id, estado_aprobacion, material_id, is_mandatory),
  ADD INDEX idx_ms_material_state_subject (material_id, estado_aprobacion, subject_id);

ALTER TABLE subjects
  ADD INDEX idx_subjects_career_year_nombre (career_year_id, nombre),
  ADD INDEX idx_subjects_estado_career_year (estado_asociacion, career_year_id);

ALTER TABLE career_years
  ADD INDEX idx_career_years_career_orden (career_id, orden, nombre);

ALTER TABLE subscriptions
  ADD INDEX idx_subscriptions_materia_estado_alumno (materia_id, estado, alumno_id);

ALTER TABLE material_favorites
  ADD INDEX idx_favorites_material_user (material_id, usuario_id),
  ADD INDEX idx_favorites_user_created (usuario_id, created_at, material_id);

ALTER TABLE notifications
  ADD INDEX idx_notifications_user_created (usuario_id, created_at, id);

ALTER TABLE audit_logs
  ADD COLUMN registro_tipo VARCHAR(50) NULL AFTER usuario_id,
  ADD INDEX idx_audit_timestamp_id (timestamp, id),
  ADD INDEX idx_audit_user_timestamp (usuario_id, timestamp, id),
  ADD INDEX idx_audit_operation_timestamp (tipo_operacion, timestamp, id),
  ADD INDEX idx_audit_registro (registro_tipo, registro_id, timestamp);

ALTER TABLE reading_backlog
  ADD INDEX idx_backlog_user_updated (user_id, updated_at, material_id);

ALTER TABLE users
  ADD INDEX idx_users_role_estado (role_id, estado),
  ADD INDEX idx_users_estado (estado);

ALTER TABLE thematic_tags
  ADD INDEX idx_tags_baneado_categoria_nombre (baneado, categoria, nombre);
