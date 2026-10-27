-- =====================================================================
--  Bibliotech - Migracion idempotente de agrupaciones academicas
--  Aplica solo cambios estructurales y datos iniciales faltantes.
--  No elimina tablas ni registros existentes.
--  Compatible con MySQL 8 / MariaDB.
-- =====================================================================
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. Carreras y anios
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS careers (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL UNIQUE,
    color        VARCHAR(7)   NOT NULL DEFAULT '#6f5bd3',
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS career_years (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    career_id    INT          NOT NULL,
    nombre       VARCHAR(100) NOT NULL,
    orden        INT          NOT NULL DEFAULT 0,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_career_year (career_id, nombre),
    CONSTRAINT fk_years_career FOREIGN KEY (career_id) REFERENCES careers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. Columna subjects.career_year_id + clave foranea
-- ---------------------------------------------------------------------
SET @has_column = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'subjects'
       AND COLUMN_NAME = 'career_year_id'
);
SET @sql = IF(@has_column = 0,
    'ALTER TABLE subjects ADD COLUMN career_year_id INT NULL AFTER profesor_id',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND TABLE_NAME = 'subjects'
       AND CONSTRAINT_NAME = 'fk_subjects_year'
       AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql = IF(@has_fk = 0,
    'ALTER TABLE subjects ADD CONSTRAINT fk_subjects_year FOREIGN KEY (career_year_id) REFERENCES career_years(id) ON DELETE SET NULL',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- 3. Materiales: nuevos tipos, portada y tablas auxiliares
-- ---------------------------------------------------------------------
ALTER TABLE materials
    MODIFY COLUMN tipo ENUM('PDF','EPUB','Word','Presentacion','Link_Drive','Youtube','Repositorio') NOT NULL;

SET @has_cover = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'materials'
       AND COLUMN_NAME = 'portada'
);
SET @sql = IF(@has_cover = 0,
    'ALTER TABLE materials ADD COLUMN portada VARCHAR(500) NULL AFTER url_or_path',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS material_favorites (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id   INT NOT NULL,
    material_id  INT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_usuario_material (usuario_id, material_id),
    CONSTRAINT fk_fav_usuario  FOREIGN KEY (usuario_id)  REFERENCES users(id)     ON DELETE CASCADE,
    CONSTRAINT fk_fav_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. Datos iniciales: solo si la base aun no tiene carreras
-- ---------------------------------------------------------------------
INSERT INTO careers (nombre, color)
SELECT 'Analista de Sistemas', '#6f5bd3'
 WHERE NOT EXISTS (SELECT 1 FROM careers);

INSERT INTO career_years (career_id, nombre, orden)
SELECT c.id, v.nombre, v.orden
  FROM careers c
  JOIN (
        SELECT 'Primer Año' AS nombre, 1 AS orden
  UNION ALL SELECT 'Segundo Año', 2
  UNION ALL SELECT 'Tercer Año', 3
       ) v
 WHERE c.nombre = 'Analista de Sistemas'
   AND NOT EXISTS (
        SELECT 1 FROM career_years y
         WHERE y.career_id = c.id AND y.nombre = v.nombre
   );

-- Asocia materias existentes con nombres conocidos y sin agrupacion previa.
UPDATE subjects s
  JOIN careers c      ON c.nombre = 'Analista de Sistemas'
  JOIN career_years y ON y.career_id = c.id
   SET s.career_year_id = y.id
 WHERE s.career_year_id IS NULL
   AND y.nombre = CASE
        WHEN s.nombre IN (
            'Inglés I', 'Ciencia, Tecnología y Sociedad', 'Análisis Matemático I',
            'Álgebra', 'Algoritmos y Estructuras de Datos I', 'Sistemas y Organizaciones',
            'Arquitectura de Computadores', 'Prácticas Profesionalizantes I'
        ) THEN 'Primer Año'
        WHEN s.nombre IN (
            'Inglés II', 'Análisis Matemático II', 'Estadística', 'Ingeniería de Software I',
            'Algoritmos y Estructuras de Datos II', 'Sistemas Operativos', 'Bases de Datos',
            'Prácticas Profesionalizantes II'
        ) THEN 'Segundo Año'
        WHEN s.nombre IN (
            'Inglés III', 'Aspectos Legales de la Profesión', 'Seminario de Actualización',
            'Redes y Comunicaciones', 'Ingeniería de Software II',
            'Algoritmos y Estructuras de Datos III', 'Prácticas Profesionalizantes III'
        ) THEN 'Tercer Año'
        ELSE NULL
       END;
