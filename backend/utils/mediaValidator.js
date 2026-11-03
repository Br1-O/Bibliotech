/**
* Project     : Bibliotech  |  Capa: Utils
* Validacion de tipos de material y enlaces externos.
* Centraliza las reglas para archivos, enlaces y portadas.
*/

const fs = require('fs');
const path = require('path');
const { getConfig } = require('../config/env');

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
const MAX_COVER_SIZE = getConfig().upload.maxCoverBytes;
const HEADER_BYTES = 32;


const SIGNATURES = {
    pdf: buffer => buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-',
    zip: buffer => buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B
        && [0x03, 0x05, 0x07].includes(buffer[2]) && [0x04, 0x06, 0x08].includes(buffer[3]),
    ole: buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])),
    jpeg: buffer => buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF,
    png: buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])),
    gif: buffer => buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii')),
    webp: buffer => buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
        && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
};

function detectSignature(buffer) {
    if (!buffer || !buffer.length) return null;
    for (const [kind, test] of Object.entries(SIGNATURES)) {
        if (test(buffer)) return kind;
    }
    return null;
}

async function readFileHeader(file) {
    if (!file) return null;
    if (Buffer.isBuffer(file.fileHeader) && file.fileHeader.length) return file.fileHeader;
    if (Buffer.isBuffer(file.buffer) && file.buffer.length) return file.buffer.subarray(0, HEADER_BYTES);
    if (!file.path) return null;
    const handle = await fs.promises.open(file.path, 'r');
    try {
        const buffer = Buffer.alloc(HEADER_BYTES);
        const { bytesRead } = await handle.read(buffer, 0, HEADER_BYTES, 0);
        return buffer.subarray(0, bytesRead);
    } finally {
        await handle.close();
    }
}

function expectedKind(tipo, extension) {
    if (tipo === 'PDF') return 'pdf';
    if (tipo === 'EPUB') return 'zip';
    if (tipo === 'Word') return extension === '.doc' ? 'ole' : 'zip';
    if (tipo === 'Presentacion') return extension === '.ppt' ? 'ole' : 'zip';
    return null;
}

async function validateFileSignature(file, tipo) {
    if (!file || !isFileType(tipo)) return { ok: false, detected: null };
    const extension = extensionOf(file.originalname || file.filename);
    const expected = expectedKind(tipo, extension);
    const header = await readFileHeader(file);
    const detected = detectSignature(header);
    return { ok: Boolean(expected && detected === expected), detected, expected };
}

async function validateCoverSignature(file) {
    if (!file) return { ok: false, detected: null };
    const extension = extensionOf(file.originalname || file.filename);
    const expected = {
        '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.webp': 'webp', '.gif': 'gif'
    }[extension] || null;
    const header = await readFileHeader(file);
    const detected = detectSignature(header);
    return { ok: Boolean(expected && detected === expected), detected, expected };
}

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
    SIGNATURES,
    detectSignature,
    validateFileSignature,
    validateCoverSignature,
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
