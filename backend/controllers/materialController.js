/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (REST)
* MaterialController: vista global, subida con hash, carga masiva y moderacion.
*/

const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { ok } = require('../utils/respond');
const hashHelper = require('../utils/hashHelper');
const fileHelper = require('../utils/fileHelper');
const mediaValidator = require('../utils/mediaValidator');
const AppError = require('../utils/AppError');
const { getConfig } = require('../config/env');
const { logger } = require('../utils/logger');
const metrics = require('../utils/metrics');
const { parsePagination, paginationMeta } = require('../utils/pagination');

const config = getConfig();
const FILES_MODE = config.upload.mode;

const parseList = (value) => {
    if (value === undefined || value === null || value === '') return [];
    if (Array.isArray(value)) return value;
    return String(value).split(',').map(v => v.trim()).filter(Boolean);
};

const getFile = (req, field) => (req.files && req.files[field] ? req.files[field][0] : null);

const storedPath = (file) => {
    if (!file) return null;
    return FILES_MODE === 'cloud' ? file.path : `/uploads/${file.filename}`;
};

const hashOf = async (file) => {
    if (FILES_MODE === 'cloud') return file.fileHash || hashHelper.hashString(file.path);
    return hashHelper.hashFile(file.path);
};

const uploadedFiles = (req) => {
    if (!req.files) return [];
    return Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
};

const cleanupUploads = async (req, createdPaths = []) => {
    const values = new Set(createdPaths);
    uploadedFiles(req).forEach(file => {
        const value = storedPath(file);
        if (value) values.add(value);
    });
    for (const value of values) {
        try { await fileHelper.deleteStorageFile(value); }
        catch (error) { logger.warn('upload.cleanup_failed', { error }); }
    }
};

