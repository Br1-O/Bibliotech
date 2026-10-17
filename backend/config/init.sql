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
    estado            ENUM('Activo','Inactivo','Baneado') NOT NULL DEFAULT 'Activo',
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ---------------------------------------------------------------------
-- 3. Materias / Categorias de agrupacion
-- ---------------------------------------------------------------------
CREATE TABLE subjects (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    nombre             VARCHAR(100) NOT NULL,
    descripcion        VARCHAR(500),
    profesor_id        INT          NULL,
    estado_asociacion  ENUM('Activa','Pendiente') NOT NULL DEFAULT 'Activa',
    created_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_subjects_profesor FOREIGN KEY (profesor_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- 4. Material educativo (RD-05: hash unico)
-- ---------------------------------------------------------------------
CREATE TABLE materials (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    autor_id     INT          NOT NULL,
    titulo       VARCHAR(150) NOT NULL,
    tipo         ENUM('PDF','Word','Presentacion','Link_Drive','Youtube') NOT NULL,
    url_or_path  VARCHAR(500) NOT NULL,
    file_hash    VARCHAR(128) NOT NULL UNIQUE,
    categories   TEXT,
    descripcion  TEXT,
    estado       ENUM('Aprobado','Pendiente','Cancelado') NOT NULL DEFAULT 'Pendiente',
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
-- 6. Suscripciones (patron Observer)
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
-- 7. Registro de auditoria (RD-06: trazabilidad inalterable)
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
-- 8. Etiquetas tematicas (Thematic Tags)
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
-- 9. Favoritos de materiales
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

-- =====================================================================
--  Datos semilla (contrasenas hasheadas con BCrypt)
-- =====================================================================
INSERT INTO roles (nombre, descripcion) VALUES
    ('Superadmin', 'Privilegios maximos: crea profesores, materias y roles.'),
    ('Profesor',   'Administra el contenido de sus materias y modera alumnos.'),
    ('Alumno',     'Se suscribe a materias y sugiere material educativo.');

-- Contrasenas: Admin123 / Profesor123 / Alumno123
INSERT INTO users (role_id, nombre, apellido, email, password, estado) VALUES
    (1, 'Sofia',  'Administradora', 'admin@bibliotech.edu',    '$2b$10$7kqsOVra.LklVWruf3wMdO9hHwRgvZFELZZYoSk.hHvERrfNpmsR2', 'Activo'),
    (2, 'Pablo',  'Profesor',       'profesor@bibliotech.edu', '$2b$10$T.QhGCCqKoV4rcWhKfiYw.70NrJFYOCjgtK7W7YWuxV7SOqob38/i', 'Activo'),
    (3, 'Ana',    'Alumna',         'alumno@bibliotech.edu',   '$2b$10$lZodM9mteQ7QdaOBdyggGuPREI1zFu4nt2212xC/ZmXnjn5BI0Fmq', 'Activo');

INSERT INTO subjects (nombre, descripcion, profesor_id, estado_asociacion) VALUES
    -- Primer Año
    ('Inglés I', 'Comprensión lectora y vocabulario técnico inicial en inglés.', NULL, 'Activa'),
    ('Ciencia, Tecnología y Sociedad', 'Impacto social y ético de la tecnología y la ciencia.', NULL, 'Activa'),
    ('Análisis Matemático I', 'Funciones, límites, derivadas e introducción al cálculo integral.', NULL, 'Activa'),
    ('Álgebra', 'Vectores, matrices, sistemas de ecuaciones lineales y espacios vectoriales.', NULL, 'Activa'),
    ('Algoritmos y Estructuras de Datos I', 'Fundamentos de lógica, algoritmia y estructuras de datos elementales.', NULL, 'Activa'),
    ('Sistemas y Organizaciones', 'Teoría general de sistemas, estructuras y procesos organizacionales.', NULL, 'Activa'),
    ('Arquitectura de Computadores', 'Organización de hardware, componentes internos, memoria y procesadores.', NULL, 'Activa'),
    ('Prácticas Profesionalizantes I', 'Primer acercamiento al entorno profesional y análisis de necesidades.', NULL, 'Activa'),

    -- Segundo Año
    ('Inglés II', 'Redacción de documentación técnica e interacción profesional en inglés.', NULL, 'Activa'),
    ('Análisis Matemático II', 'Cálculo multivariable, series y ecuaciones diferenciales aplicadas.', NULL, 'Activa'),
    ('Estadística', 'Estadística descriptiva, probabilidad y distribuciones para análisis de datos.', NULL, 'Activa'),
    ('Ingeniería de Software I', 'Ciclo de vida del software, relevamiento, requerimientos y modelado UML.', NULL, 'Activa'),
    ('Algoritmos y Estructuras de Datos II', 'Estructuras de datos avanzadas, complejidad algorítmica y POO.', NULL, 'Activa'),
    ('Sistemas Operativos', 'Gestión de procesos, memoria, archivos y administración de sistemas.', NULL, 'Activa'),
    ('Bases de Datos', 'Modelado relacional, SQL, normalización y gestión de datos.', NULL, 'Activa'),
    ('Prácticas Profesionalizantes II', 'Diseño y desarrollo de proyectos orientados a requerimientos reales.', NULL, 'Activa'),

    -- Tercer Año
    ('Inglés III', 'Comunicación fluida y presentación de proyectos en inglés técnico.', NULL, 'Activa'),
    ('Aspectos Legales de la Profesión', 'Legislación informática, propiedad intelectual, marcas, patentes y delictiva digital.', NULL, 'Activa'),
    ('Seminario de Actualización', 'Exploración de nuevas tecnologías, metodologías ágiles y tendencias.', NULL, 'Activa'),
    ('Redes y Comunicaciones', 'Modelos OSI/TCP-IP, protocolos, enrutamiento, topologías y seguridad en redes.', NULL, 'Activa'),
    ('Ingeniería de Software II', 'Arquitectura de software, patrones de diseño, testing y calidad.', NULL, 'Activa'),
    ('Algoritmos y Estructuras de Datos III', 'Programación concurrente, patrones avanzados y frameworks de desarrollo.', NULL, 'Activa'),
    ('Prácticas Profesionalizantes III', 'Proyecto integrador final aplicado a un entorno o cliente real.', NULL, 'Activa');

SET foreign_key_checks = 1;
