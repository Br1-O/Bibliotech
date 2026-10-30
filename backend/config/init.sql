-- =====================================================================
--  Bibliotech - Inicializacion de la base de datos (MariaDB / MySQL)
--  Ejecutar:  mysql -u root -p < backend/config/init.sql
-- =====================================================================
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

DROP DATABASE IF EXISTS bibliotech;
CREATE DATABASE bibliotech CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bibliotech;

-- Usuario de la aplicacion y permisos sobre la base.
CREATE USER IF NOT EXISTS 'bibliotech'@'localhost' IDENTIFIED BY 'bibliotech';
CREATE USER IF NOT EXISTS 'bibliotech'@'%' IDENTIFIED BY 'bibliotech';
GRANT ALL PRIVILEGES ON bibliotech.* TO 'bibliotech'@'localhost';
GRANT ALL PRIVILEGES ON bibliotech.* TO 'bibliotech'@'%';

-- ---------------------------------------------------------------------
-- 1. Roles (RD-02: entidad relacional independiente)
-- ---------------------------------------------------------------------
CREATE TABLE roles (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(50)  NOT NULL UNIQUE,
    descripcion  VARCHAR(255)
);

-- ---------------------------------------------------------------------
-- 2. Rangos de gamificacion (XP acumulada)
-- ---------------------------------------------------------------------
CREATE TABLE ranks (
    rank_id      INT PRIMARY KEY,
    title        VARCHAR(100) NOT NULL UNIQUE,
    min_xp       INT          NOT NULL DEFAULT 0
);

INSERT INTO ranks (rank_id, title, min_xp) VALUES
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
CREATE TABLE users (
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
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
    CONSTRAINT fk_users_rank FOREIGN KEY (rank_level) REFERENCES ranks(rank_id)
);

