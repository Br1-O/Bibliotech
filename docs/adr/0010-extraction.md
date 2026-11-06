# ADR 0010: No extraer busqueda, media ni notificaciones todavia

- Estado: aceptado
- Fecha: 2026-11-06

## Contexto

El roadmap permite evaluar la extraccion de busqueda, media y notificaciones.
La carga actual es moderada y el despliegue es un monolito modular con una sola
base MariaDB. Extraer un servicio agrega red, despliegue, consistencia y
observabilidad antes de tener evidencia de que el modulo sea el cuello de
botella.

## Decision

Mantener busqueda, media y notificaciones dentro del monolito modular.

- Busqueda: FULLTEXT en MariaDB con proyecciones mantenidas por triggers; se
  migrara solo si las metricas muestran latencia o relevancia insuficientes.
- Media: almacenamiento local o Cloudinary; el streaming y los rangos ya estan
  resueltos en el adaptador HTTP. Un servicio de media solo se justifica por
  ancho de banda, transformaciones o escaneo de malware a escala.
- Notificaciones: outbox transaccional con worker en el mismo proceso; se
  extraera si el backlog o la latencia de entrega afectan al API.

Se revisara la decision cuando exista evidencia sostenida de alguno de estos
umbrales: p95 de la ruta afectada por encima del presupuesto de rendimiento,
backlog de outbox que no drena, saturacion de conexiones atribuible a un modulo,
o necesidad de escalar ese modulo por separado.

## Consecuencias

- Menos complejidad operativa y transacciones locales.
- El monolito sigue siendo el limite de escalado; se escala verticalmente o por
  instancias con un pool de base de datos acotado.
- La outbox y las proyecciones permiten extraer mas adelante sin cambiar el
  contrato HTTP.
- No se agregaron servicios, colas externas ni bases adicionales.

## Verificacion

`npm run test:perf` y las metricas de pool/outbox existentes. No hay medicion
que hoy justifique una extraccion.
