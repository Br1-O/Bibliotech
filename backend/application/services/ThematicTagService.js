/**
* Project     : Bibliotech
*/

const AppError = require('../../utils/AppError');

class ThematicTagService {
    constructor(thematicTagRepository, auditLogService) {
        this.thematicTagRepository = thematicTagRepository;
        this.auditLogService = auditLogService;
    }

    async list(filters = {}) {
        return this.thematicTagRepository.findAll(filters);
    }

    async create(dto, usuarioId = null) {
        const nombre = (dto.nombre || '').trim();
        const categoria = (dto.categoria || '').trim() || 'general';
        if (!nombre) throw new AppError('errors.invalidData', { status: 400 });
        const existing = await this.thematicTagRepository.findByNameCategory(nombre, categoria);
        if (existing) {
            if (existing.baneado) throw new AppError('errors.invalidData', { status: 400 });
            return existing;
        }
        const tag = await this.thematicTagRepository.save({ nombre, categoria, creadoPor: usuarioId });
        return tag;
    }

    async ban(id, usuarioId = null) {
        const tag = await this.thematicTagRepository.findById(id);
        if (!tag) throw new AppError('errors.notFound', { status: 404 });
        await this.thematicTagRepository.ban(id);
        return { ...tag, baneado: 1 };
    }

    async remove(id, usuarioId = null) {
        const tag = await this.thematicTagRepository.findById(id);
        if (!tag) throw new AppError('errors.notFound', { status: 404 });
        await this.thematicTagRepository.delete(id);
        return true;
    }
}

module.exports = ThematicTagService;
