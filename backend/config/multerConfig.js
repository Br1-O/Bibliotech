/**
* Project     : Bibliotech
* Author      : Bruno O. Ortuno
* License     : http://www.gnu.org/licenses/gpl.txt  GNU GPL 3.0
* Date        : 2026
*
* Configuracion de Multer para el almacenamiento fisico del material educativo.
* Los enlaces externos (Drive / YouTube / GitHub) no usan este middleware.
* Soporte para FILES_MODE local | cloud (Cloudinary) para despliegue en Vercel.
*/
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { PassThrough } = require('stream');
const { getConfig } = require('./env');

const config = getConfig();
const FILES_MODE = config.upload.mode;
const MAX_FILE_SIZE = config.upload.maxFileBytes;
const MAX_FILES = config.upload.maxFiles;
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const DOCUMENT_MIME = [
    'application/pdf',
    'application/epub+zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.presentation',
    'application/octet-stream'
];

let storage;

if (FILES_MODE === 'cloud') {
    const cloudinary = require('cloudinary').v2;

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    // Cloudinary no expone el contenido del archivo, por lo que calculamos el
    // hash SHA-256 mientras Multer lo transmite para detectar duplicados (RD-05).
    class HashingCloudinaryStorage {
        constructor(options) {
            if (!options || !options.cloudinary) throw new Error('cloudinary option required');
            this.cloudinary = options.cloudinary;
            this.params = options.params || {};
        }

        _handleFile(req, file, callback) {
            const hasher = crypto.createHash('sha256');
            const headerChunks = [];
            let headerSize = 0;
            const pass = new PassThrough();
            file.stream.on('data', chunk => {
                hasher.update(chunk);
                if (headerSize < 32) {
                    headerChunks.push(chunk.subarray(0, 32 - headerSize));
                    headerSize += Math.min(chunk.length, 32 - headerSize);
                }
            });
            file.stream.pipe(pass);

            Promise.resolve(typeof this.params === 'function' ? this.params(req, file) : this.params)
                .then(options => {
                    const uploadOptions = Object.assign({}, options);
                    if (typeof uploadOptions.public_id === 'function') {
                        uploadOptions.public_id = uploadOptions.public_id(req, file);
                    }
                    file.resourceType = uploadOptions.resource_type;
                    const stream = this.cloudinary.uploader.upload_stream(uploadOptions, (error, info) => {
                        if (error) return callback(error);
                        callback(undefined, {
                            path: info.secure_url,
                            size: info.bytes,
                            filename: info.public_id,
                            resourceType: uploadOptions.resource_type,
                            fileHash: hasher.digest('hex'),
                            fileHeader: Buffer.concat(headerChunks)
                        });
                    });
                    pass.pipe(stream);
                })
                .catch(callback);
        }

        _removeFile(req, file, callback) {
            const options = { invalidate: true };
            if (file.resourceType) options.resource_type = file.resourceType;
            this.cloudinary.uploader.destroy(file.filename, options, callback);
        }
    }

    storage = new HashingCloudinaryStorage({
        cloudinary: cloudinary,
        params: async (req, file) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const isCover = file.fieldname === 'portada';
            const resourceType = isCover ? 'image' : (['.pdf', '.epub'].includes(ext) ? 'raw' : 'auto');
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            return {
                folder: 'bibliotech',
                resource_type: resourceType,
                access_mode: 'public',
                type: 'upload',
                public_id: resourceType === 'raw' ? `${uniqueSuffix}${ext}` : `${uniqueSuffix}`
            };
        }
    });
} else {
    const fs = require('fs');
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, UPLOAD_DIR),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
        }
    });
}

const fileFilter = (req, file, cb) => {
    if (!/^(archivos?|portadas?)(_\d+)?$/.test(String(file.fieldname || ''))) {
        return cb(new Error('VALIDATION_FILE_TYPE'), false);
    }
    const mime = String(file.mimetype || '').toLowerCase();
    if (/^portadas?(_\d+)?$/.test(String(file.fieldname || ''))) {
        return mime.startsWith('image/') ? cb(null, true) : cb(new Error('VALIDATION_COVER_TYPE'), false);
    }
    if (DOCUMENT_MIME.includes(mime)) return cb(null, true);
    return cb(new Error('VALIDATION_FILE_TYPE'), false);
};

const uploader = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES,
        fields: 60,
        parts: MAX_FILES + 60
    }
});

const materialUpload = uploader.fields([
    { name: 'archivo', maxCount: 1 },
    { name: 'portada', maxCount: 1 }
]);

// La carga masiva admite nombres dinamicos archivo_0/portada_0 para
// conservar la relacion entre cada archivo, su titulo y su portada.
const batchUpload = uploader.any();

module.exports = { materialUpload, batchUpload, MAX_FILE_SIZE, MAX_FILES, UPLOAD_DIR };
