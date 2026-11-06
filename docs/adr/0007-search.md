# ADR 0007: Busqueda con FULLTEXT en MariaDB antes que un motor externo

- Estado: aceptado
- Fecha: 2026-11-06

## Contexto

El catalogo busca por titulo, autor, materias, carreras y etiquetas. La version
anterior usaba `LIKE '%texto%'` sobre varias columnas, lo que impide usar indices
y crece con el tamano de la tabla.

## Decision

- Mantener MariaDB como unica fuente de busqueda.
- Usar las proyecciones `material_search` y `user_search` con indices FULLTEXT,
  mantenidas por triggers para altas y modificaciones y backfilled en la
  migracion `007_phase2_performance.sql`.
- `q` usa `MATCH ... AGAINST (... IN BOOLEAN MODE)` sobre esas proyecciones.
- Si la consulta no produce terminos utiles (por ejemplo, terminos demasiado
  cortos), se usa un fallback acotado a `titulo`/`author` con `LIKE`.
- Los filtros de materia, carrera, tipo, categoria, anio y etiquetas usan
  predicados indexados (`EXISTS` sobre tablas normalizadas).
- La paginacion es server-side con maximo 100 elementos por pagina.
- No se introduce Meilisearch/OpenSearch hasta medir que FULLTEXT no cumple los
  objetivos de latencia o relevancia.

## Consecuencias

- Se evitan escaneos completos en el camino caliente del catalogo.
- La relevancia es la de MariaDB; no hay tolerancia a errores tipograficos ni
  ranking avanzado.
- Los triggers mantienen las proyecciones; una carga masiva debe usar el camino
  de aplicacion o replicar la sincronizacion.
- Un motor externo requeriria sincronizacion, operacion y un contrato nuevo.

## Verificacion

`backend/tests/perfBudget.test.js`/`npm run test:perf`, pruebas de integracion
del catalogo y `EXPLAIN` de las consultas paginadas.
