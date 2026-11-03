-- =====================================================================
--  Bibliotech - Esquema base no destructivo (MariaDB / MySQL)
--  Ejecutar:  mysql -u root -p < backend/config/init.sql
--  No elimina la base ni datos existentes. Para un reinicio local use
--  reset.sql / reset_dev.sql. Las cuentas demo viven en seed_dev.sql.
-- =====================================================================
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

CREATE DATABASE IF NOT EXISTS bibliotech CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bibliotech;

-- ---------------------------------------------------------------------
-- 1. Roles (RD-02: entidad relacional independiente)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(50)  NOT NULL UNIQUE,
    descripcion  VARCHAR(255)
);

-- ---------------------------------------------------------------------
-- 2. Rangos de gamificacion (XP acumulada)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ranks (
    rank_id      INT PRIMARY KEY,
    title        VARCHAR(100) NOT NULL UNIQUE,
    min_xp       INT          NOT NULL DEFAULT 0
);

INSERT IGNORE INTO ranks (rank_id, title, min_xp) VALUES
    (1, 'Entusiasta de Hello World', 0),
    (2, 'Estudiante de Sintaxis',    100),
    (3, 'Escritor de Scripts',       300),
    (4, 'Creador de Módulos',        700),
    (5, 'Constructor de Sistemas',   1300),
    (6, 'Analista de Patrones',      2100),
    (7, 'Gurú del Clean Code',       3200),
    (8, 'Arquitecto de Software',    4800),
    (9, 'Root de la Biblioteca',     7000);
-- ---------------------------------------------------------------------
-- 3. Usuarios (RD-01: email unico) + perfil y gamificacion
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    role_id           INT          NOT NULL,
    nombre            VARCHAR(50)  NOT NULL,
    apellido          VARCHAR(50)  NOT NULL,
    email             VARCHAR(100) NOT NULL UNIQUE,
    password          VARCHAR(255) NOT NULL,
    reset_token       VARCHAR(255) NULL,
    token_expiration  DATETIME     NULL,
    verification_token VARCHAR(255) NULL,
    verification_expires DATETIME NULL,
    estado            ENUM('Activo','Inactivo','Baneado','PendienteVerificacion') NOT NULL DEFAULT 'Activo',
    birthdate         DATE         NULL,
    gender            ENUM('Male','Female','Non-Binary','Other') NULL,
    gender_custom     VARCHAR(10)  NULL,
    city              VARCHAR(100) NOT NULL DEFAULT '-',
    country           VARCHAR(100) NOT NULL DEFAULT '-',
    github            VARCHAR(255) NOT NULL DEFAULT '-',
    instagram         VARCHAR(255) NOT NULL DEFAULT '-',
    linkedin          VARCHAR(255) NOT NULL DEFAULT '-',
    career            VARCHAR(80)  NOT NULL DEFAULT '-',
    institute         VARCHAR(80)  NOT NULL DEFAULT '-',
    about_me          VARCHAR(300) NOT NULL DEFAULT '-',
    phone             VARCHAR(30)  NOT NULL DEFAULT '-',
    xp                INT          NOT NULL DEFAULT 0,
    rank_level        INT          NOT NULL DEFAULT 1,
    profile_picture   VARCHAR(255) NOT NULL DEFAULT '/img/profile_pictures/default-1.png',
    token_version     INT          NOT NULL DEFAULT 0,
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
    CONSTRAINT fk_users_rank FOREIGN KEY (rank_level) REFERENCES ranks(rank_id)
);

