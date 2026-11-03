-- =====================================================================
--  Bibliotech - Datos demo SOLO para desarrollo/pruebas
--  Ejecutar despues de init.sql o desde reset_dev.sql.
--  Nunca cargar estas cuentas en produccion.
-- =====================================================================
USE bibliotech;

INSERT IGNORE INTO users (id, role_id, nombre, apellido, email, password, estado) VALUES
    (1, 1, 'Sofia', 'Administradora', 'admin@bibliotech.edu', '$2b$10$K86PmMZ9hs3PZ46Z/3geuevZIvtujVlvZFrT/dmTlfrIA/FOYEkVy', 'Activo'),
    (2, 2, 'Pablo', 'Profesor', 'profesor@bibliotech.edu', '$2b$10$xunEA37D5bALA.0GWqheqetYcp3qfnyeyMRG5ib1wZ4Xu3fIBBzPm', 'Activo'),
    (3, 3, 'Ana', 'Alumna', 'alumno@bibliotech.edu', '$2b$10$RGjIbhSb.tb8C.Gypi5gKO.6ymujG.GrAXzUAetkj.bQTDbnAnsDG', 'Activo');

INSERT IGNORE INTO careers (id, nombre, color) VALUES
    (1, 'Analista de Sistemas', '#6f5bd3');

INSERT IGNORE INTO career_years (id, career_id, nombre, orden) VALUES
    (1, 1, 'Primer Año', 1),
    (2, 1, 'Segundo Año', 2),
    (3, 1, 'Tercer Año', 3);

INSERT INTO subjects (nombre, descripcion, profesor_id, career_year_id, estado_asociacion)
SELECT * FROM (
    SELECT 'Inglés I' AS nombre, 'Comprensión lectora y vocabulario técnico inicial en inglés.' AS descripcion, NULL AS profesor_id, 1 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Ciencia, Tecnología y Sociedad' AS nombre, 'Impacto social y ético de la tecnología y la ciencia.' AS descripcion, NULL AS profesor_id, 1 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Análisis Matemático I' AS nombre, 'Funciones, límites, derivadas e introducción al cálculo integral.' AS descripcion, NULL AS profesor_id, 1 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Álgebra' AS nombre, 'Vectores, matrices, sistemas de ecuaciones lineales y espacios vectoriales.' AS descripcion, NULL AS profesor_id, 1 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Algoritmos y Estructuras de Datos I' AS nombre, 'Fundamentos de lógica, algoritmia y estructuras de datos elementales.' AS descripcion, NULL AS profesor_id, 1 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Sistemas y Organizaciones' AS nombre, 'Teoría general de sistemas, estructuras y procesos organizacionales.' AS descripcion, NULL AS profesor_id, 1 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Arquitectura de Computadores' AS nombre, 'Organización de hardware, componentes internos, memoria y procesadores.' AS descripcion, NULL AS profesor_id, 1 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Prácticas Profesionalizantes I' AS nombre, 'Primer acercamiento al entorno profesional y análisis de necesidades.' AS descripcion, NULL AS profesor_id, 1 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Inglés II' AS nombre, 'Redacción de documentación técnica e interacción profesional en inglés.' AS descripcion, NULL AS profesor_id, 2 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Análisis Matemático II' AS nombre, 'Cálculo multivariable, series y ecuaciones diferenciales aplicadas.' AS descripcion, NULL AS profesor_id, 2 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Estadística' AS nombre, 'Estadística descriptiva, probabilidad y distribuciones para análisis de datos.' AS descripcion, NULL AS profesor_id, 2 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Ingeniería de Software I' AS nombre, 'Ciclo de vida del software, relevamiento, requerimientos y modelado UML.' AS descripcion, NULL AS profesor_id, 2 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Algoritmos y Estructuras de Datos II' AS nombre, 'Estructuras de datos avanzadas, complejidad algorítmica y POO.' AS descripcion, NULL AS profesor_id, 2 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Sistemas Operativos' AS nombre, 'Gestión de procesos, memoria, archivos y administración de sistemas.' AS descripcion, NULL AS profesor_id, 2 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Bases de Datos' AS nombre, 'Modelado relacional, SQL, normalización y gestión de datos.' AS descripcion, NULL AS profesor_id, 2 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Prácticas Profesionalizantes II' AS nombre, 'Diseño y desarrollo de proyectos orientados a requerimientos reales.' AS descripcion, NULL AS profesor_id, 2 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Inglés III' AS nombre, 'Comunicación fluida y presentación de proyectos en inglés técnico.' AS descripcion, NULL AS profesor_id, 3 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Aspectos Legales de la Profesión' AS nombre, 'Legislación informática, propiedad intelectual, marcas, patentes y delictiva digital.' AS descripcion, NULL AS profesor_id, 3 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Seminario de Actualización' AS nombre, 'Exploración de nuevas tecnologías, metodologías ágiles y tendencias.' AS descripcion, NULL AS profesor_id, 3 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Redes y Comunicaciones' AS nombre, 'Modelos OSI/TCP-IP, protocolos, enrutamiento, topologías y seguridad en redes.' AS descripcion, NULL AS profesor_id, 3 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Ingeniería de Software II' AS nombre, 'Arquitectura de software, patrones de diseño, testing y calidad.' AS descripcion, NULL AS profesor_id, 3 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Algoritmos y Estructuras de Datos III' AS nombre, 'Programación concurrente, patrones avanzados y frameworks de desarrollo.' AS descripcion, NULL AS profesor_id, 3 AS career_year_id, 'Activa' AS estado_asociacion
    UNION ALL
    SELECT 'Prácticas Profesionalizantes III' AS nombre, 'Proyecto integrador final aplicado a un entorno o cliente real.' AS descripcion, NULL AS profesor_id, 3 AS career_year_id, 'Activa' AS estado_asociacion
) AS seed_subjects
WHERE NOT EXISTS (SELECT 1 FROM subjects);
