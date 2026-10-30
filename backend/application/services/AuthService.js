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
const Required = require('../../validator/rules/Required');
const Email = require('../../validator/rules/Email');
const Password = require('../../validator/rules/Password');
const Length = require('../../validator/rules/Length');
const SameAs = require('../../validator/rules/SameAs');
const { mailerService } = require('./mail/MailerService');

const SECRET_KEY = process.env.JWT_SECRET || 'tu_clave_secreta_super_segura';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '2h';
const RESET_MINUTES = parseInt(process.env.RESET_TOKEN_MINUTES || '60', 10);
const VERIFY_MINUTES = parseInt(process.env.VERIFY_TOKEN_MINUTES || '60', 10);
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const EXPOSE_DEV_TOKENS = process.env.NODE_ENV !== 'production';

class AuthService {
    constructor(userRepository, roleRepository, auditLogService, languageManager, mailer = mailerService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.auditLogService = auditLogService;
        this.languageManager = languageManager;
        this.mailer = mailer;
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
            .with(new Password('password'))
            .with(new SameAs('passwordConfirm', 'password'));

        if (!validator.validateThis(dto)) throw validator.toError();
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** Plantilla comun para los correos transaccionales. */
    emailLayout({ title, greeting, body, actionLabel, actionUrl, footer }) {
        const safeUrl = this.escapeHtml(actionUrl);
        return `
            <div style="background:#f6f3ff;padding:32px;font-family:Segoe UI,Arial,sans-serif;color:#252343">
                <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e2fb;border-radius:20px;padding:32px">
                    <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#7c6cd6;font-weight:700">Bibliotech</div>
                    <h1 style="font-size:24px;margin:18px 0 12px;color:#252343">${title}</h1>
                    <p style="font-size:15px;line-height:1.6;margin:0 0 12px">${greeting}</p>
                    <p style="font-size:15px;line-height:1.6;margin:0 0 20px">${body}</p>
                    <p style="margin:0 0 24px;text-align:center">
                        <a href="${safeUrl}" style="display:inline-block;background:#6f5bd3;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:12px">${actionLabel}</a>
                    </p>
                    <p style="font-size:13px;line-height:1.6;color:#77738e;margin:0 0 10px">Si el boton no funciona, copia y pega este enlace en tu navegador:</p>
                    <p style="font-size:12px;line-height:1.5;word-break:break-all;margin:0 0 20px"><a href="${safeUrl}" style="color:#6f5bd3">${safeUrl}</a></p>
                    <p style="font-size:13px;line-height:1.6;color:#77738e;margin:0">${footer}</p>
                </div>
            </div>`;
    }

    async sendVerificationEmail(user, token) {
        if (!this.mailer || !this.mailer.send) return false;
        const link = `${APP_URL}/activar-cuenta/${encodeURIComponent(token)}`;
        await this.mailer.send({
            to: user.email,
            senderName: 'Bibliotech',
            subject: 'Activa tu cuenta en Bibliotech',
            text: `Hola ${user.nombre}, activa tu cuenta de Bibliotech abriendo este enlace: ${link}. El enlace expira en ${VERIFY_MINUTES} minutos.`,
            html: this.emailLayout({
                title: 'Activa tu cuenta',
                greeting: `Hola ${this.escapeHtml(user.nombre)},`,
                body: 'Gracias por registrarte. Para activar tu cuenta, abre el siguiente enlace:',
                actionLabel: 'Activar mi cuenta',
                actionUrl: link,
                footer: `El enlace expira en ${VERIFY_MINUTES} minutos y solo puede usarse una vez.<br>Si no solicitaste este registro, ignora este correo.`
            })
        });
        return true;
    }

    async sendRecoveryEmail(user, token) {
        if (!this.mailer || !this.mailer.send) return false;
        const link = `${APP_URL}/restablecer-password/${encodeURIComponent(token)}`;
        await this.mailer.send({
            to: user.email,
            senderName: 'Bibliotech',
            subject: 'Recuperacion de contrasena - Bibliotech',
            text: `Hola ${user.nombre}, restablece tu contrasena de Bibliotech abriendo este enlace: ${link}. El enlace expira en ${RESET_MINUTES} minutos.`,
            html: this.emailLayout({
                title: 'Recupera tu contrasena',
                greeting: `Hola ${this.escapeHtml(user.nombre)},`,
                body: 'Recibimos una solicitud para restablecer tu contrasena. Abre el siguiente enlace para elegir una nueva:',
                actionLabel: 'Restablecer contrasena',
                actionUrl: link,
                footer: `El enlace expira en ${RESET_MINUTES} minutos y solo puede usarse una vez.<br>Si no solicitaste este cambio, ignora este correo.`
            })
        });
        return true;
    }

    /**
     * Registro publico: crea una cuenta pendiente y envia el enlace de
     * activacion. Hasta confirmarla, el login queda bloqueado.
     */
    async register(dto) {
        this.validateRegistration(dto);

        const email = dto.email.trim().toLowerCase();
        const existing = await this.userRepository.findByEmail(email);
        if (existing) throw new AppError('validation.emailTaken', { status: 409 });

        const role = await this.roleRepository.findByName(Role.ALUMNO);
        if (!role) throw new AppError('validation.roleTaken', { status: 500 });

        const hashed = await bcrypt.hash(dto.password, 10);
        const user = await this.userRepository.save(new User({
            roleId: role.id,
            nombre: dto.nombre.trim(),
            apellido: dto.apellido.trim(),
            email,
            password: hashed,
            estado: 'PendienteVerificacion'
        }));

        const token = hashHelper.randomToken(32);
        const expiration = new Date(Date.now() + VERIFY_MINUTES * 60 * 1000);
        await this.userRepository.setVerificationToken(user.email, hashHelper.hashString(token), expiration);

        try {
            await this.sendVerificationEmail(user, token);
        } catch (error) {
            console.error(`[AUTH] No se pudo enviar el correo de verificacion a ${user.email}: ${error.message}`);
        }

        await this.auditLogService.record(AuditLog.OPERACIONES.ALTA_USUARIO, null, user.id);
        const fresh = await this.userRepository.findById(user.id);
        const result = { user: fresh.toSafeJSON() };
        if (EXPOSE_DEV_TOKENS) result.devToken = token;
        return result;
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
        if (!validator.validateThis({ email, password })) throw validator.toError();

        const user = await this.userRepository.findByEmail(String(email).trim().toLowerCase());
        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw new AppError('errors.invalidCredentials', { status: 401 });
        }
        if (user.estado === 'PendienteVerificacion') {
            throw new AppError('errors.accountNotVerified', { status: 403 });
        }
        if (user.estado === 'Inactivo' || user.estado === 'Baneado') {
            throw new AppError('errors.accountDisabled', { status: 403 });
        }
        
        const token = jwt.sign(
            { id: user.id, role: user.roleNombre },
            SECRET_KEY,
            { expiresIn: JWT_EXPIRES }
        );
        return { token, user: user.toSafeJSON() };
    }

