/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (REST)
* MaterialController: vista global, subida con hash, moderacion (RF-04, RF-05).
*/

const path = require('path');
const { ok } = require('../utils/respond');
const hashHelper = require('../utils/hashHelper');
const fileHelper = require('../utils/fileHelper');

const TIPO_POR_EXT = {
    '.pdf': 'PDF',
    '.doc': 'Word', '.docx': 'Word',
    '.ppt': 'Presentacion', '.pptx': 'Presentacion'
};

const parseList = (value) => {
    if (value === undefined || value === null || value === '') return [];
    if (Array.isArray(value)) return value;
    return String(value).split(',').map(v => v.trim()).filter(Boolean);
};

module.exports = (container) => {
    const { materialService } = container;

    return {
        async global(req, res, next) {
            try {
                const filters = {
                    q: req.query.q || '',
                    subjects: parseList(req.query.subjects).map(Number).filter(Boolean),
                    tags: parseList(req.query.tags)
                };
                const materials = await materialService.getGlobalContent(filters);
                return ok(req, res, { materials });
            } catch (error) { return next(error); }
        },

        async upload(req, res, next) {
            let urlOrPath = null;
            try {
                let fileHash;
                let tipo = req.body.tipo;

                if (req.file) {
                    fileHash = hashHelper.hashFile(req.file.path);
                    urlOrPath = `/uploads/${req.file.filename}`;
                    if (!tipo) {
                        tipo = TIPO_POR_EXT[path.extname(req.file.originalname).toLowerCase()] || 'PDF';
                    }
                } else {
                    urlOrPath = req.body.urlOrPath;
                    fileHash = hashHelper.hashString(urlOrPath || '');
                    tipo = tipo || (String(urlOrPath).includes('youtu') ? 'Youtube' : 'Link_Drive');
                }

                const dto = {
                    titulo: req.body.titulo,
                    tipo,
                    urlOrPath,
                    fileHash,
                    descripcion: (req.body.descripcion || '').trim() || null,
                    categories: parseList(req.body.categories),
                    subjects: parseList(req.body.subjects)
                };

                const result = await materialService.uploadOrSuggestMaterial(dto, {
                    usuarioId: req.usuarioId, rol: req.rol
                });
                return ok(req, res, result, 201);
            } catch (error) {
                // Evita dejar archivos huerfanos si la operacion de negocio falla.
                if (urlOrPath && urlOrPath.startsWith('/uploads/')) fileHelper.deleteFile(urlOrPath);
                return next(error);
            }
        },

        async pending(req, res, next) {
            try {
                const materials = await materialService.getPendingMaterials(req.usuarioId);
                return ok(req, res, { materials });
            } catch (error) { return next(error); }
        },

        async pendingReview(req, res, next) {
            try {
                const materials = await materialService.getPendingForProfessor(req.usuarioId);
                return ok(req, res, { materials });
            } catch (error) { return next(error); }
        },

        async reject(req, res, next) {
            try {
                const result = await materialService.rejectMaterial(
                    req.params.id, Number(req.body.subjectId), { usuarioId: req.usuarioId, rol: req.rol });
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async approve(req, res, next) {
            try {
                const result = await materialService.approveMaterial(
                    req.params.id, Number(req.body.subjectId), { usuarioId: req.usuarioId, rol: req.rol });
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async associate(req, res, next) {
            try {
                const result = await materialService.associateMaterialToSubject(
                    req.params.id, Number(req.body.subjectId), { usuarioId: req.usuarioId, rol: req.rol });
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async cancel(req, res, next) {
            try {
                const result = await materialService.cancelPendingUpload(req.params.id, {
                    usuarioId: req.usuarioId, rol: req.rol
                });
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async remove(req, res, next) {
            try {
                const result = await materialService.delete(req.params.id, {
                    usuarioId: req.usuarioId, rol: req.rol
                });
                return ok(req, res, result);
            } catch (error) { return next(error); }
        }
    };
};
