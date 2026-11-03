/**
* Project     : Bibliotech  |  Capa: Infraestructura/Utils
* fileHelper: operaciones seguras sobre el almacenamiento del material subido.
* Distingue entre URL remotas (Cloudinary) y rutas locales del directorio uploads.
*/

const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads');
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function isRemoteUrl(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
}

function isCloudinaryUrl(value) {
    if (!isRemoteUrl(value)) return false;
    try {
        const url = new URL(String(value).trim());
        return /(^|\.)res\.cloudinary\.com$/i.test(url.hostname);
    } catch (error) {
        return false;
    }
}

function parseCloudinaryAsset(value) {
    try {
        const url = new URL(String(value).trim());
        const match = url.pathname.match(/^\/(image|raw|video)\/upload\/(?:v\d+\/)?(.+)$/i);
        if (!match) return null;
        const publicId = decodeURIComponent(match[2]);
        return {
            resourceType: match[1].toLowerCase(),
            publicId,
            publicIdWithoutExtension: publicId.replace(/\.[a-z0-9]+$/i, '')
        };
    } catch (error) {
        return null;
    }
}

const fileHelper = {
    UPLOAD_DIR,
    isRemoteUrl,
    isCloudinaryUrl,

    resolveLocalPath(relativePath) {
        if (typeof relativePath !== 'string') return null;
        const value = relativePath.trim();
        if (!value || value.includes('\u0000')) return null;
        if (isRemoteUrl(value) || value.startsWith('//') || URL_SCHEME.test(value)) return null;

        const uploadsPrefix = /^\/?uploads(?:[\\/]|$)/i;
        let relative;
        if (uploadsPrefix.test(value)) {
            relative = value.replace(uploadsPrefix, '');
        } else if (path.isAbsolute(value)) {
            const absolutePath = path.resolve(value);
            if (absolutePath === UPLOAD_DIR || absolutePath.startsWith(UPLOAD_DIR + path.sep)) {
                return absolutePath;
            }
            return null;
        } else {
            relative = value;
        }

        relative = relative.replace(/^[/\\]+/, '');
        if (!relative) return null;
        const absolutePath = path.resolve(UPLOAD_DIR, relative);
        if (absolutePath !== UPLOAD_DIR && !absolutePath.startsWith(UPLOAD_DIR + path.sep)) return null;
        return absolutePath;
    },

    /** Elimina un archivo fisico dado su ruta relativa (ej: /uploads/x.pdf). */
    deleteFile(relativePath) {
        if (!relativePath) return false;
        const absolutePath = this.resolveLocalPath(relativePath);
        if (!absolutePath) return false;
        try {
            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
                return true;
            }
        } catch (err) {
            console.error(`Error al borrar archivo: ${err.message}`);
        }
        return false;
    },

    async deleteCloudinaryFile(url) {
        const asset = parseCloudinaryAsset(url);
        if (!asset) return false;
        try {
            const cloudinary = require('cloudinary').v2;
            cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET
            });

            const candidates = [];
            const resourceTypes = [asset.resourceType, 'image', 'raw', 'video'];
            resourceTypes.forEach(resourceType => {
                [asset.publicId, asset.publicIdWithoutExtension].forEach(publicId => {
                    if (!publicId) return;
                    if (candidates.some(item => item.publicId === publicId && item.resourceType === resourceType)) return;
                    candidates.push({ publicId, resourceType });
                });
            });

            for (const candidate of candidates) {
                const result = await cloudinary.uploader.destroy(candidate.publicId, {
                    resource_type: candidate.resourceType,
                    invalidate: true
                });
                if (result && result.result === 'ok') return true;
            }
            return false;
        } catch (err) {
            console.error(`Error al borrar archivo remoto: ${err.message}`);
            return false;
        }
    },

    /**
     * Elimina el material del almacenamiento segun el origen de la ruta.
     * Las URLs externas que no son de Cloudinary (Drive/YouTube) no se borran.
     * @returns {Promise<boolean>}
     */
    async deleteStorageFile(urlOrPath) {
        if (!urlOrPath || typeof urlOrPath !== 'string') return false;
        const value = urlOrPath.trim();
        if (!value) return false;

        if (isRemoteUrl(value)) {
            if (!isCloudinaryUrl(value)) return false;
            return this.deleteCloudinaryFile(value);
        }
        if (value.startsWith('//') || URL_SCHEME.test(value)) return false;
        return this.deleteFile(value);
    }
};

module.exports = fileHelper;
