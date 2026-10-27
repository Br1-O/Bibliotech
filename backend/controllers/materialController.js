/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (REST)
* MaterialController: vista global, subida con hash, carga masiva y moderacion.
*/

const path = require('path');
const { ok } = require('../utils/respond');
const hashHelper = require('../utils/hashHelper');
const fileHelper = require('../utils/fileHelper');
const mediaValidator = require('../utils/mediaValidator');
const AppError = require('../utils/AppError');

const parseList = (value) => {
    if (value === undefined || value === null || value === '') return [];
    if (Array.isArray(value)) return value;
    return String(value).split(',').map(v => v.trim()).filter(Boolean);
};

const getFile = (req, field) => (req.files && req.files[field] ? req.files[field][0] : null);

const storedPath = (file) => {
    if (!file) return null;
    const mode = process.env.FILES_MODE || 'local';
    return mode === 'cloud' ? file.path : `/uploads/${file.filename}`;
};

const hashOf = (file) => {
    const mode = process.env.FILES_MODE || 'local';
    if (mode === 'cloud') return file.fileHash || hashHelper.hashString(file.path);
    return hashHelper.hashFile(file.path);
};

const titleFromFilename = (filename) => path.basename(filename, path.extname(filename)).slice(0, 150);

const parseBatchLinks = (raw) => {
    const entries = Array.isArray(raw) ? raw : String(raw || '').split(/\r?\n/);
    return entries.map(entry => {
        if (!entry) return null;
        if (typeof entry === 'object') {
            return { titulo: entry.titulo, urlOrPath: entry.url || entry.urlOrPath };
        }
        const line = String(entry).trim();
        if (!line) return null;
        const separator = line.indexOf('|');
        if (separator === -1) return { titulo: '', urlOrPath: line };
        return {
            titulo: line.slice(0, separator).trim(),
            urlOrPath: line.slice(separator + 1).trim()
        };
    }).filter(Boolean);
};

