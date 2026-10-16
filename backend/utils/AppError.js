/**
* Project     : Bibliotech  |  Capa: Aplicacion
* Error de negocio transportable. El middleware de errores lo localiza
* usando el LanguageManager (messageKey -> mensaje en el idioma activo).
*/

class AppError extends Error {
    constructor(messageKey, { status = 400, params = {}, code = null } = {}) {
        super(messageKey);
        this.name = 'AppError';
        this.messageKey = messageKey;
        this.status = status;
        this.params = params;
        this.code = code || messageKey;
    }
}

module.exports = AppError;
