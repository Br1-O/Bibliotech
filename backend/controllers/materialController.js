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
                const materials = await materialService.getGlobalContent(filters, req.usuarioId);
                return ok(req, res, { materials });
            } catch (error) { return next(error); }
        },

        async upload(req, res, next) {
            let urlOrPath = null;
            try {
                let fileHash;
                let tipo = req.body.tipo;

                if (req.file) {
                    const mode = process.env.FILES_MODE || 'local';
                    if (mode === 'cloud') {
                        // multer-storage-cloudinary sets req.file.path as secure_url, filename as public_id
                        urlOrPath = req.file.path;
                        fileHash = hashHelper.hashString(urlOrPath);
                    } else {
                        console.log("local")
                        fileHash = hashHelper.hashFile(req.file.path);
                        urlOrPath = `/uploads/${req.file.filename}`;
                    }
                    if (!tipo) {
                        const ext = path.extname(req.file.originalname).toLowerCase();
                        tipo = TIPO_POR_EXT[ext] || 'PDF';
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
                const mode = process.env.FILES_MODE || 'local';
                if (urlOrPath && urlOrPath.startsWith('/uploads/') && mode !== 'cloud') fileHelper.deleteFile(urlOrPath);
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

        async update(req, res, next) {
            try {
                const result = await materialService.update(req.params.id, {
                    titulo: req.body.titulo,
                    descripcion: req.body.descripcion
                }, { usuarioId: req.usuarioId, rol: req.rol });
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async remove(req, res, next) {
            try {
                const subjectId = req.params.subjectId
                    ? Number(req.params.subjectId)
                    : (req.query.subjectId ? Number(req.query.subjectId) : null);
                const result = await materialService.delete(req.params.id, {
                    usuarioId: req.usuarioId, rol: req.rol
                }, subjectId);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },
        async toggleFavorite(req, res, next) {
            try {
                const result = await materialService.toggleFavorite(req.params.id, req.usuarioId);
                return ok(req, res, result);
            } catch (error) { return next(error); }
        },

        async getFavorites(req, res, next) {
            try {
                const favorites = await materialService.getFavorites(req.usuarioId, req.query);
                return ok(req, res, { favorites });
            } catch (error) { return next(error); }
        }
    };
};
