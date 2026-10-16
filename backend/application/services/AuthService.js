/**
* Project     : Bibliotech  |  Capa: Aplicacion - Caso de Uso
* AuthService: registro, autenticacion y recuperacion de contrasena (RF-01).
* Implementa el flujo de reseteo con token temporal (RD-03).
*/

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../../domain/entities/User');
const Role = require('../../domain/entities/Role');
const AuditLog = require('../../domain/entities/AuditLog');
const AppError = require('../../utils/AppError');
const hashHelper = require('../../utils/hashHelper');
const ValidationHandler = require('../../validator/ValidationHandler');
const ValidationError = require('../../validator/ValidationError');
const Required = require('../../validator/rules/Required');
const Email = require('../../validator/rules/Email');
const Password = require('../../validator/rules/Password');
const Length = require('../../validator/rules/Length');

const SECRET_KEY = process.env.JWT_SECRET || 'tu_clave_secreta_super_segura';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '2h';
const RESET_MINUTES = parseInt(process.env.RESET_TOKEN_MINUTES || '60', 10);

class AuthService {
    constructor(userRepository, roleRepository, auditLogService, languageManager) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.auditLogService = auditLogService;
        this.languageManager = languageManager;
    }

    validateRegistration(dto) {
        const validator = new ValidationHandler(this.languageManager)
            .with(new Required('nombre'))
            .with(new Length('nombre', { min: 2, max: 50 }))
            .with(new Required('apellido'))
            .with(new Length('apellido', { min: 2, max: 50 }))
            .with(new Required('email'))
            .with(new Email('email'))
            .with(new Required('password'))
            .with(new Password('password'));

        if (!validator.validateThis(dto)) throw new ValidationError(validator.getErrors());
    }

    /**
     * Registro publico: siempre crea una cuenta con rol Alumno.
     */
    async register(dto) {
        this.validateRegistration(dto);

        const existing = await this.userRepository.findByEmail(dto.email);
        if (existing) throw new AppError('validation.emailTaken', { status: 409 });

        const role = await this.roleRepository.findByName(Role.ALUMNO);
        if (!role) throw new AppError('validation.roleTaken', { status: 500 });

        const hashed = await bcrypt.hash(dto.password, 10);
        const user = await this.userRepository.save(new User({
            roleId: role.id,
            nombre: dto.nombre.trim(),
            apellido: dto.apellido.trim(),
            email: dto.email.trim().toLowerCase(),
            password: hashed
        }));

        await this.auditLogService.record(AuditLog.OPERACIONES.ALTA_USUARIO, null, user.id);
        return this.userRepository.findById(user.id);
    }

    /** El superadministrador crea cuentas de profesor (RF-02 / RF-01). */
    async createProfessor(dto, usuarioId) {
        this.validateRegistration(dto);
        const roleProfesor = await this.roleRepository.findByName(Role.PROFESOR);
        if (!roleProfesor) throw new AppError('errors.serverError', { status: 500 });

        const existing = await this.userRepository.findByEmail(dto.email);
        if (existing) throw new AppError('validation.emailTaken', { status: 409 });

        const password = await bcrypt.hash(dto.password, 10);
        const user = await this.userRepository.save(new User({
            roleId: roleProfesor.id,
            nombre: dto.nombre,
            apellido: dto.apellido,
            email: dto.email,
            password
        }));
        await this.auditLogService.record(AuditLog.OPERACIONES.ALTA_USUARIO, usuarioId, user.id);
        return this.userRepository.findById(user.id).then(fresh => fresh.toSafeJSON());
    }

    async login({ email, password }, usuarioId = null) {
        const validator = new ValidationHandler(this.languageManager)
            .with(new Required('email')).with(new Required('password'));
        if (!validator.validateThis({ email, password })) throw new ValidationError(validator.getErrors());

        const user = await this.userRepository.findByEmail(email);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw new AppError('errors.invalidCredentials', { status: 401 });
        }

        const token = jwt.sign(
            { id: user.id, role: user.roleNombre },
            SECRET_KEY,
            { expiresIn: JWT_EXPIRES }
        );
        return { token, user: user.toSafeJSON() };
    }

    /**
     * RF-01.5 / RD-03: genera token aleatorio con expiracion.
     * En produccion el token se enviaria por correo; aqui se devuelve para
     * permitir el flujo completo en el entorno academico.
     */
    async requestPasswordReset(email) {
        const user = await this.userRepository.findByEmail(email);
        // Respuesta uniforme para no filtrar la existencia del correo.
        const generic = { message: 'messages.resetRequested' };
        if (!user) return generic;

        const token = hashHelper.randomToken();
        const expiration = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
        await this.userRepository.setResetToken(email, token, expiration);
        await this.auditLogService.record(AuditLog.OPERACIONES.SOLICITUD_RESETEO, user.id, user.id);

        // En produccion se enviaria por correo; aqui se retorna para la demo.
        return { ...generic, token, expiresInMinutes: RESET_MINUTES };
    }

    async resetPassword(token, newPassword) {
        const validator = new ValidationHandler(this.languageManager)
            .with(new Required('token')).with(new Password('password'));
        if (!validator.validateThis({ token, password: newPassword })) {
            throw new ValidationError(validator.getErrors());
        }

        const user = await this.userRepository.findByResetToken(token);
        if (!user) throw new AppError('errors.invalidToken', { status: 400 });
        if (!user.canResetPassword()) throw new AppError('errors.invalidToken', { status: 400 });

        const hashed = await bcrypt.hash(newPassword, 10);
        await this.userRepository.updatePassword(user.id, hashed);
        await this.auditLogService.record(AuditLog.OPERACIONES.CAMBIO_CLAVE, user.id, user.id);
        return { message: 'messages.passwordChanged' };
    }


    async banUser(userId, usuarioId = null) {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new AppError('errors.notFound', { status: 404 });
        await this.userRepository.updateEstado(userId, 'Baneado');
        await this.auditLogService.record(AuditLog.OPERACIONES.BANEO_ALUMNO, usuarioId, userId);
        return { message: 'messages.banned' };
    }

    async unbanUser(userId, usuarioId = null) {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new AppError('errors.notFound', { status: 404 });
        await this.userRepository.updateEstado(userId, 'Activo');
        return { message: 'messages.userUnbanned' };
    }

    async softDeleteUser(userId, usuarioId = null) {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new AppError('errors.notFound', { status: 404 });
        await this.userRepository.softDelete(userId);
        return { message: 'messages.userDeleted' };
    }

    async getUserById(id) {
        const user = await this.userRepository.findById(id);
        if (!user) throw new AppError('errors.notFound', { status: 404 });
        return user.toSafeJSON();
    }
}

module.exports = AuthService;