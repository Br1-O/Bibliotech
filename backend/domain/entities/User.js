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
        createdAt = null,
        estado = 'Activo',
        verificationToken = null,
        verificationExpires = null,
        birthdate = null,
        gender = null,
        genderCustom = null,
        city = null,
        country = null,
        github = null,
        instagram = null,
        linkedin = null,
        career = null,
        institute = null,
        aboutMe = null,
        phone = '-',
        xp = 0,
        rankLevel = 1,
        rankTitle = null,
        rankNombre = null,
        rankPicture = null,
        profilePicture = '/img/profile_pictures/default-1.png'
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
        this.estado = estado || 'Activo';
        this.verificationToken = verificationToken;
        this.verificationExpires = verificationExpires;
        this.birthdate = User.formatDate(birthdate);
        this.gender = gender || null;
        this.genderCustom = genderCustom || null;
        this.city = city;
        this.country = country;
        this.github = github;
        this.instagram = instagram;
        this.linkedin = linkedin;
        this.career = career;
        this.institute = institute;
        this.aboutMe = aboutMe;
        this.phone = phone || '-';
        this.xp = Number(xp) || 0;
        this.rankLevel = Number(rankLevel) || 1;
        this.rankTitle = rankTitle || rankNombre;
        this.rankNombre = this.rankTitle;
        this.rankPicture = rankPicture || (this.rankTitle ? `/img/profile_pictures/${this.rankTitle}.png` : null);
        this.profilePicture = profilePicture || '/img/profile_pictures/default-1.png';
    }

    static formatDate(value) {
        if (!value) return null;
        if (value instanceof Date) {
            if (Number.isNaN(value.getTime())) return null;
            const pad = number => String(number).padStart(2, '0');
            return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
        }
        return String(value).slice(0, 10);
    }

    get nombreCompleto() {
        return `${this.nombre} ${this.apellido}`.trim();
    }

    /** La edad se calcula siempre a partir de la fecha de nacimiento. */
    get age() {
        if (!this.birthdate) return null;
        const born = new Date(`${this.birthdate}T00:00:00Z`);
        if (Number.isNaN(born.getTime())) return null;
        const now = new Date();
        let age = now.getUTCFullYear() - born.getUTCFullYear();
        const month = now.getUTCMonth() - born.getUTCMonth();
        if (month < 0 || (month === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
        return age >= 0 ? age : null;
    }

    isSuperadmin() { return this.roleNombre === 'Superadmin'; }
    isProfesor()   { return this.roleNombre === 'Profesor'; }
    isAlumno()     { return this.roleNombre === 'Alumno'; }

    isActivo() { return this.estado === 'Activo'; }
    isBaneado() { return this.estado === 'Baneado'; }
    isInactivo() { return this.estado === 'Inactivo'; }

    /**
     * RD-03: el token de reseteo debe existir y no estar expirado.
     */
    canResetPassword(now = new Date()) {
        if (!this.resetToken || !this.tokenExpiration) return false;
        return new Date(this.tokenExpiration).getTime() > now.getTime();
    }

    /** Limpia los datos sensibles antes de exponer el usuario por la API. */
    toSafeJSON() {
        const { password, resetToken, tokenExpiration, verificationToken, verificationExpires, ...safe } = this;
        return { ...safe, age: this.age, nombreCompleto: this.nombreCompleto };
    }
}

module.exports = User;
