/**
* Project     : Bibliotech  |  Capa: Validacion
* Error de validacion de negocio. Transporta los mensajes ya localizados.
*/

class ValidationError extends Error {
    constructor(errors = [], { code = 'VALIDATION_ERROR' } = {}) {
        const list = Array.isArray(errors) ? errors : [errors];
        super(list[0] || 'Validacion fallida');
        this.name = 'ValidationError';
        this.code = code;
        this.errors = list;
        this.status = 422;
    }
}

module.exports = ValidationError;
