/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Middleware)
* Rate limiting para uploads de archivos (DoS prevention)
*/

const { getConfig } = require('../config/env');
const { createRateLimiter } = require('./rateLimit');

function uploadRateLimit() {
    const config = getConfig().upload;
    return createRateLimiter({
        windowMs: config.rateWindowMs,
        max: config.rateLimit,
        scope: 'upload',
        keyGenerator: req => req.usuarioId || req.ip
    });
}

module.exports = { uploadRateLimit };
