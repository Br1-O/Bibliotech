# Architecture Decision Records

| ADR                                            | Decision                                              | Status   |
| ---------------------------------------------- | ----------------------------------------------------- | -------- |
| [0001](0001-material-service-decomposition.md) | Descomponer `MaterialService` manteniendo una fachada | Aceptado |
| [0002](0002-frontend-es-modules.md)            | Migrar el frontend a ES modules sin build step        | Aceptado |
| [0003](0003-api-contract-and-ci.md)            | OpenAPI descriptivo, DTOs, contratos y puertas de CI  | Aceptado |
| [0004](0004-state-model.md)                    | Estado de material y estado local de la UI            | Aceptado |
| [0005](0005-auth-session.md)                   | JWT corto y cookie de archivos HttpOnly               | Aceptado |
| [0006](0006-transactions.md)                   | Transacciones por caso de uso con AsyncLocalStorage   | Aceptado |
| [0007](0007-search.md)                         | FULLTEXT en MariaDB antes que un motor externo        | Aceptado |
| [0008](0008-storage.md)                        | Almacenamiento local o Cloudinary                     | Aceptado |
| [0009](0009-audit.md)                          | Auditoria con outbox e intencion append-only          | Aceptado |
| [0010](0010-extraction.md)                     | No extraer busqueda, media ni notificaciones todavia  | Aceptado |
