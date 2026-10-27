/**
* Project     : Bibliotech  |  Capa: Validacion
* Regla: confirmacion opcional de un campo (por ejemplo, contrasena).
* Si el campo de confirmacion no se envia, la regla no interviene.
*/

const Rule = require('./Rule');

class SameAs extends Rule {
    constructor(field = 'passwordConfirm', otherField = 'password') {
        super(field, 'validation.match');
        this.otherField = otherField;
    }

    evaluate(value, target = {}) {
        if (value === undefined || value === null || String(value) === '') return true;
        return String(value) === String(target[this.otherField] ?? '');
    }

    params() {
        return { field: this.field };
    }
}

module.exports = SameAs;
