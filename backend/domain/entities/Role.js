/**
* Project     : Bibliotech  |  Capa: Dominio
* Entidad de negocio Role (RD-02: normalizacion de roles).
*/

class Role {
    constructor({ id = null, nombre, descripcion = null }) {
        if (!nombre) throw new Error('VALIDATION_REQUIRED:nombre');
        this.id = id;
        this.nombre = nombre;
        this.descripcion = descripcion;
    }
}

Role.SUPERADMIN = 'Superadmin';
Role.PROFESOR = 'Profesor';
Role.ALUMNO = 'Alumno';

module.exports = Role;
