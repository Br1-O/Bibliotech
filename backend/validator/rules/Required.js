/**
* Project     : Bibliotech  |  Capa: Validacion
* Regla: campo obligatorio.
*/
const Rule = require('./Rule');

class Required extends Rule {
    constructor(field) {
        super(field, 'validation.required');
    }

    evaluate(value) {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        return true;
    }

    params() {
        return { field: this.field };
    }
}

module.exports = Required;
