/**
* Project     : Bibliotech  |  Capa: Aplicacion - Caso de Uso
* CareerService: gestion de carreras (grupo principal) y anios (grupo secundario).
*/

const db = require('../../config/db');
const Career = require('../../domain/entities/Career');
const CareerYear = require('../../domain/entities/CareerYear');
const AuditLog = require('../../domain/entities/AuditLog');
const AppError = require('../../utils/AppError');
const TtlCache = require('../../utils/ttlCache');
const ValidationHandler = require('../../validator/ValidationHandler');
const Required = require('../../validator/rules/Required');
const Length = require('../../validator/rules/Length');

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

class CareerService {
    constructor(careerRepository, auditLogService, languageManager) {
        this.careerRepository = careerRepository;
        this.auditLogService = auditLogService;
        this.languageManager = languageManager;
        this.referenceCache = new TtlCache({ ttlMs: 60000, maxEntries: 20 });
    }

    validateName(dto, field = 'nombre') {
        const validator = new ValidationHandler(this.languageManager)
            .with(new Required(field))
            .with(new Length(field, { min: 2, max: 100 }));
        if (!validator.validateThis(dto)) throw validator.toError();
    }

    normalizeColor(color) {
        if (color === undefined || color === null || color === '') return '#6f5bd3';
        const value = String(color).trim();
        if (!COLOR_PATTERN.test(value)) {
            throw new AppError('validation.invalidColor', { status: 422 });
        }
        return value.toLowerCase();
    }

    async createCareer(dto, usuarioId = null) {
        this.validateName(dto);
        const result = await db.transaction(async () => {
            const career = await this.careerRepository.save(new Career({
                nombre: String(dto.nombre).trim(),
                color: this.normalizeColor(dto.color)
            }));
            await this.auditLogService.record(AuditLog.OPERACIONES.ALTA_CARRERA, usuarioId, career.id);
            return this.careerRepository.findById(career.id);
        });
        this.referenceCache.clear();
        return result;
    }

    async updateCareer(id, dto, usuarioId = null) {
        const result = await db.transaction(async () => {
            const career = await this.careerRepository.findById(id);
            if (!career) throw new AppError('errors.notFound', { status: 404 });

            const changes = {};
            if (dto.nombre !== undefined) {
                this.validateName({ nombre: String(dto.nombre).trim() });
                changes.nombre = String(dto.nombre).trim();
            }
            if (dto.color !== undefined) changes.color = this.normalizeColor(dto.color);
            if (!Object.keys(changes).length) throw new AppError('validation.invalidData', { status: 422 });

            await this.careerRepository.update(id, changes);
            await this.auditLogService.record(AuditLog.OPERACIONES.MODIFICACION_CARRERA, usuarioId, id);
            return this.careerRepository.findById(id);
        });
        this.referenceCache.clear();
        return result;
    }

    async createYear(careerId, dto, usuarioId = null) {
        const result = await db.transaction(async () => {
            const career = await this.careerRepository.findById(careerId);
            if (!career) throw new AppError('errors.notFound', { status: 404 });
            this.validateName(dto);

            const year = await this.careerRepository.saveYear(new CareerYear({
                careerId,
                nombre: String(dto.nombre).trim(),
                orden: dto.orden !== undefined ? Number(dto.orden) || 0 : career.years.length + 1
            }));
            await this.auditLogService.record(AuditLog.OPERACIONES.ALTA_ANIO, usuarioId, year.id);
            return this.careerRepository.findYearById(year.id);
        });
        this.referenceCache.clear();
        return result;
    }

    async updateYear(yearId, dto, usuarioId = null) {
        const result = await db.transaction(async () => {
            const year = await this.careerRepository.findYearById(yearId);
            if (!year) throw new AppError('errors.notFound', { status: 404 });

            const changes = {};
            if (dto.nombre !== undefined) {
                this.validateName({ nombre: String(dto.nombre).trim() });
                changes.nombre = String(dto.nombre).trim();
            }
            if (dto.orden !== undefined) {
                const order = Number(dto.orden);
                if (!Number.isInteger(order) || order < 0) {
                    throw new AppError('validation.invalidData', { status: 422 });
                }
                changes.orden = order;
            }
            if (!Object.keys(changes).length) throw new AppError('validation.invalidData', { status: 422 });

            await this.careerRepository.updateYear(yearId, changes);
            await this.auditLogService.record(AuditLog.OPERACIONES.MODIFICACION_ANIO, usuarioId, yearId);
            return this.careerRepository.findYearById(yearId);
        });
        this.referenceCache.clear();
        return result;
    }

    async getAllCareers() {
        return this.referenceCache.getOrSet('careers:all', () => this.careerRepository.findAll());
    }

    async getCareerById(id) {
        const career = await this.careerRepository.findById(id);
        if (!career) throw new AppError('errors.notFound', { status: 404 });
        return career;
    }
}

module.exports = CareerService;
