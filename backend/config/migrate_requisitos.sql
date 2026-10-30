-- =====================================================================
--  Migracion de requisitos: perfil ampliado, paginas y backlog
--  Ejecutar una sola vez sobre una base existente (MySQL/MariaDB):
--    mysql -u usuario -p bibliotech < backend/config/migrate_requisitos.sql
-- =====================================================================
SET NAMES utf8mb4;

ALTER TABLE users
    ADD COLUMN birthdate DATE NULL AFTER estado,
    ADD COLUMN gender_custom VARCHAR(10) NULL AFTER gender,
    ADD COLUMN linkedin VARCHAR(255) NOT NULL DEFAULT '-' AFTER instagram,
    ADD COLUMN career VARCHAR(80) NOT NULL DEFAULT '-' AFTER linkedin,
    ADD COLUMN institute VARCHAR(80) NOT NULL DEFAULT '-' AFTER career,
    ADD COLUMN about_me VARCHAR(300) NOT NULL DEFAULT '-' AFTER institute;

-- Conserva una aproximacion de la edad existente antes de retirar la columna.
UPDATE users
   SET birthdate = DATE_SUB(CURDATE(), INTERVAL age YEAR)
 WHERE age IS NOT NULL;

ALTER TABLE users
    MODIFY gender VARCHAR(30) NULL;

UPDATE users
   SET gender = NULL
 WHERE gender IS NOT NULL AND gender NOT IN ('Male','Female','Non-Binary','Other');

ALTER TABLE users
    MODIFY gender ENUM('Male','Female','Non-Binary','Other') NULL;

ALTER TABLE users DROP COLUMN age;

ALTER TABLE materials
    ADD COLUMN pages INT NULL AFTER descripcion;

-- El backlog deja de admitir el estado "completed": las lecturas terminadas
-- pasan exclusivamente a material_reads.
INSERT IGNORE INTO material_reads (user_id, material_id, created_at)
SELECT user_id, material_id, COALESCE(updated_at, created_at)
  FROM reading_backlog
 WHERE status = 'completed';

DELETE FROM reading_backlog WHERE status = 'completed';

ALTER TABLE reading_backlog
    MODIFY status ENUM('pending','reading') NOT NULL DEFAULT 'pending';