    /**
     * RF-01.5 / RD-03: genera token aleatorio con expiracion y lo envia por email.
     */
    async requestPasswordReset(email) {
        const validator = new ValidationHandler(this.languageManager)
            .with(new Required('email')).with(new Email('email'));
        if (!validator.validateThis({ email })) throw validator.toError();

        const normalizedEmail = String(email).trim().toLowerCase();
        const user = await this.userRepository.findByEmail(normalizedEmail);
        // Respuesta uniforme para no filtrar la existencia del correo.
        const generic = { message: 'messages.resetRequested' };
        if (!user) return generic;

        const token = hashHelper.randomToken(32);
        const expiration = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
        await this.userRepository.setResetToken(normalizedEmail, hashHelper.hashString(token), expiration);
        if (this.auditLogService) {
            try { await this.auditLogService.record(AuditLog.OPERACIONES.SOLICITUD_RESETEO, user.id, user.id); } catch (e) { /* audit no bloquea */ }
        }

        try {
            await this.sendRecoveryEmail(user, token);
        } catch (error) {
            console.error(`[AUTH] No se pudo enviar el correo de recuperacion a ${user.email}: ${error.message}`);
        }

        const result = { ...generic, expiresInMinutes: RESET_MINUTES };
        if (EXPOSE_DEV_TOKENS) result.devToken = token;
        return result;
    }

    /**
     * Activa la cuenta usando el token en claro recibido por email.
     * En la base de datos solo existe su hash SHA-256.
     */
    async activateAccount(rawToken) {
        if (!rawToken) throw new AppError('errors.invalidToken', { status: 400 });
        const tokenHash = hashHelper.hashString(String(rawToken).trim());
        const user = await this.userRepository.findByVerificationToken(tokenHash);
        const notExpired = user && user.verificationExpires && new Date(user.verificationExpires).getTime() > Date.now();
        if (user && user.estado === 'PendienteVerificacion' && notExpired) {
            await this.userRepository.verifyUser(user.id);
            try { await this.auditLogService.record(AuditLog.OPERACIONES.VERIFICACION_CUENTA, user.id, user.id); } catch (e) { /* audit no bloquea */ }
            return { message: 'messages.accountVerified' };
        }
        throw new AppError('errors.invalidToken', { status: 400 });
    }

