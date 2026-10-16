/**
* Project     : Bibliotech  |  Capa: Aplicacion - Caso de Uso
* RoleService: gestion normalizada de roles (RF-01, RD-02).
*/

const Role = require('../../domain/entities/Role');
const AuditLog = require('../../domain/entities/AuditLog');
const AppError = require('../../utils/AppError');
const ValidationHandler = require('../../validator/ValidationHandler');
const ValidationError = require('../../validator/ValidationError');
const Required = require('../../validator/rules/Required');
const Length = require('../../validator/rules/Length');

class RoleService {
    constructor(roleRepository, auditLogService, languageManager) {
        this.roleRepository = roleRepository;
        this.auditLogService = auditLogService;
        this.languageManager = languageManager;
    }

    async createRole(dto, usuarioId = null) {
        const validator = new ValidationHandler(this.languageManager)
            .with(new Required('nombre'))
            .with(new Length('nombre', { min: 2, max: 50 }));

        if (!validator.validateThis(dto)) {
            throw new ValidationError(validator.getErrors());
        }

        const existing = await this.roleRepository.findByName(dto.nombre);
        if (existing) throw new AppError('validation.roleTaken', { status: 409 });

        const role = await this.roleRepository.save(new Role({ nombre: dto.nombre, descripcion: dto.descripcion }));
        await this.auditLogService.record(AuditLog.OPERACIONES.ALTA_ROL, usuarioId, role.id);
        return role;
    }

    async getRoleById(id) {
        const role = await this.roleRepository.findById(id);
        if (!role) throw new AppError('errors.notFound', { status: 404 });
        return role;
    }

    async getAllRoles() {
        return this.roleRepository.findAll();
    }
}

module.exports = RoleService;
