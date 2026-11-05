-- Triggers recreated after a dump restore.
-- Keep in sync with migrations 006 and 007. mysqldump emits trigger definitions
-- inside executable comments with an internal delimiter, which the MySQL 8.4
-- server rejects during a scripted restore.

DROP TRIGGER IF EXISTS audit_logs_no_update;
CREATE TRIGGER audit_logs_no_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only';

DROP TRIGGER IF EXISTS audit_logs_no_delete;
CREATE TRIGGER audit_logs_no_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only';

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