const downloadName = (material) => {
    const source = String(material.urlOrPath || '').split(/[?#]/)[0];
    const extension = path.extname(source).toLowerCase()
        || ({ PDF: '.pdf', EPUB: '.epub', Word: '.docx', Presentacion: '.pptx' }[material.tipo] || '');
    const base = String(material.titulo || 'material')
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120) || 'material';
    return extension && !base.toLowerCase().endsWith(extension) ? `${base}${extension}` : base;
};

const CONTENT_TYPES = {
    PDF: 'application/pdf',
    EPUB: 'application/epub+zip',
    Word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    Presentacion: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

const contentDisposition = (disposition, name) => {
    const safeName = String(name || 'material').replace(/["\\\r\n]/g, '_');
    const encoded = encodeURIComponent(name || 'material')
        .replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    return `${disposition}; filename="${safeName}"; filename*=UTF-8''${encoded}`;
};

/**
 * Cloudinary entrega los PDFs subidos como "raw" con Content-Disposition
 * attachment, por lo que un redirect no permite visualizarlos en el iframe.
 * Se transmite el contenido desde el backend con el tipo y disposicion correctos.
 * Se reenvian los rangos para que el visor PDF del navegador pueda pedir por
 * partes y para no descargar el archivo completo en cada salto de pagina.
 */
const REMOTE_FILE_HEADERS = ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'];

const streamRemoteFile = async (req, res, material, disposition) => {
    const source = String(material.urlOrPath);
    const upstreamHeaders = { 'Accept-Encoding': 'identity' };
    if (req.headers.range) upstreamHeaders.Range = req.headers.range;
    if (req.headers['if-range']) upstreamHeaders['If-Range'] = req.headers['if-range'];

    const controller = new AbortController();
    let response;
    try {
        response = await fetch(source, {
            method: req.method === 'HEAD' ? 'HEAD' : 'GET',
            headers: upstreamHeaders,
            redirect: 'follow',
            signal: controller.signal
        });
    } catch (error) {
        if (error.name === 'AbortError') return;
        throw new AppError('errors.notFound', { status: 404 });
    }

    if (!response.ok || (req.method !== 'HEAD' && !response.body) ||
        !fileHelper.isCloudinaryUrl(response.url)) {
        throw new AppError('errors.notFound', { status: 404 });
    }

    const partial = response.status === 206 && Boolean(response.headers.get('content-range'));
    res.status(partial ? 206 : 200);
    const contentType = CONTENT_TYPES[material.tipo]
        || response.headers.get('content-type')
        || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', contentDisposition(disposition, downloadName(material)));
    REMOTE_FILE_HEADERS.forEach(name => {
        const value = response.headers.get(name);
        if (value) res.setHeader(name.replace(/(^|-)([a-z])/g, (_, dash, char) => dash + char.toUpperCase()), value);
    });
    if (!partial) res.removeHeader('Content-Range');

    if (req.method === 'HEAD') {
        res.end();
        return;
    }

    const abort = () => controller.abort();
    res.once('close', abort);
    try {
        await pipeline(Readable.fromWeb(response.body), res);
    } finally {
        res.off('close', abort);
    }
};

const sendLocalFile = (res, next, localPath, disposition, fileName) => {
    const onError = (error) => {
        if (!error) return;
        if (res.headersSent) return res.destroy(error);
        if (error.code === 'ENOENT' || error.status === 404) {
            return next(new AppError('errors.notFound', { status: 404 }));
        }
        return next(error);
    };
    res.setHeader('Content-Disposition', contentDisposition(disposition, fileName));
    return res.sendFile(localPath, onError);
};

const presentMaterial = (material) => {
    if (!material) return material;
    const result = typeof material.toJSON === 'function' ? material.toJSON() : { ...material };
    if (mediaValidator.isFileType(result.tipo)) {
        result.hasStoredFile = Boolean(result.urlOrPath);
        if (fileHelper.isCloudinaryUrl(result.urlOrPath)) result.urlOrPath = null;
    }
    return result;
};

const presentMaterials = (materials) => (materials || []).map(presentMaterial);

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
        const rest = line.slice(separator + 1);
        const second = rest.indexOf('|');
        return {
            titulo: line.slice(0, separator).trim(),
            urlOrPath: (second === -1 ? rest : rest.slice(0, second)).trim(),
            pages: second === -1 ? null : Number(rest.slice(second + 1).trim()) || null
        };
    }).filter(Boolean);
};

module.exports = (container) => {
    const { materialService, authService } = container;

    return {
        async global(req, res, next) {
            try {
                const pagination = parsePagination(req.query);
                const filters = {
                    q: req.query.q || '',
                    subjects: parseList(req.query.subjects).map(Number).filter(Boolean),
                    tags: parseList(req.query.tags),
                    tipo: req.query.tipo || null,
                    category: req.query.category || null,
                    uploadYear: req.query.year || req.query.uploadYear || null,
                    careers: req.query.careerId ? [Number(req.query.careerId)] : [],
                    years: req.query.yearId ? [Number(req.query.yearId)] : [],
                    ...pagination
                };
                const result = await materialService.getGlobalContent(filters, req.usuarioId);
                return ok(req, res, {
                    materials: presentMaterials(result.materials),
                    pagination: paginationMeta(result.total, pagination)
                });
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
                    if (!mediaValidator.validateCover(cover).ok
                        || !(await mediaValidator.validateCoverSignature(cover)).ok) {
                        metrics.recordUploadRejection('cover_signature');
                        throw new AppError('validation.coverType', { status: 422 });
                    }
                    portada = storedPath(cover);
                    createdPaths.push(portada);
                }

                if (file) {
                    if (!tipo) tipo = mediaValidator.inferTypeFromFilename(file.originalname);
                    if (!mediaValidator.isFileType(tipo) ||
                        !mediaValidator.validateFileForType(file, tipo).ok ||
                        !(await mediaValidator.validateFileSignature(file, tipo)).ok) {
                        metrics.recordUploadRejection('file_signature');
                        throw new AppError('validation.fileType', { status: 422 });
                    }
                    urlOrPath = storedPath(file);
                    fileHash = await hashOf(file);
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
                    author: req.body.author,
                    category: req.body.category || 'technical',
                    isMandatory: req.body.isMandatory,
                    descripcion: (req.body.descripcion || '').trim() || null,
                    pages: req.body.pages,
                    categories: parseList(req.body.categories),
                    subjects: parseList(req.body.subjects)
                };

                const result = await materialService.uploadOrSuggestMaterial(dto, {
                    usuarioId: req.usuarioId, rol: req.rol
                });
                if (result.duplicate) await cleanupUploads(req, createdPaths);
                return ok(req, res, { ...result, material: presentMaterial(result.material) }, 201);
            } catch (error) {
                await cleanupUploads(req, createdPaths);
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
                    let parsed;
                    try {
                        parsed = JSON.parse(req.body.metadata);
                    } catch (error) {
                        throw new AppError('validation.invalidData', { status: 422 });
                    }
                    if (!Array.isArray(parsed)) {
                        throw new AppError('validation.invalidData', { status: 422 });
                    }
                    metadata = parsed;
                    if (metadata.some(entry => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
                        throw new AppError('validation.invalidData', { status: 422 });
                    }
                }

                const linkEntries = parseBatchLinks(req.body.links);
                if (!files.length && !linkEntries.length) {
                    throw new AppError('validation.required', { status: 422, params: { field: 'Material' } });
                }
                if (files.length + linkEntries.length > config.upload.maxBatchItems) {
                    throw new AppError('validation.batchLimit', {
                        status: 422, params: { max: config.upload.maxBatchItems }
                    });
                }

                const categories = parseList(req.body.categories);
                const items = [];
                for (let index = 0; index < files.length; index += 1) {
                    const file = files[index];
                    const meta = metadata[index] || {};
                    const tipo = mediaValidator.inferTypeFromFilename(file.originalname);
                    if (!mediaValidator.isFileType(tipo) ||
                        !mediaValidator.validateFileForType(file, tipo).ok ||
                        !(await mediaValidator.validateFileSignature(file, tipo)).ok) {
                        metrics.recordUploadRejection('file_signature');
                        throw new AppError('validation.fileType', { status: 422 });
                    }

                    let portada = null;
                    const cover = covers.get(index);
                    if (cover) {
                        if (!mediaValidator.validateCover(cover).ok
                            || !(await mediaValidator.validateCoverSignature(cover)).ok) {
                            metrics.recordUploadRejection('cover_signature');
                            throw new AppError('validation.coverType', { status: 422 });
                        }
                        portada = storedPath(cover);
                        createdPaths.push(portada);
                    }

                    const customTitle = String(meta.titulo || '').trim();
                    const urlOrPath = storedPath(file);
                    createdPaths.push(urlOrPath);
                    items.push({
                        titulo: (customTitle || titleFromFilename(file.originalname) || 'Material').slice(0, 150),
                        tipo,
                        urlOrPath,
                        portada,
                        fileHash: await hashOf(file),
                        author: meta.author || null,
                        category: meta.category || req.body.category || 'technical',
                        pages: meta.pages ?? null,
                        categories: meta.categories ? parseList(meta.categories) : categories
                    });
                }

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
                        author: entry.author || null,
                        category: entry.category || req.body.category || 'technical',
                        pages: entry.pages ?? null,
                        categories
                    });
                });

                const result = await materialService.uploadBatch(items, {
                    usuarioId: req.usuarioId, rol: req.rol
                });
                return ok(req, res, { ...result, materials: presentMaterials(result.materials) }, 201);
            } catch (error) {
                await cleanupUploads(req, createdPaths);
                return next(error);
            }
        },

        async filters(req, res, next) {
            try {
                const options = await materialService.getFilterOptions();
                return ok(req, res, options);
            } catch (error) { return next(error); }
        },

        async mine(req, res, next) {
            try {
                const pagination = parsePagination(req.query);
                const filters = {
                    q: req.query.q || '',
                    tipo: req.query.tipo || null,
                    tags: parseList(req.query.tags),
                    estado: req.query.estado || null,
                    ...pagination
                };
                const result = await materialService.getMyUploads(req.usuarioId, filters);
                return ok(req, res, {
                    materials: presentMaterials(result.materials),
                    pagination: paginationMeta(result.total, pagination)
                });
            } catch (error) { return next(error); }
        },

        async author(req, res, next) {
            try {
                const user = await authService.getPublicUserById(req.params.id);
                const pagination = parsePagination(req.query);
                const filters = {
                    q: req.query.q || '',
                    tipo: req.query.tipo || null,
                    tags: parseList(req.query.tags),
                    estado: 'Aprobado',
                    ...pagination
                };
                const result = await materialService.getByAuthor(req.params.id, filters);
                return ok(req, res, {
                    author: user,
                    materials: presentMaterials(result.materials),
                    pagination: paginationMeta(result.total, pagination)
                });
            } catch (error) { return next(error); }
        },

        async pending(req, res, next) {
            try {
                const pagination = parsePagination(req.query);
                const result = await materialService.getPendingMaterials(req.usuarioId, pagination);
                return ok(req, res, {
                    materials: presentMaterials(result.materials),
                    pagination: paginationMeta(result.total, pagination)
                });
            } catch (error) { return next(error); }
        },

        async pendingReview(req, res, next) {
            try {
                const pagination = parsePagination(req.query);
                const result = await materialService.getPendingForProfessor(req.usuarioId, pagination);
                return ok(req, res, {
                    materials: presentMaterials(result.materials),
                    pagination: paginationMeta(result.total, pagination)
                });
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
                    pages: req.body.pages !== undefined ? req.body.pages : undefined,
                    tipo: req.body.tipo !== undefined ? String(req.body.tipo).trim() : undefined,
                    categories: req.body.categories !== undefined ? parseList(req.body.categories) : undefined,
                    author: req.body.author,
                    category: req.body.category,
                    isMandatory: req.body.isMandatory,
                    subjectId: req.body.subjectId
                };

                if (cover) {
                    if (!mediaValidator.validateCover(cover).ok
                        || !(await mediaValidator.validateCoverSignature(cover)).ok) {
                        metrics.recordUploadRejection('cover_signature');
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
                        !mediaValidator.validateFileForType(file, dto.tipo).ok ||
                        !(await mediaValidator.validateFileSignature(file, dto.tipo)).ok) {
                        metrics.recordUploadRejection('file_signature');
                        throw new AppError('validation.fileType', { status: 422 });
                    }
                    dto.urlOrPath = storedPath(file);
                    dto.fileHash = await hashOf(file);
                    createdPaths.push(dto.urlOrPath);
                } else if (req.body.urlOrPath !== undefined) {
                    dto.urlOrPath = String(req.body.urlOrPath || '').trim();
                }

                const result = await materialService.update(req.params.id, dto, {
                    usuarioId: req.usuarioId, rol: req.rol
                });
                return ok(req, res, { ...result, material: presentMaterial(result.material) });
            } catch (error) {
                await cleanupUploads(req, createdPaths);
                return next(error);
            }
        },

        async file(req, res, next) {
            try {
                const material = await materialService.getDownloadable(req.params.id, {
                    usuarioId: req.usuarioId, rol: req.rol
                });
                const urlOrPath = String(material.urlOrPath || '');
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('Cache-Control', 'private, no-store');

                if (fileHelper.isRemoteUrl(urlOrPath)) {
                    if (!fileHelper.isCloudinaryUrl(urlOrPath)) return res.redirect(302, urlOrPath);
                    return await streamRemoteFile(req, res, material, 'inline');
                }

                const localPath = fileHelper.resolveLocalPath(urlOrPath);
                if (!localPath) throw new AppError('errors.notFound', { status: 404 });
                return sendLocalFile(res, next, localPath, 'inline', downloadName(material));
            } catch (error) {
                if (res.headersSent) return res.destroy(error);
                return next(error);
            }
        },

        async download(req, res, next) {
            try {
                const material = await materialService.getDownloadable(req.params.id, {
                    usuarioId: req.usuarioId, rol: req.rol
                });
                const urlOrPath = String(material.urlOrPath || '');
                const name = downloadName(material);
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('Cache-Control', 'private, no-store');

                if (fileHelper.isRemoteUrl(urlOrPath)) {
                    if (!fileHelper.isCloudinaryUrl(urlOrPath)) return res.redirect(302, urlOrPath);
                    return await streamRemoteFile(req, res, material, 'attachment');
                }

                const localPath = fileHelper.resolveLocalPath(urlOrPath);
                if (!localPath) throw new AppError('errors.notFound', { status: 404 });
                return sendLocalFile(res, next, localPath, 'attachment', name);
            } catch (error) {
                if (res.headersSent) return res.destroy(error);
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
                const pagination = parsePagination(req.query);
                const result = await materialService.getFavorites(req.usuarioId, pagination);
                return ok(req, res, {
                    favorites: presentMaterials(result.materials),
                    materials: presentMaterials(result.materials),
                    pagination: paginationMeta(result.total, pagination)
                });
            } catch (error) { return next(error); }
        }
    };
};
