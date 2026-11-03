/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Middleware)
* Manejo centralizado de errores: traduce las claves de negocio (i18n)
* y normaliza la forma de la respuesta de error.
*/

const ValidationError = require('../validator/ValidationError');
const { logger } = require('../utils/logger');
const metrics = require('../utils/metrics');

const MULTER_ERRORS = {
    LIMIT_FILE_SIZE: ['validation.fileSize', 413],
    LIMIT_FILE_COUNT: ['validation.fileCount', 413],
    LIMIT_PART_COUNT: ['validation.partCount', 413],
    LIMIT_FIELD_COUNT: ['validation.fieldCount', 413],
    LIMIT_UNEXPECTED_FILE: ['validation.fileType', 400],
    VALIDATION_FILE_TYPE: ['validation.fileType', 400],
    VALIDATION_COVER_TYPE: ['validation.coverType', 400]
};

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
    const t = req.t || ((key) => key);
    const requestId = req.id || null;
    const send = (status, body) => {
        if (requestId) res.setHeader('X-Request-Id', requestId);
        return res.status(status).json({ ...body, requestId });
    };

    if (err instanceof ValidationError) {
        return send(err.status || 422, {
            message: t('validation.invalidData'),
            errors: err.errors,
            fields: err.fields || {}
        });
    }

    if (err && err.messageKey) {
        if (err.status === 429 && !res.getHeader('Retry-After')) {
            const seconds = err.params?.seconds || 60;
            res.setHeader('Retry-After', String(seconds));
        }
        return send(err.status || 400, {
            message: t(err.messageKey, err.params),
            code: err.code || err.messageKey
        });
    }

    if (err && Object.prototype.hasOwnProperty.call(MULTER_ERRORS, err.code)) {
        const [key, status] = MULTER_ERRORS[err.code];
        metrics.recordUploadRejection(err.code.toLowerCase());
        return send(status, { message: t(key), code: err.code });
    }

    if (err && Object.prototype.hasOwnProperty.call(MULTER_ERRORS, err.message)) {
        const [key, status] = MULTER_ERRORS[err.message];
        metrics.recordUploadRejection(err.message.toLowerCase());
        return send(status, { message: t(key), code: err.message });
    }

    if (err && err.type === 'entity.too.large') {
        metrics.recordUploadRejection('body_too_large');
        return send(413, { message: t('validation.requestTooLarge'), code: 'REQUEST_TOO_LARGE' });
    }

    if (err && err.type === 'entity.parse.failed') {
        return send(400, { message: t('validation.invalidData'), code: 'INVALID_JSON' });
    }

    const log = req.log || logger;
    log.error('http.unhandled_error', {
        error: err,
        method: req.method,
        path: req.path,
        requestId
    });
    metrics.increment('http_server_errors_total');
    if (err && /^(ER_|PROTOCOL_|ECONN|ETIMEDOUT|ENOTFOUND)/.test(String(err.code || ''))) {
        metrics.recordDbError(String(err.code));
    }
    return send(500, { message: t('errors.serverError'), code: 'SERVER_ERROR' });
}

module.exports = errorMiddleware;