-- ---------------------------------------------------------------------
-- 3. Agrupaciones academicas: carreras (grupo principal) y anios (grupo secundario)
-- ---------------------------------------------------------------------
CREATE TABLE careers (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL UNIQUE,
    color        VARCHAR(7)   NOT NULL DEFAULT '#6f5bd3',
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE career_years (
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
CREATE TABLE subjects (
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
CREATE TABLE subject_professors (
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
CREATE TABLE categories (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    slug         VARCHAR(50)  NOT NULL UNIQUE,
    nombre       VARCHAR(100) NOT NULL,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO categories (id, slug, nombre) VALUES
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
CREATE TABLE materials (
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
CREATE TABLE material_subjects (
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
CREATE TABLE subscriptions (
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
CREATE TABLE audit_logs (
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
CREATE TABLE thematic_tags (
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
CREATE TABLE material_favorites (
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
CREATE TABLE notifications (
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
CREATE TABLE material_reads (
    user_id      INT NOT NULL,
    material_id  INT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, material_id),
    INDEX idx_material_reads_material (material_id),
    CONSTRAINT fk_reads_user     FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
    CONSTRAINT fk_reads_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

CREATE TABLE reading_backlog (
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
CREATE TABLE user_subscriptions (
    subscriber_id  INT NOT NULL,
    target_user_id INT NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subscriber_id, target_user_id),
    INDEX idx_user_subscriptions_target (target_user_id),
    CONSTRAINT fk_usub_subscriber FOREIGN KEY (subscriber_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_usub_target     FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE reading_streaks (
    user_id         INT PRIMARY KEY,
    current_streak  INT NOT NULL DEFAULT 0,
    last_read_date  DATE NULL,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_streaks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 14. Insignias obtenidas por usuario
-- ---------------------------------------------------------------------
CREATE TABLE user_badges (
    user_id     INT NOT NULL,
    badge_key   VARCHAR(50) NOT NULL,
    unlocked_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, badge_key),
    CONSTRAINT fk_badges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- =====================================================================
--  Datos semilla (contrasenas hasheadas con BCrypt)
-- =====================================================================
INSERT INTO roles (nombre, descripcion) VALUES
    ('Superadmin', 'Privilegios maximos: crea profesores, materias y roles.'),
    ('Profesor',   'Administra el contenido de sus materias y modera alumnos.'),
    ('Alumno',     'Se suscribe a materias y sugiere material educativo.');

-- Contrasenas: Admin123 / Profesor123 / Alumno123
INSERT INTO users (role_id, nombre, apellido, email, password, estado) VALUES
    (1, 'Sofia',  'Administradora', 'admin@bibliotech.edu',    '$2b$10$K86PmMZ9hs3PZ46Z/3geuevZIvtujVlvZFrT/dmTlfrIA/FOYEkVy', 'Activo'),
    (2, 'Pablo',  'Profesor',       'profesor@bibliotech.edu', '$2b$10$xunEA37D5bALA.0GWqheqetYcp3qfnyeyMRG5ib1wZ4Xu3fIBBzPm', 'Activo'),
    (3, 'Ana',    'Alumna',         'alumno@bibliotech.edu',   '$2b$10$RGjIbhSb.tb8C.Gypi5gKO.6ymujG.GrAXzUAetkj.bQTDbnAnsDG', 'Activo');

INSERT INTO careers (nombre, color) VALUES
    ('Analista de Sistemas', '#6f5bd3');

INSERT INTO career_years (career_id, nombre, orden) VALUES
    (1, 'Primer Año', 1),
    (1, 'Segundo Año', 2),
    (1, 'Tercer Año', 3);

INSERT INTO subjects (nombre, descripcion, profesor_id, career_year_id, estado_asociacion) VALUES
    -- Primer Año (career_year_id = 1)
    ('Inglés I', 'Comprensión lectora y vocabulario técnico inicial en inglés.', NULL, 1, 'Activa'),
    ('Ciencia, Tecnología y Sociedad', 'Impacto social y ético de la tecnología y la ciencia.', NULL, 1, 'Activa'),
    ('Análisis Matemático I', 'Funciones, límites, derivadas e introducción al cálculo integral.', NULL, 1, 'Activa'),
    ('Álgebra', 'Vectores, matrices, sistemas de ecuaciones lineales y espacios vectoriales.', NULL, 1, 'Activa'),
    ('Algoritmos y Estructuras de Datos I', 'Fundamentos de lógica, algoritmia y estructuras de datos elementales.', NULL, 1, 'Activa'),
    ('Sistemas y Organizaciones', 'Teoría general de sistemas, estructuras y procesos organizacionales.', NULL, 1, 'Activa'),
    ('Arquitectura de Computadores', 'Organización de hardware, componentes internos, memoria y procesadores.', NULL, 1, 'Activa'),
    ('Prácticas Profesionalizantes I', 'Primer acercamiento al entorno profesional y análisis de necesidades.', NULL, 1, 'Activa'),

    -- Segundo Año (career_year_id = 2)
    ('Inglés II', 'Redacción de documentación técnica e interacción profesional en inglés.', NULL, 2, 'Activa'),
    ('Análisis Matemático II', 'Cálculo multivariable, series y ecuaciones diferenciales aplicadas.', NULL, 2, 'Activa'),
    ('Estadística', 'Estadística descriptiva, probabilidad y distribuciones para análisis de datos.', NULL, 2, 'Activa'),
    ('Ingeniería de Software I', 'Ciclo de vida del software, relevamiento, requerimientos y modelado UML.', NULL, 2, 'Activa'),
    ('Algoritmos y Estructuras de Datos II', 'Estructuras de datos avanzadas, complejidad algorítmica y POO.', NULL, 2, 'Activa'),
    ('Sistemas Operativos', 'Gestión de procesos, memoria, archivos y administración de sistemas.', NULL, 2, 'Activa'),
    ('Bases de Datos', 'Modelado relacional, SQL, normalización y gestión de datos.', NULL, 2, 'Activa'),
    ('Prácticas Profesionalizantes II', 'Diseño y desarrollo de proyectos orientados a requerimientos reales.', NULL, 2, 'Activa'),

    -- Tercer Año (career_year_id = 3)
    ('Inglés III', 'Comunicación fluida y presentación de proyectos en inglés técnico.', NULL, 3, 'Activa'),
    ('Aspectos Legales de la Profesión', 'Legislación informática, propiedad intelectual, marcas, patentes y delictiva digital.', NULL, 3, 'Activa'),
    ('Seminario de Actualización', 'Exploración de nuevas tecnologías, metodologías ágiles y tendencias.', NULL, 3, 'Activa'),
    ('Redes y Comunicaciones', 'Modelos OSI/TCP-IP, protocolos, enrutamiento, topologías y seguridad en redes.', NULL, 3, 'Activa'),
    ('Ingeniería de Software II', 'Arquitectura de software, patrones de diseño, testing y calidad.', NULL, 3, 'Activa'),
    ('Algoritmos y Estructuras de Datos III', 'Programación concurrente, patrones avanzados y frameworks de desarrollo.', NULL, 3, 'Activa'),
    ('Prácticas Profesionalizantes III', 'Proyecto integrador final aplicado a un entorno o cliente real.', NULL, 3, 'Activa');

SET foreign_key_checks = 1;
