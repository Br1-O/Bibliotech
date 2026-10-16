/**
* Project     : Bibliotech  |  Capa: Dominio
* Entidad de negocio User. Encapsula las reglas de reseteo de contrasena (RD-03).
*/

class User {
    constructor({
        id = null,
        roleId,
        roleNombre = null,
        nombre,
        apellido,
        email,
        password,
        resetToken = null,
        tokenExpiration = null,
        createdAt = null
    }) {
        this.id = id;
        this.roleId = roleId;
        this.roleNombre = roleNombre;
        this.nombre = nombre;
        this.apellido = apellido;
        this.email = email;
        this.password = password;
        this.resetToken = resetToken;
        this.tokenExpiration = tokenExpiration;
        this.createdAt = createdAt;
    }

    get nombreCompleto() {
        return `${this.nombre} ${this.apellido}`.trim();
    }

    isSuperadmin() { return this.roleNombre === 'Superadmin'; }
    isProfesor()   { return this.roleNombre === 'Profesor'; }
    isAlumno()     { return this.roleNombre === 'Alumno'; }

    /**
     * RD-03: el token de reseteo debe existir y no estar expirado.
     */
    canResetPassword(now = new Date()) {
        if (!this.resetToken || !this.tokenExpiration) return false;
        return new Date(this.tokenExpiration).getTime() > now.getTime();
    }

    /** Limpia los datos sensibles antes de exponer el usuario por la API. */
    toSafeJSON() {
        const { password, resetToken, tokenExpiration, ...safe } = this;
        return { ...safe, nombreCompleto: this.nombreCompleto };
    }
}

module.exports = User;
