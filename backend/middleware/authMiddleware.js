const jwt = require('jsonwebtoken');
const { getConfig } = require('../config/env');
const AppError = require('../utils/AppError');

const FILE_COOKIE = 'bt_file_access';
const FILE_COOKIE_PATH = '/api';

function parseCookies(header = '') {
    return String(header || '').split(';').reduce((cookies, part) => {
        const index = part.indexOf('=');
        if (index === -1) return cookies;
        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        if (!key) return cookies;
        try { cookies[key] = decodeURIComponent(value); }
        catch (error) { cookies[key] = value; }
        return cookies;
    }, {});
}

function bearerToken(req) {
    const header = String(req.headers?.authorization || '');
    return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

function fileToken(req) {
    const cookies = parseCookies(req.headers?.cookie);
    return bearerToken(req) || cookies[FILE_COOKIE] || null;
}

function fileCookieMaxAge(token) {
    try {
        const payload = jwt.decode(token);
        if (!payload || !payload.exp) return undefined;
        return Math.max(0, (Number(payload.exp) * 1000) - Date.now());
    } catch (error) {
        return undefined;
    }
}

function fileCookieOptions(req) {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: Boolean(req.secure),
        path: FILE_COOKIE_PATH
    };
}

function setFileCookie(req, res, token) {
    if (!token || typeof res.cookie !== 'function') return;
    const maxAge = fileCookieMaxAge(token);
    const options = fileCookieOptions(req);
    if (maxAge !== undefined) options.maxAge = maxAge;
    res.cookie(FILE_COOKIE, token, options);
}

function clearFileCookie(req, res) {
    if (typeof res.clearCookie !== 'function') return;
    const { httpOnly, sameSite, secure, path } = fileCookieOptions(req);
    res.clearCookie(FILE_COOKIE, { httpOnly, sameSite, secure, path });
}

function createAuthMiddleware({ userRepository }) {
    const config = getConfig().jwt;

    async function authenticate(token) {
        if (!token) throw new AppError('errors.unauthorized', { status: 401 });
        let payload;
        try {
            payload = jwt.verify(token, config.secret, {
                algorithms: [config.algorithm],
                issuer: config.issuer,
                audience: config.audience
            });
        } catch (error) {
            throw new AppError('errors.invalidToken', { status: 401 });
        }

        const user = await userRepository.findById(payload.id);
        if (!user || !user.isActivo()) throw new AppError('errors.invalidToken', { status: 401 });
        if (Number(payload.ver) !== Number(user.tokenVersion)) {
            throw new AppError('errors.invalidToken', { status: 401 });
        }
        if (String(payload.role) !== String(user.roleNombre)) {
            throw new AppError('errors.invalidToken', { status: 401 });
        }
        return { user, payload };
    }

    function attach(req, user, payload, token) {
        req.usuarioId = user.id;
        req.rol = user.roleNombre;
        req.usuario = user;
        req.auth = { token, payload };
    }

    async function verifyToken(req, res, next) {
        try {
            const token = bearerToken(req);
            if (!token) return res.status(401).json({ message: req.t('errors.unauthorized') });
            const { user, payload } = await authenticate(token);
            attach(req, user, payload, token);
            setFileCookie(req, res, token);
            return next();
        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.status || 401).json({ message: req.t(error.messageKey) });
            }
            return next(error);
        }
    }

    async function optionalAuth(req, res, next) {
        const token = bearerToken(req);
        if (!token) return next();
        try {
            const { user, payload } = await authenticate(token);
            attach(req, user, payload, token);
            setFileCookie(req, res, token);
        } catch (error) {
            if (!(error instanceof AppError)) return next(error);
        }
        return next();
    }

    async function optionalFileAuth(req, res, next) {
        const token = fileToken(req);
        if (!token) return next();
        try {
            const { user, payload } = await authenticate(token);
            attach(req, user, payload, token);
            setFileCookie(req, res, token);
        } catch (error) {
            if (!(error instanceof AppError)) return next(error);
        }
        return next();
    }

    /**
     * Resuelve el usuario solo cuando el material no es publico. Evita una
     * consulta a users por cada peticion Range del visor de PDF.
     */
    async function attachFileUser(req, res) {
        const token = fileToken(req);
        if (!token) throw new AppError('errors.unauthorized', { status: 401 });
        try {
            const { user, payload } = await authenticate(token);
            attach(req, user, payload, token);
            setFileCookie(req, res, token);
            return { usuarioId: user.id, rol: user.roleNombre };
        } catch (error) {
            if (error instanceof AppError && !bearerToken(req)) clearFileCookie(req, res);
            throw error;
        }
    }

    function requireRole(...roles) {
        return (req, res, next) => {
            if (!req.rol) return res.status(401).json({ message: req.t('errors.unauthorized') });
            if (!roles.includes(req.rol)) return res.status(403).json({ message: req.t('errors.forbidden') });
            return next();
        };
    }

    return {
        verifyToken,
        optionalAuth,
        optionalFileAuth,
        attachFileUser,
        requireRole,
        authenticate,
        setFileCookie,
        clearFileCookie
    };
}

module.exports = { createAuthMiddleware, parseCookies, fileToken, FILE_COOKIE };
