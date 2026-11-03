/**
* Project     : Bibliotech  |  Capa: Dominio
* Entidad AuditLog (RD-06: trazabilidad obligatoria).
*/

class AuditLog {
    constructor({ id = null, tipoOperacion, usuarioId = null, registroId = null, timestamp = null, registroTipo = null }) {
        this.id = id;
        this.tipoOperacion = tipoOperacion;
        this.usuarioId = usuarioId;
        this.registroId = registroId;
        this.timestamp = timestamp;
        this.registroTipo = registroTipo || AuditLog.tipoRegistro(tipoOperacion);
        this.registroNombre = null;
        this.usuarioNombre = null;
        this.usuarioEmail = null;
    }
}

// Catalogo de operaciones auditables.
AuditLog.OPERACIONES = {
    ALTA_USUARIO: 'Alta Usuario',
    VERIFICACION_CUENTA: 'Verificacion Cuenta',
    SOLICITUD_RESETEO: 'Solicitud Reseteo Clave',
    CAMBIO_CLAVE: 'Cambio Clave',
    DESBANEO_USUARIO: 'Desbaneo Usuario',
    BAJA_USUARIO: 'Baja Usuario',
    ALTA_ROL: 'Alta Rol',
    SOLICITUD_MATERIA: 'Solicitud Materia',
    ALTA_MATERIA: 'Alta Materia',
    ASOCIACION_MATERIA: 'Asociacion Materia',
    MODIFICACION_MATERIA: 'Modificacion Materia',
    ALTA_CARRERA: 'Alta Carrera',
    MODIFICACION_CARRERA: 'Modificacion Carrera',
    ALTA_ANIO: 'Alta Anio',
    MODIFICACION_ANIO: 'Modificacion Anio',
    SUBIDA_MATERIAL: 'Subida Material',
    ASOCIACION_MATERIAL: 'Asociacion Material',
    APROBACION_MATERIAL: 'Aprobacion Material',
    MODIFICACION_MATERIAL: 'Modificacion Material',
    DESASOCIACION_MATERIAL: 'Desasociacion Material',
    CANCELACION_MATERIAL: 'Cancelacion Material',
    BORRADO_MATERIAL: 'Borrado Material',
    SUSCRIPCION: 'Suscripcion Materia',
    BANEO_ALUMNO: 'Baneo Alumno',
    CAMBIO_ROL: 'Cambio Rol'
};

// Tipo de entidad afectada por cada operacion. Permite que el registro de
// auditoria resuelva el objetivo correcto sin adivinar por el ID.
AuditLog.REGISTRO_TIPOS = {
    [AuditLog.OPERACIONES.ALTA_USUARIO]: 'Usuario',
    [AuditLog.OPERACIONES.VERIFICACION_CUENTA]: 'Usuario',
    [AuditLog.OPERACIONES.SOLICITUD_RESETEO]: 'Usuario',
    [AuditLog.OPERACIONES.CAMBIO_CLAVE]: 'Usuario',
    [AuditLog.OPERACIONES.DESBANEO_USUARIO]: 'Usuario',
    [AuditLog.OPERACIONES.BAJA_USUARIO]: 'Usuario',
    [AuditLog.OPERACIONES.ALTA_ROL]: 'Rol',
    [AuditLog.OPERACIONES.SOLICITUD_MATERIA]: 'Materia',
    [AuditLog.OPERACIONES.ALTA_MATERIA]: 'Materia',
    [AuditLog.OPERACIONES.ASOCIACION_MATERIA]: 'Materia',
    [AuditLog.OPERACIONES.MODIFICACION_MATERIA]: 'Materia',
    [AuditLog.OPERACIONES.ALTA_CARRERA]: 'Carrera',
    [AuditLog.OPERACIONES.MODIFICACION_CARRERA]: 'Carrera',
    [AuditLog.OPERACIONES.ALTA_ANIO]: 'Anio',
    [AuditLog.OPERACIONES.MODIFICACION_ANIO]: 'Anio',
    [AuditLog.OPERACIONES.SUBIDA_MATERIAL]: 'Material',
    [AuditLog.OPERACIONES.ASOCIACION_MATERIAL]: 'Material',
    [AuditLog.OPERACIONES.APROBACION_MATERIAL]: 'Material',
    [AuditLog.OPERACIONES.MODIFICACION_MATERIAL]: 'Material',
    [AuditLog.OPERACIONES.DESASOCIACION_MATERIAL]: 'Material',
    [AuditLog.OPERACIONES.CANCELACION_MATERIAL]: 'Material',
    [AuditLog.OPERACIONES.BORRADO_MATERIAL]: 'Material',
    [AuditLog.OPERACIONES.SUSCRIPCION]: 'Materia',
    [AuditLog.OPERACIONES.BANEO_ALUMNO]: 'Usuario',
    [AuditLog.OPERACIONES.CAMBIO_ROL]: 'Usuario'
};

AuditLog.tipoRegistro = (tipoOperacion) => AuditLog.REGISTRO_TIPOS[tipoOperacion] || null;

module.exports = AuditLog;