module.exports = (container) => {
    const { materialService, authService } = container;

    return {
        async global(req, res, next) {
            try {
                const filters = {
                    q: req.query.q || '',
                    subjects: parseList(req.query.subjects).map(Number).filter(Boolean),
                    tags: parseList(req.query.tags),
                    tipo: req.query.tipo || null,
                    careers: req.query.careerId ? [Number(req.query.careerId)] : [],
                    years: req.query.yearId ? [Number(req.query.yearId)] : []
                };
                const materials = await materialService.getGlobalContent(filters, req.usuarioId);
                return ok(req, res, { materials });
            } catch (error) { return next(error); }
        },

        async upload(req, res, next) {
            const createdPaths = [];
            try {
                const file = getFile(req, 'archivo');
                const cover = getFile(req, 'portada');
                let tipo = req.body.tipo;
                let urlOrPath;
                let fileHash;
                let portada = null;

                if (cover) {
                    if (!mediaValidator.validateCover(cover).ok) {
                        throw new AppError('validation.coverType', { status: 422 });
                    }
                    portada = storedPath(cover);
                    createdPaths.push(portada);
                }

                if (file) {
                    if (!tipo) tipo = mediaValidator.inferTypeFromFilename(file.originalname);
                    if (!mediaValidator.isFileType(tipo) ||
                        !mediaValidator.validateFileForType(file, tipo).ok) {
                        throw new AppError('validation.fileType', { status: 422 });
                    }
                    urlOrPath = storedPath(file);
                    fileHash = hashOf(file);
                    createdPaths.push(urlOrPath);
                } else {
                    urlOrPath = String(req.body.urlOrPath || '').trim();
                    if (!tipo) tipo = mediaValidator.inferTypeFromUrl(urlOrPath);
                    if (!mediaValidator.isLinkType(tipo) || !mediaValidator.isValidLink(tipo, urlOrPath)) {
                        throw new AppError('validation.invalidLink', { status: 422, params: { type: tipo || '' } });
                    }
                    fileHash = hashHelper.hashString(urlOrPath);
                }

                const dto = {
                    titulo: req.body.titulo,
                    tipo,
                    urlOrPath,
                    portada,
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
                const mode = process.env.FILES_MODE || 'local';
                if (mode !== 'cloud') {
                    createdPaths.forEach(value => fileHelper.deleteFile(value));
                }
                return next(error);
            }
        },

        async batch(req, res, next) {
            const createdPaths = [];
            try {
                const uploaded = Array.isArray(req.files) ? req.files : [];
                const legacyFiles = uploaded.filter(file => file.fieldname === 'archivos');
                const indexedFiles = uploaded
                    .filter(file => /^archivo_\d+$/.test(file.fieldname))
                    .sort((a, b) => Number(a.fieldname.split('_')[1]) - Number(b.fieldname.split('_')[1]));
                const files = indexedFiles.length ? indexedFiles : legacyFiles;
                const covers = new Map();
                uploaded.forEach(file => {
                    const indexed = file.fieldname.match(/^portada_(\d+)$/);
                    if (indexed) covers.set(Number(indexed[1]), file);
                });
                uploaded
                    .filter(file => file.fieldname === 'portadas')
                    .forEach((file, index) => { if (!covers.has(index)) covers.set(index, file); });

                let metadata = [];
                if (req.body.metadata) {
                    try {
                        const parsed = JSON.parse(req.body.metadata);
                        metadata = Array.isArray(parsed) ? parsed : [];
                    } catch (error) {
                        throw new AppError('validation.invalidData', { status: 422 });
                    }
                }

                const linkEntries = parseBatchLinks(req.body.links);
                if (!files.length && !linkEntries.length) {
                    throw new AppError('validation.required', { status: 422, params: { field: 'Material' } });
                }
                if (files.length + linkEntries.length > 100) {
                    throw new AppError('validation.batchLimit', { status: 422, params: { max: 100 } });
                }

                const categories = parseList(req.body.categories);
                const items = files.map((file, index) => {
                    const meta = metadata[index] || {};
                    const tipo = mediaValidator.inferTypeFromFilename(file.originalname);
                    if (!mediaValidator.isFileType(tipo) ||
                        !mediaValidator.validateFileForType(file, tipo).ok) {
                        throw new AppError('validation.fileType', { status: 422 });
                    }

                    let portada = null;
                    const cover = covers.get(index);
                    if (cover) {
                        if (!mediaValidator.validateCover(cover).ok) {
                            throw new AppError('validation.coverType', { status: 422 });
                        }
                        portada = storedPath(cover);
                        createdPaths.push(portada);
                    }

                    const customTitle = String(meta.titulo || '').trim();
                    const urlOrPath = storedPath(file);
                    createdPaths.push(urlOrPath);
                    return {
                        titulo: (customTitle || titleFromFilename(file.originalname) || 'Material').slice(0, 150),
                        tipo,
                        urlOrPath,
                        portada,
                        fileHash: hashOf(file),
                        categories
                    };
                });

                linkEntries.forEach(entry => {
                    const tipo = mediaValidator.inferTypeFromUrl(entry.urlOrPath);
                    if (!mediaValidator.isLinkType(tipo) || !mediaValidator.isValidLink(tipo, entry.urlOrPath)) {
                        throw new AppError('validation.invalidLink', { status: 422, params: { type: tipo || '' } });
                    }
                    items.push({
                        titulo: (entry.titulo || entry.urlOrPath).slice(0, 150),
                        tipo,
                        urlOrPath: entry.urlOrPath,
                        fileHash: hashHelper.hashString(entry.urlOrPath),
                        categories
                    });
                });

                const result = await materialService.uploadBatch(items, {
                    usuarioId: req.usuarioId, rol: req.rol
                });
                return ok(req, res, result, 201);
            } catch (error) {
                const mode = process.env.FILES_MODE || 'local';
                if (mode !== 'cloud') {
                    createdPaths.forEach(value => fileHelper.deleteFile(value));
                }
                return next(error);
            }
        },

        async mine(req, res, next) {
            try {
                const filters = {
                    q: req.query.q || '',
                    tipo: req.query.tipo || null,
                    tags: parseList(req.query.tags),
                    estado: req.query.estado || null
                };
                const materials = await materialService.getMyUploads(req.usuarioId, filters);
                return ok(req, res, { materials });
            } catch (error) { return next(error); }
        },

        async author(req, res, next) {
            try {
                const user = await authService.getUserById(req.params.id);
                const filters = {
                    q: req.query.q || '',
                    tipo: req.query.tipo || null,
                    tags: parseList(req.query.tags),
                    estado: 'Aprobado'
                };
                const materials = await materialService.getByAuthor(req.params.id, filters);
                return ok(req, res, {
                    author: {
                        id: user.id,
                        nombre: user.nombre,
                        apellido: user.apellido,
                        nombreCompleto: user.nombreCompleto,
                        email: user.email
                    },
                    materials
                });
            } catch (error) { return next(error); }
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
                const rawSubjectIds = req.body?.subjectIds ?? req.body?.subjectId;
                const result = await materialService.associateMaterialToSubjects(
                    req.params.id, rawSubjectIds, { usuarioId: req.usuarioId, rol: req.rol });
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
            const createdPaths = [];
            try {
                const file = getFile(req, 'archivo');
                const cover = getFile(req, 'portada');
                const dto = {
                    titulo: req.body.titulo,
                    descripcion: req.body.descripcion,
                    tipo: req.body.tipo !== undefined ? String(req.body.tipo).trim() : undefined,
                    categories: req.body.categories !== undefined ? parseList(req.body.categories) : undefined
                };

                if (cover) {
                    if (!mediaValidator.validateCover(cover).ok) {
                        throw new AppError('validation.coverType', { status: 422 });
                    }
                    dto.portada = storedPath(cover);
                    createdPaths.push(dto.portada);
                } else if (req.body.removePortada === true || req.body.removePortada === 'true' || req.body.removePortada === '1') {
                    dto.portada = null;
                }

                if (file) {
                    if (!dto.tipo) dto.tipo = mediaValidator.inferTypeFromFilename(file.originalname);
                    if (!mediaValidator.isFileType(dto.tipo) ||
                        !mediaValidator.validateFileForType(file, dto.tipo).ok) {
                        throw new AppError('validation.fileType', { status: 422 });
                    }
                    dto.urlOrPath = storedPath(file);
                    dto.fileHash = hashOf(file);
                    createdPaths.push(dto.urlOrPath);
                } else if (req.body.urlOrPath !== undefined) {
                    dto.urlOrPath = String(req.body.urlOrPath || '').trim();
                }

                const result = await materialService.update(req.params.id, dto, {
                    usuarioId: req.usuarioId, rol: req.rol
                });
                return ok(req, res, result);
            } catch (error) {
                const mode = process.env.FILES_MODE || 'local';
                if (mode !== 'cloud') {
                    createdPaths.forEach(value => fileHelper.deleteFile(value));
                }
                return next(error);
            }
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
