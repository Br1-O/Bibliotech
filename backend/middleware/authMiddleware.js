/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Middleware)
* Autenticacion JWT y autorizacion por rol (RF-01, RNF-04).
*/

const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'tu_clave_secreta_super_segura';

/** Verifica el token JWT y adjunta identidad + rol a la peticion. */
function verifyToken(req, res, next) {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: req.t('errors.unauthorized') });

    try {
        const payload = jwt.verify(token, SECRET_KEY);
        req.usuarioId = payload.id;
        req.rol = payload.role;
        return next();
    } catch (error) {
        return res.status(401).json({ message: req.t('errors.invalidToken') });
    }
}

/** Adjunta identidad si hay token valido, pero no bloquea al visitante anonimo. */
function optionalAuth(req, res, next) {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
        try {
            const payload = jwt.verify(token, SECRET_KEY);
            req.usuarioId = payload.id;
            req.rol = payload.role;
        } catch (error) { /* token invalido: se continua como anonimo */ }
    }
    return next();
}

/** Restringe el acceso a uno o mas roles. */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.rol) return res.status(401).json({ message: req.t('errors.unauthorized') });
        if (!roles.includes(req.rol)) return res.status(403).json({ message: req.t('errors.forbidden') });
        return next();
    };
}

module.exports = { verifyToken, optionalAuth, requireRole, SECRET_KEY };
