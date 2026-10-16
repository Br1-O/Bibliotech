/**
* Project     : Bibliotech  |  Capa: Validacion
* Regla: politica de contrasena (minimo 8, una letra y un numero).
*/
const Rule = require('./Rule');

class Password extends Rule {
    constructor(field = 'password') {
        super(field, 'validation.password');
    }

    evaluate(value) {
        const pass = String(value ?? '');
        return pass.length >= 8 && /[A-Za-z]/.test(pass) && /\d/.test(pass);
    }

    params() {
        return { field: this.field };
    }
}

module.exports = Password;
