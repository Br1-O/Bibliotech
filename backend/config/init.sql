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
-- 2. Usuarios (RD-01: email unico)
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
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
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
-- 6. Material educativo (RD-05: hash unico)
-- ---------------------------------------------------------------------
CREATE TABLE materials (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    autor_id     INT          NOT NULL,
    titulo       VARCHAR(150) NOT NULL,
    tipo         ENUM('PDF','EPUB','Word','Presentacion','Link_Drive','Youtube','Repositorio') NOT NULL,
    url_or_path  VARCHAR(500) NULL,
    portada      VARCHAR(500) NULL,
    file_hash    VARCHAR(128) NULL UNIQUE,
    categories   TEXT,
    descripcion  TEXT,
    estado       ENUM('Aprobado','Pendiente','Cancelado','Rechazado') NOT NULL DEFAULT 'Pendiente',
    es_favorito  TINYINT(1) NOT NULL DEFAULT 0,
    contador_favoritos INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_materials_autor FOREIGN KEY (autor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 5. Relacion N a N Material <-> Materia (moderacion por materia)
-- ---------------------------------------------------------------------
CREATE TABLE material_subjects (
    material_id        INT NOT NULL,
    subject_id         INT NOT NULL,
    estado_aprobacion  ENUM('Aprobado','Pendiente') NOT NULL DEFAULT 'Pendiente',
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
    subject_id   INT NOT NULL,
    material_id  INT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at      DATETIME NULL,
    UNIQUE KEY uq_notification_usuario_material (usuario_id, subject_id, material_id),
    INDEX idx_notifications_inbox (usuario_id, read_at, created_at),
    CONSTRAINT fk_notifications_usuario  FOREIGN KEY (usuario_id)  REFERENCES users(id)     ON DELETE CASCADE,
    CONSTRAINT fk_notifications_subject  FOREIGN KEY (subject_id)  REFERENCES subjects(id)  ON DELETE CASCADE,
    CONSTRAINT fk_notifications_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
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