    /** Compatibilidad con el endpoint anterior basado en codigo. */
    async verifyAccount({ code, token, email = null } = {}) {
        const rawToken = token || code;
        if (email && rawToken) {
            const user = await this.userRepository.findByVerificationToken(hashHelper.hashString(String(rawToken).trim()));
            if (!user || String(user.email).toLowerCase() !== String(email).trim().toLowerCase()) {
                throw new AppError('errors.invalidToken', { status: 400 });
            }
        }
        return this.activateAccount(rawToken);
    }

    /** Reenvia el enlace de activacion sin revelar si el correo existe. */
    async resendVerification(email) {
        const validator = new ValidationHandler(this.languageManager)
            .with(new Required('email')).with(new Email('email'));
        if (!validator.validateThis({ email })) throw validator.toError();

        const user = await this.userRepository.findByEmail(String(email).trim().toLowerCase());
        const generic = { message: 'messages.verificationResent' };
        if (!user || user.estado !== 'PendienteVerificacion') return generic;

        const token = hashHelper.randomToken(32);
        const expiration = new Date(Date.now() + VERIFY_MINUTES * 60 * 1000);
        await this.userRepository.setVerificationToken(user.email, hashHelper.hashString(token), expiration);
        try {
            await this.sendVerificationEmail(user, token);
        } catch (error) {
            console.error(`[AUTH] No se pudo reenviar la verificacion a ${user.email}: ${error.message}`);
        }

        const result = { ...generic };
        if (EXPOSE_DEV_TOKENS) result.devToken = token;
        return result;
    }

    /** Comprueba si un enlace de recuperacion sigue siendo valido sin consumirlo. */
    async validateResetToken(rawToken) {
        if (!rawToken) return false;
        const user = await this.userRepository.findByResetToken(hashHelper.hashString(String(rawToken).trim()));
        return Boolean(user && user.canResetPassword());
    }

    async resetPassword(token, newPassword, passwordConfirm = undefined) {
        const validator = new ValidationHandler(this.languageManager)
            .with(new Required('token'))
            .with(new Password('password'))
            .with(new SameAs('passwordConfirm', 'password'));
        const payload = { token, password: newPassword, passwordConfirm };
        if (!validator.validateThis(payload)) throw validator.toError();

        const user = await this.userRepository.findByResetToken(hashHelper.hashString(String(token).trim()));
        if (!user) throw new AppError('errors.invalidToken', { status: 400 });
        if (!user.canResetPassword()) throw new AppError('errors.invalidToken', { status: 400 });

        const hashed = await bcrypt.hash(newPassword, 10);
        await this.userRepository.updatePassword(user.id, hashed);
        if (this.auditLogService) {
            try { await this.auditLogService.record(AuditLog.OPERACIONES.CAMBIO_CLAVE, user.id, user.id); } catch (e) { /* audit no bloquea */ }
        }
        return { message: 'messages.passwordChanged' };
    }

    /** Cambio de contrasena autenticado: exige la contrasena actual. */
    async changePassword(userId, { currentPassword, password, passwordConfirm } = {}) {
        const validator = new ValidationHandler(this.languageManager)
            .with(new Required('currentPassword'))
            .with(new Required('password'))
            .with(new Password('password'))
            .with(new SameAs('passwordConfirm', 'password'));
        const payload = { currentPassword, password, passwordConfirm };
        if (!validator.validateThis(payload)) throw validator.toError();

        const user = await this.userRepository.findById(userId);
        if (!user) throw new AppError('errors.notFound', { status: 404 });
        if (!(await bcrypt.compare(String(currentPassword), user.password))) {
            throw new AppError('validation.currentPassword', { status: 422 });
        }

        const hashed = await bcrypt.hash(password, 10);
        await this.userRepository.updatePassword(user.id, hashed);
        if (this.auditLogService) {
            try { await this.auditLogService.record(AuditLog.OPERACIONES.CAMBIO_CLAVE, user.id, user.id); } catch (e) { /* audit no bloquea */ }
        }
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
        await this.auditLogService.record(AuditLog.OPERACIONES.DESBANEO_USUARIO, usuarioId, userId);
        return { message: 'messages.userUnbanned' };
    }

    async softDeleteUser(userId, usuarioId = null) {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new AppError('errors.notFound', { status: 404 });
        await this.userRepository.softDelete(userId);
        await this.auditLogService.record(AuditLog.OPERACIONES.BAJA_USUARIO, usuarioId, userId);
        return { message: 'messages.userDeleted' };
    }

    async getUserById(id) {
        const user = await this.userRepository.findById(id);
        if (!user) throw new AppError('errors.notFound', { status: 404 });
        return user.toSafeJSON();
    }
}

module.exports = AuthService;