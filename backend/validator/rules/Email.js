/**
* Project     : Bibliotech  |  Capa: Validacion
* Regla: formato de correo electronico (RD-01).
*/
const Rule = require('./Rule');

// Regex de validacion de email orientada al modelo de negocio.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

class Email extends Rule {
    constructor(field = 'email') {
        super(field, 'validation.email');
    }

    evaluate(value) {
        return EMAIL_REGEX.test(String(value).trim());
    }

    params() {
        return { field: this.field };
    }
}

Email.REGEX = EMAIL_REGEX;
module.exports = Email;
