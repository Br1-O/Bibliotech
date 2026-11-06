/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Middleware)
* Rate limiting para uploads de archivos
*/

const AppError = require('../utils/AppError');

const uploadRequests = new Map();

function uploadRateLimit(options = {}) {
    const windowMs = options.windowMs || 60 * 1000; // 1 minuto por defecto
    const max = options.max || 5; // 5 uploads por minuto por defecto

    return (req, res, next) => {
        const userId = req.usuarioId || req.ip;
        const now = Date.now();
        
        if (!uploadRequests.has(userId)) {
            uploadRequests.set(userId, { count: 1, resetTime: now + windowMs });
            return next();
        }

        const userData = uploadRequests.get(userId);
        
        if (now > userData.resetTime) {
            uploadRequests.set(userId, { count: 1, resetTime: now + windowMs });
            return next();
        }

        if (userData.count >= max) {
            return next(new AppError('errors.tooManyRequests', { status: 429 }));
        }

        userData.count++;
        uploadRequests.set(userId, userData);
        return next();
    };
}

module.exports = { uploadRateLimit };
