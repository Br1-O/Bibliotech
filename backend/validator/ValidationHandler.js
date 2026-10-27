/**
* Project     : Bibliotech  |  Capa: Validacion (Filter/Validator)
* ValidationHandler: orquestador de reglas de validacion multilenguaje.
*
* API (SRS 6.2):
*   - with(rule)                        -> encadena reglas
*   - validationObject(target, rule)    -> valida un objetivo contra una regla
*   - validateThis(target)              -> valida todas las reglas registradas
*   - getErrors() / getFirstError() / throwIfInvalid()
*/

const ValidationError = require('./ValidationError');

class ValidationHandler {
    constructor(languageManager) {
        this.languageManager = languageManager;
        this.rules = [];
        this.errors = [];
        this.fieldErrors = {};
    }

    /** Agrega una regla al manejador (patron fluent). */
    with(rule) {
        this.rules.push(rule);
        return this;
    }

    /** Registra y evalua una regla de forma directa. */
    validationObject(target, rule) {
        this.with(rule);
        return this.validateThis(target);
    }

    /**
     * Evalua todas las reglas contra el objetivo.
     * @returns {boolean} true si no hubo errores
     */
    validateThis(target, { language } = {}) {
        const lang = language || this.languageManager.getLanguage();
        this.errors = [];
        this.fieldErrors = {};

        for (const rule of this.rules) {
            let valid = true;
            try {
                valid = rule.evaluate(target[rule.field], target);
            } catch (err) {
                valid = false;
            }
            if (!valid) {
                const params = rule.params ? rule.params() : {};
                if (params.field) params.field = this.fieldLabel(params.field, lang);
                const message = this.languageManager.getThisMessage(rule.messageKey, params, lang);
                this.errors.push(message);
                if (!this.fieldErrors[rule.field]) this.fieldErrors[rule.field] = message;
            }
        }
        return this.errors.length === 0;
    }

    getErrors() {
        return this.errors;
    }

    getFieldErrors() {
        return this.fieldErrors;
    }

    /** Construye el error de validacion conservando campo -> mensaje. */
    toError() {
        return new ValidationError(this.errors, { fields: this.fieldErrors });
    }

    /** Etiqueta localizada de un campo (ej: "email" -> "Correo electronico"). */
    fieldLabel(field, lang) {
        const label = this.languageManager.getThisMessage(`fields.${field}`, {}, lang);
        return label === `fields.${field}` ? field : label;
    }

    getFirstError() {
        return this.errors[0] || null;
    }

    throwIfInvalid() {
        if (this.errors.length) throw this.toError();
        return true;
    }

    /** Mensaje localizado directo (atajo). */
    message(key, params) {
        return this.languageManager.getThisMessage(key, params);
    }
}

module.exports = ValidationHandler;
