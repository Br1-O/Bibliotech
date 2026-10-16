/**
* Project     : Bibliotech  |  Capa: Validacion
* Regla: longitud minima y maxima de un campo.
*/
const Rule = require('./Rule');

class Length extends Rule {
    constructor(field, { min = 0, max = Infinity } = {}) {
        const key = max === Infinity ? 'validation.minLength' : 'validation.maxLength';
        super(field, key);
        this.min = min;
        this.max = max;
    }

    evaluate(value) {
        const len = String(value ?? '').trim().length;
        return len >= this.min && len <= this.max;
    }

    params() {
        return { field: this.field, length: this.max === Infinity ? this.min : this.max };
    }
}

module.exports = Length;
