/**
* Project     : Bibliotech
* Author      : Bruno O. Ortuno
* License     : http://www.gnu.org/licenses/gpl.txt  GNU GPL 3.0
* Date        : 2026
*
* Configuracion de Multer para el almacenamiento fisico del material educativo.
* Los enlaces externos (Drive / YouTube) no usan este middleware.
* Soporte para FILES_MODE local | cloud (Cloudinary) para despliegue en Vercel.
*/
require('dotenv').config();

const multer = require('multer');
const path = require('path');

const FILES_MODE = process.env.FILES_MODE || 'local';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

let storage;
let upload;

if (FILES_MODE === 'cloud') {
    const cloudinary = require('cloudinary').v2;
    const { CloudinaryStorage } = require('multer-storage-cloudinary');

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    storage = new CloudinaryStorage({
        cloudinary,
        params: (req, file) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
            return {
                folder: 'bibliotech',
                resource_type: 'auto',
                public_id: filename.replace(ext, '')
            };
        }
    });

    upload = multer({
        storage,
        limits: { fileSize: MAX_FILE_SIZE }
    });
} else {
    storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, 'uploads/'),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
        }
    });

    // Tipos de documento soportados por la plataforma.
    const ALLOWED_MIME = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];

    const fileFilter = (req, file, cb) => {
        if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
        cb(new Error('VALIDATION_FILE_TYPE'), false);
    };

    upload = multer({
        storage,
        fileFilter,
        limits: { fileSize: MAX_FILE_SIZE } // 100 MB
    });
}

// El campo del formulario se llama 'archivo'. Es opcional (puede ser un enlace).
module.exports = upload.single('archivo');