-- ---------------------------------------------------------------------
-- 3. Agrupaciones academicas: carreras (grupo principal) y anios (grupo secundario)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS careers (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL UNIQUE,
    color        VARCHAR(7)   NOT NULL DEFAULT '#6f5bd3',
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS career_years (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    career_id    INT          NOT NULL,
    nombre       VARCHAR(100) NOT NULL,
    orden        INT          NOT NULL DEFAULT 0,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_career_year (career_id, nombre),
    CONSTRAINT fk_years_career FOREIGN KEY (career_id) REFERENCES careers(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 4. Materias / Categorias de agrupacion
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subjects (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    nombre             VARCHAR(100) NOT NULL,
    descripcion        VARCHAR(500),
    profesor_id        INT          NULL,
    career_year_id     INT          NULL,
    estado_asociacion  ENUM('Activa','Pendiente') NOT NULL DEFAULT 'Activa',
    created_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_subjects_profesor FOREIGN KEY (profesor_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_subjects_year FOREIGN KEY (career_year_id) REFERENCES career_years(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- 5. Asignacion multiple de profesores a materias
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subject_professors (
    subject_id   INT NOT NULL,
    profesor_id  INT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subject_id, profesor_id),
    INDEX idx_subject_professors_profesor (profesor_id),
    CONSTRAINT fk_sp_subject  FOREIGN KEY (subject_id)  REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT fk_sp_profesor FOREIGN KEY (profesor_id) REFERENCES users(id)    ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 6. Categorias tematicas de material
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    slug         VARCHAR(50)  NOT NULL UNIQUE,
    nombre       VARCHAR(100) NOT NULL,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO categories (id, slug, nombre) VALUES
    (1,  'fiction',     'Ficcion'),
    (2,  'literature',  'Literatura'),
    (3,  'poetry',      'Poesia'),
    (4,  'drama',       'Drama'),
    (5,  'technical',   'Tecnico'),
    (6,  'science',     'Ciencia'),
    (7,  'business',    'Negocios'),
    (8,  'education',   'Educacion'),
    (9,  'medicine',    'Medicina'),
    (10, 'law',         'Derecho'),
    (11, 'non-fiction', 'No ficcion'),
    (12, 'self-help',   'Autoayuda'),
    (13, 'biography',   'Biografia'),
    (14, 'history',     'Historia'),
    (15, 'philosophy',  'Filosofia'),
    (16, 'religion',    'Religion'),
    (17, 'arts',        'Artes'),
    (18, 'hobbies',     'Pasatiempos'),
    (19, 'travel',      'Viajes'),
    (20, 'sports',      'Deportes'),
    (21, 'cooking',     'Cocina'),
    (22, 'kids',        'Infantil'),
    (23, 'young-adult', 'Juvenil');

-- ---------------------------------------------------------------------
-- 7. Material educativo (RD-05: hash unico)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materials (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    autor_id     INT          NOT NULL,
    uploaded_by  INT          NULL,
    author       VARCHAR(150) NULL,
    titulo       VARCHAR(150) NOT NULL,
    tipo         ENUM('PDF','EPUB','Word','Presentacion','Link_Drive','Youtube','Repositorio') NOT NULL,
    url_or_path  VARCHAR(500) NULL,
    portada      VARCHAR(500) NULL,
    file_hash    VARCHAR(128) NULL UNIQUE,
    category_id  INT          NOT NULL DEFAULT 5,
    categories   TEXT,
    descripcion  TEXT,
    pages        INT          NULL,
    estado       ENUM('Aprobado','Pendiente','Cancelado','Rechazado') NOT NULL DEFAULT 'Pendiente',
    es_favorito  TINYINT(1) NOT NULL DEFAULT 0,
    contador_favoritos INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_materials_autor FOREIGN KEY (autor_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_materials_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_materials_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- ---------------------------------------------------------------------
-- 5. Relacion N a N Material <-> Materia (moderacion por materia)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_subjects (
    material_id        INT NOT NULL,
    subject_id         INT NOT NULL,
    estado_aprobacion  ENUM('Aprobado','Pendiente') NOT NULL DEFAULT 'Pendiente',
    is_mandatory       TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (material_id, subject_id),
    CONSTRAINT fk_ms_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    CONSTRAINT fk_ms_subject  FOREIGN KEY (subject_id)  REFERENCES subjects(id)  ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 7. Suscripciones (patron Observer)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    alumno_id   INT NOT NULL,
    materia_id  INT NOT NULL,
    estado      ENUM('Suscrito','Baneado') NOT NULL DEFAULT 'Suscrito',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_alumno_materia (alumno_id, materia_id),
    CONSTRAINT fk_sub_alumno  FOREIGN KEY (alumno_id)  REFERENCES users(id)    ON DELETE CASCADE,
    CONSTRAINT fk_sub_materia FOREIGN KEY (materia_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 8. Registro de auditoria (RD-06: trazabilidad inalterable)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    timestamp       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo_operacion  VARCHAR(100) NOT NULL,
    usuario_id      INT          NULL,
    registro_id     VARCHAR(100),
    CONSTRAINT fk_log_usuario FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- 9. Etiquetas tematicas (Thematic Tags)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS thematic_tags (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL,
    categoria    VARCHAR(100) NOT NULL,
    creado_por   INT          NULL,
    baneado      TINYINT(1)   NOT NULL DEFAULT 0,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tag_categoria (nombre, categoria),
    CONSTRAINT fk_tags_creado_por FOREIGN KEY (creado_por) REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- 10. Favoritos de materiales
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_favorites (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id   INT NOT NULL,
    material_id  INT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_usuario_material (usuario_id, material_id),
    CONSTRAINT fk_fav_usuario  FOREIGN KEY (usuario_id)  REFERENCES users(id)    ON DELETE CASCADE,
    CONSTRAINT fk_fav_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 11. Notificaciones de material nuevo en materias suscritas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id   INT NOT NULL,
    actor_id     INT NULL,
    subject_id   INT NULL,
    material_id  INT NULL,
    type         VARCHAR(50) NOT NULL DEFAULT 'material',
    message      VARCHAR(255) NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at      DATETIME NULL,
    UNIQUE KEY uq_notification_usuario_material (usuario_id, type, subject_id, material_id),
    INDEX idx_notifications_inbox (usuario_id, read_at, created_at),
    CONSTRAINT fk_notifications_usuario  FOREIGN KEY (usuario_id)  REFERENCES users(id)     ON DELETE CASCADE,
    CONSTRAINT fk_notifications_actor    FOREIGN KEY (actor_id)    REFERENCES users(id)     ON DELETE SET NULL,
    CONSTRAINT fk_notifications_subject  FOREIGN KEY (subject_id)  REFERENCES subjects(id)  ON DELETE CASCADE,
    CONSTRAINT fk_notifications_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 12. Lecturas, progreso y estanteria personal
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_reads (
    user_id      INT NOT NULL,
    material_id  INT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, material_id),
    INDEX idx_material_reads_material (material_id),
    CONSTRAINT fk_reads_user     FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
    CONSTRAINT fk_reads_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reading_backlog (
    user_id       INT NOT NULL,
    material_id   INT NOT NULL,
    current_page  INT NOT NULL DEFAULT 0,
    total_pages   INT NULL,
    status        ENUM('pending','reading') NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, material_id),
    INDEX idx_backlog_material (material_id),
    CONSTRAINT fk_backlog_user     FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
    CONSTRAINT fk_backlog_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 13. Suscripciones entre usuarios (seguidores) y rachas de lectura
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_subscriptions (
    subscriber_id  INT NOT NULL,
    target_user_id INT NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subscriber_id, target_user_id),
    INDEX idx_user_subscriptions_target (target_user_id),
    CONSTRAINT fk_usub_subscriber FOREIGN KEY (subscriber_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_usub_target     FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reading_streaks (
    user_id         INT PRIMARY KEY,
    current_streak  INT NOT NULL DEFAULT 0,
    last_read_date  DATE NULL,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_streaks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 14. Insignias obtenidas por usuario
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_badges (
    user_id     INT NOT NULL,
    badge_key   VARCHAR(50) NOT NULL,
    unlocked_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, badge_key),
    CONSTRAINT fk_badges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- =====================================================================
--  Datos semilla (contrasenas hasheadas con BCrypt)
-- =====================================================================
INSERT IGNORE INTO roles (nombre, descripcion) VALUES
    ('Superadmin', 'Privilegios maximos: crea profesores, materias y roles.'),
    ('Profesor',   'Administra el contenido de sus materias y modera alumnos.'),
    ('Alumno',     'Se suscribe a materias y sugiere material educativo.');

-- Los datos demo (usuarios, carrera, anios y materias) se cargan con
-- backend/config/seed_dev.sql y nunca forman parte del esquema base.

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(255) PRIMARY KEY,
    applied_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SET foreign_key_checks = 1;
