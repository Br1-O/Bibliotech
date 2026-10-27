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
require('dotenv').config();

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { PassThrough } = require('stream');

const FILES_MODE = process.env.FILES_MODE || 'local';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
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

if (process.env.FILES_MODE === 'cloud') {
    const cloudinary = require('cloudinary').v2;
    const { CloudinaryStorage } = require('multer-storage-cloudinary');

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    // Cloudinary no expone el contenido del archivo, por lo que calculamos el
    // hash SHA-256 mientras Multer lo transmite para detectar duplicados (RD-05).
    class HashingCloudinaryStorage extends CloudinaryStorage {
        _handleFile(req, file, callback) {
            const hasher = crypto.createHash('sha256');
            const pass = new PassThrough();
            file.stream.on('data', chunk => hasher.update(chunk));
            file.stream.pipe(pass);
            const uploadFile = Object.assign({}, file, { stream: pass });

            super._handleFile(req, uploadFile, (error, info) => {
                if (error) return callback(error);
                info.fileHash = hasher.digest('hex');
                callback(undefined, info);
            });
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
    limits: { fileSize: MAX_FILE_SIZE, files: 220 }
});

const materialUpload = uploader.fields([
    { name: 'archivo', maxCount: 1 },
    { name: 'portada', maxCount: 1 }
]);

// La carga masiva admite nombres dinamicos archivo_0/portada_0 para
// conservar la relacion entre cada archivo, su titulo y su portada.
const batchUpload = uploader.any();

module.exports = { materialUpload, batchUpload, MAX_FILE_SIZE };
