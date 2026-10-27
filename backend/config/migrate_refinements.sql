-- =====================================================================
--  Bibliotech - Migracion idempotente de mejoras de contenido
--  - Permite varios profesores por materia.
--  - Libera el archivo de materiales cancelados/rechazados para reutilizarlo.
--  - Agrega el estado Rechazado.
--  No elimina tablas ni registros existentes. MySQL 8 / MariaDB.
-- =====================================================================
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. Varios profesores por materia
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subject_professors (
    subject_id   INT NOT NULL,
    profesor_id  INT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subject_id, profesor_id),
    INDEX idx_subject_professors_profesor (profesor_id),
    CONSTRAINT fk_sp_subject  FOREIGN KEY (subject_id)  REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT fk_sp_profesor FOREIGN KEY (profesor_id) REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO subject_professors (subject_id, profesor_id)
SELECT id, profesor_id
  FROM subjects
 WHERE profesor_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Materiales cancelados/rechazados sin archivo ni hash reutilizable
-- ---------------------------------------------------------------------
ALTER TABLE materials
    MODIFY COLUMN url_or_path VARCHAR(500) NULL,
    MODIFY COLUMN file_hash VARCHAR(128) NULL,
    MODIFY COLUMN estado ENUM('Aprobado','Pendiente','Cancelado','Rechazado') NOT NULL DEFAULT 'Pendiente';
