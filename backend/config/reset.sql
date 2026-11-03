-- =====================================================================
--  Bibliotech - Reinicio DESTRUCTIVO de la base de datos
--  Elimina por completo la base bibliotech y vuelve a crear el esquema.
--  Uso local exclusivamente:
--    cd backend/config && mysql -u root -p < reset.sql
--  No carga cuentas demo. Use reset_dev.sql para desarrollo/pruebas.
-- =====================================================================
DROP DATABASE IF EXISTS bibliotech;
SOURCE init.sql;
