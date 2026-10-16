/**
* Project     : Bibliotech  |  Capa: Validacion (Filter/Validator)
* Regla de validacion base. Cada regla concreta implementa evaluate().
* Patron de diseno estructural (SRS 6.2).
*/

class Rule {
    constructor(field, messageKey) {
        this.field = field;
        this.messageKey = messageKey;
    }

    /** Devuelve los parametros de interpolacion del mensaje. */
    messageParams() {
        return { field: `fields.${this.field}` };
    }

    /** Logica de validacion concreta. Debe devolver boolean. */
    // eslint-disable-next-line no-unused-vars
    evaluate(value) {
        return true;
    }

    /** Evalua la regla contra el objeto objetivo. */
    validate(target) {
        return this.evaluate(target[this.field]);
    }
}

module.exports = Rule;
