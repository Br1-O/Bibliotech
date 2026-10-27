/**
* Project     : Bibliotech  |  Capa: Adaptador de Entrada (Middleware)
* Manejo centralizado de errores: traduce las claves de negocio (i18n)
* y normaliza la forma de la respuesta de error.
*/

const ValidationError = require('../validator/ValidationError');

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
    const t = req.t || ((key) => key);

    if (err instanceof ValidationError) {
        return res.status(err.status || 422).json({
            message: t('validation.invalidData'),
            errors: err.errors,
            fields: err.fields || {}
        });
    }

    // Error de negocio (AppError) con messageKey traducible.
    if (err && err.messageKey) {
        return res.status(err.status || 400).json({
            message: t(err.messageKey, err.params),
            code: err.code || err.messageKey
        });
    }

    // Errores de Multer.
    if (err && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: t('validation.fileSize') });
    }
    if (err && err.message === 'VALIDATION_FILE_TYPE') {
        return res.status(400).json({ message: t('validation.fileType') });
    }

    console.error(err);
    return res.status(500).json({ message: t('errors.serverError') });
}

module.exports = errorMiddleware;
