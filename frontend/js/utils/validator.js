/**
* Project     : Bibliotech  |  Frontend - Utilidades
* Validator: validacion de formularios con mensajes localizados.
* Espeja las reglas del modulo Filter/Validator del backend (RNF-06).
*/

const Validator = {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,

    /** Evalua una regla sobre un valor. Devuelve un mensaje localizado o null. */
    evaluate(rule, value, label) {
        const text = value === undefined || value === null ? '' : String(value).trim();
        const params = { field: label };

        switch (rule.type) {
            case 'required':
                return text === '' ? LanguageManager.t('validation.required', params) : null;
            case 'email':
                return this.EMAIL_REGEX.test(text) ? null : LanguageManager.t('validation.email', params);
            case 'password':
                return (text.length >= 8 && /[A-Za-z]/.test(text) && /\d/.test(text))
                    ? null : LanguageManager.t('validation.password', params);
            case 'minLength':
                return text.length >= (rule.param || 0) ? null : LanguageManager.t('validation.minLength', params);
            case 'maxLength':
                return text.length <= (rule.param || Infinity) ? null : LanguageManager.t('validation.maxLength', params);
            default:
                return null;
        }
    },

    /**
     * @param {Array} fields [{ name, label, value, checks:[{type, param}] }]
     * @returns {Object} mapa nombre -> mensaje de error
     */
    validate(fields) {
        const errors = {};
        for (const field of fields) {
            for (const rule of field.checks) {
                const message = this.evaluate(rule, field.value, field.label);
                if (message) { errors[field.name] = message; break; }
            }
        }
        return errors;
    },

    /** Pinta los errores en los contenedores [data-error-for] y quita aria-invalid. */
    renderErrors(form, errors) {
        form.querySelectorAll('[data-error-for]').forEach(node => { node.textContent = ''; });
        form.querySelectorAll('[aria-invalid]').forEach(node => node.removeAttribute('aria-invalid'));

        Object.entries(errors).forEach(([name, message]) => {
            const slot = form.querySelector(`[data-error-for="${name}"]`);
            if (slot) slot.textContent = message;
            const input = form.querySelector(`[name="${name}"]`);
            if (input) input.setAttribute('aria-invalid', 'true');
        });

        return Object.keys(errors).length === 0;
    }
};
