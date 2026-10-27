/**
* Project     : Bibliotech  |  Capa: Utils
* Validacion de tipos de material y enlaces externos.
* Centraliza las reglas para archivos, enlaces y portadas.
*/

const path = require('path');

const FILE_TYPES = {
    PDF: {
        extensions: ['.pdf'],
        mime: ['application/pdf']
    },
    EPUB: {
        extensions: ['.epub'],
        mime: ['application/epub+zip', 'application/octet-stream']
    },
    Word: {
        extensions: ['.doc', '.docx'],
        mime: [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
    },
    Presentacion: {
        extensions: ['.ppt', '.pptx', '.odp'],
        mime: [
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.oasis.opendocument.presentation'
        ]
    }
};

const LINK_TYPES = ['Link_Drive', 'Youtube', 'Repositorio'];
const EXT_TO_TYPE = {};
Object.entries(FILE_TYPES).forEach(([tipo, config]) => {
    config.extensions.forEach(ext => { EXT_TO_TYPE[ext] = tipo; });
});

const ALLOWED_COVER_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const MAX_COVER_SIZE = 5 * 1024 * 1024;

function extensionOf(filename) {
    return path.extname(String(filename || '')).toLowerCase();
}

function isFileType(tipo) {
    return Object.prototype.hasOwnProperty.call(FILE_TYPES, tipo);
}

function isLinkType(tipo) {
    return LINK_TYPES.includes(tipo);
}

function inferTypeFromFilename(filename) {
    return EXT_TO_TYPE[extensionOf(filename)] || null;
}

function safeUrl(raw) {
    try {
        return new URL(String(raw || '').trim());
    } catch (error) {
        return null;
    }
}

function isYoutubeUrl(raw) {
    const url = safeUrl(raw);
    if (!url) return false;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return /^\/[A-Za-z0-9_-]{6,}$/.test(url.pathname);
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
        if (url.pathname === '/watch') return Boolean(url.searchParams.get('v'));
        return /^\/(shorts|embed|live)\/[A-Za-z0-9_-]{6,}/.test(url.pathname);
    }
    return false;
}

function isDriveUrl(raw) {
    const url = safeUrl(raw);
    if (!url) return false;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'drive.google.com') return false;
    return /^\/(file\/d\/|drive\/folders\/|folders\/|open|uc)/.test(url.pathname)
        || url.searchParams.has('id');
}

function isGithubRepoUrl(raw) {
    const url = safeUrl(raw);
    if (!url) return false;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'github.com') return false;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return false;
    const reserved = ['features', 'topics', 'collections', 'trending', 'marketplace', 'sponsors',
        'settings', 'notifications', 'explore', 'login', 'join', 'about', 'pricing', 'contact'];
    return !reserved.includes(parts[0].toLowerCase());
}

function inferTypeFromUrl(raw) {
    if (isYoutubeUrl(raw)) return 'Youtube';
    if (isGithubRepoUrl(raw)) return 'Repositorio';
    if (isDriveUrl(raw)) return 'Link_Drive';
    return null;
}

function isValidLink(tipo, raw) {
    switch (tipo) {
        case 'Youtube': return isYoutubeUrl(raw);
        case 'Link_Drive': return isDriveUrl(raw);
        case 'Repositorio': return isGithubRepoUrl(raw);
        default: return false;
    }
}

/** Valida que el archivo subido corresponda exactamente con el tipo elegido. */
function validateFileForType(file, tipo) {
    if (!file) return { ok: false, inferredType: null };
    const ext = extensionOf(file.originalname || file.filename);
    const inferredType = EXT_TO_TYPE[ext] || null;
    if (!isFileType(tipo)) return { ok: false, inferredType };
    const config = FILE_TYPES[tipo];
    if (!config.extensions.includes(ext)) return { ok: false, inferredType };
    const mime = String(file.mimetype || '').toLowerCase();
    if (mime && config.mime.length && !config.mime.includes(mime) && mime !== 'application/octet-stream') {
        return { ok: false, inferredType };
    }
    return { ok: true, inferredType };
}

/** Valida la imagen de portada (tipo y tamano). */
function validateCover(file) {
    if (!file) return { ok: false };
    const ext = extensionOf(file.originalname || file.filename);
    const mime = String(file.mimetype || '').toLowerCase();
    const validExt = ALLOWED_COVER_EXT.includes(ext);
    const validMime = mime.startsWith('image/') || mime === 'application/octet-stream';
    const validSize = !file.size || Number(file.size) <= MAX_COVER_SIZE;
    return { ok: Boolean(validExt && validMime && validSize) };
}

module.exports = {
    FILE_TYPES,
    LINK_TYPES,
    MAX_COVER_SIZE,
    isFileType,
    isLinkType,
    inferTypeFromFilename,
    inferTypeFromUrl,
    isValidLink,
    validateFileForType,
    validateCover,
    isYoutubeUrl,
    isDriveUrl,
    isGithubRepoUrl
};
