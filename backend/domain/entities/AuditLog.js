/**
* Project     : Bibliotech  |  Capa: Dominio
* Entidad AuditLog (RD-06: trazabilidad obligatoria).
*/

class AuditLog {
    constructor({ id = null, tipoOperacion, usuarioId = null, registroId = null, timestamp = null }) {
        this.id = id;
        this.tipoOperacion = tipoOperacion;
        this.usuarioId = usuarioId;
        this.registroId = registroId;
        this.timestamp = timestamp;
    }
}

// Catalogo de operaciones auditables.
AuditLog.OPERACIONES = {
    ALTA_USUARIO: 'Alta Usuario',
    SOLICITUD_RESETEO: 'Solicitud Reseteo Clave',
    CAMBIO_CLAVE: 'Cambio Clave',
    ALTA_ROL: 'Alta Rol',
    SOLICITUD_MATERIA: 'Solicitud Materia',
    ALTA_MATERIA: 'Alta Materia',
    ASOCIACION_MATERIA: 'Asociacion Materia',
    SUBIDA_MATERIAL: 'Subida Material',
    ASOCIACION_MATERIAL: 'Asociacion Material',
    APROBACION_MATERIAL: 'Aprobacion Material',
    CANCELACION_MATERIAL: 'Cancelacion Material',
    BORRADO_MATERIAL: 'Borrado Material',
    SUSCRIPCION: 'Suscripcion Materia',
    BANEO_ALUMNO: 'Baneo Alumno'
};

module.exports = AuditLog;
