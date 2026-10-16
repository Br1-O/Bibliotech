/**
* Project     : Bibliotech
* Author      : Bruno O. Ortuno
* License     : http://www.gnu.org/licenses/gpl.txt  GNU GPL 3.0
* Date        : 2026
*
* Configuracion de Multer para el almacenamiento fisico del material educativo.
* Los enlaces externos (Drive / YouTube) no usan este middleware.
*/

const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
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

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
});

// El campo del formulario se llama 'archivo'. Es opcional (puede ser un enlace).
module.exports = upload.single('archivo');
