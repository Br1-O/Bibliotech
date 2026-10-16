/**
* Project     : Bibliotech  |  Capa: Validacion
* Regla: valor dentro de un conjunto permitido.
*/
const Rule = require('./Rule');

class In extends Rule {
    constructor(field, allowed = []) {
        super(field, 'validation.in');
        this.allowed = allowed;
    }

    evaluate(value) {
        return this.allowed.includes(value);
    }

    params() {
        return { field: this.field, values: this.allowed.join(', ') };
    }
}

module.exports = In;
