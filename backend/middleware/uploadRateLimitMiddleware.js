/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Middleware)
* Rate limiting para uploads de archivos (DoS prevention)
*/

const AppError = require('../utils/AppError');
const uploadLimitStore = new Map();

function uploadRateLimit(maxUploads = null, windowMs = null) {
    const envMax = Number(process.env.UPLOAD_RATE_LIMIT);
    const envWindow = Number(process.env.UPLOAD_RATE_WINDOW_MS);
    const max = Number.isFinite(envMax) && envMax > 0 ? envMax : (maxUploads || 50);
    const window = Number.isFinite(envWindow) && envWindow > 0 ? envWindow : (windowMs || 60000);
    // En pruebas/entorno de test se desactiva el rate limit para no interferir.
    if (process.env.NODE_ENV === 'testing') return (req, res, next) => next();
    return (req, res, next) => {
        const key = req.usuarioId || req.ip;
        const now = Date.now();
        const entry = uploadLimitStore.get(key);
        
        if (!entry || now > entry.resetTime) {
            uploadLimitStore.set(key, { count: 1, resetTime: now + window });
            return next();
        }
        
        if (entry.count >= max) {
            return next(new AppError('errors.tooManyRequests', { status: 429 }));
        }
        
        entry.count++;
        return next();
    };
}

module.exports = { uploadRateLimit };
