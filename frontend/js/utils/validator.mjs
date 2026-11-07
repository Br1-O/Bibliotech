/**
* Project     : Bibliotech  |  Frontend - Utilidades
* Validator: validacion encadenada de formularios, espejo del
* ValidationHandler del backend (patron fluent, RNF-06).
*
* Uso:
*   const ok = Validator.on(form)
*       .required('email', label)
*       .email('email', label)
*       .required('password', label)
*       .password('password', label)
*       .validateThis()
*       .render();
*/
import { LanguageManager } from '../i18n/LanguageManager.mjs';
import { el, render } from './dom.mjs';


class FormValidator {
    constructor(form) {
        this.form = form;
        this.rules = [];
        this.errors = {};
    }

    with(rule) {
        this.rules.push(rule);
        return this;
    }

    _add(field, label, type, param = null, extra = {}) {
        return this.with({ field, label, type, param, ...extra });
    }

    required(field, label) { return this._add(field, label, 'required'); }
    email(field, label) { return this._add(field, label, 'email'); }
    password(field, label) { return this._add(field, label, 'password'); }
    minLength(field, length, label) { return this._add(field, label, 'minLength', length); }
    maxLength(field, length, label) { return this._add(field, label, 'maxLength', length); }
    match(field, otherField, label) { return this._add(field, label, 'match', otherField); }

    value(field) {
        if (this.form) {
            const input = this.form.querySelector(`[name="${field}"]`);
            if (input) return input.value;
            return new FormData(this.form).get(field);
        }
        return '';
    }

    _message(rule, text) {
        const params = { field: rule.label };
        switch (rule.type) {
            case 'required': return LanguageManager.t('validation.required', params);
            case 'email': return LanguageManager.t('validation.email', params);
            case 'password': return LanguageManager.t('validation.password', params);
            case 'minLength': return LanguageManager.t('validation.minLength', { ...params, length: rule.param });
            case 'maxLength': return LanguageManager.t('validation.maxLength', { ...params, length: rule.param });
            case 'match': return LanguageManager.t('validation.passwordMismatch');
            default: return LanguageManager.t('validation.invalidData');
        }
    }

    _valid(rule, text) {
        switch (rule.type) {
            case 'required': return text.trim().length > 0;
            case 'email': return Validator.EMAIL_REGEX.test(text);
            case 'password': return text.length >= 8 && /[A-Za-z]/.test(text) && /\d/.test(text);
            case 'minLength': return text.length >= Number(rule.param);
            case 'maxLength': return text.length <= Number(rule.param);
            case 'match': {
                const other = this.value(rule.param) || '';
                return text === '' || text === other;
            }
            default: return true;
        }
    }

    validateThis() {
        this.errors = {};
        for (const rule of this.rules) {
            const text = String(this.value(rule.field) ?? '');
            if (!this._valid(rule, text)) {
                if (!this.errors[rule.field]) this.errors[rule.field] = this._message(rule, text);
            }
        }
        return this;
    }

    getErrors() {
        return this.errors;
    }

    render() {
        if (!this.form) return Object.keys(this.errors).length === 0;
        this.form.querySelectorAll('[data-error-for]').forEach(node => { node.textContent = ''; });
        this.form.querySelectorAll('[aria-invalid]').forEach(node => node.removeAttribute('aria-invalid'));

        Object.entries(this.errors).forEach(([field, message]) => {
            const slot = this.form.querySelector(`[data-error-for="${field}"]`);
            if (slot) slot.textContent = message;
            const input = this.form.querySelector(`[name="${field}"]`);
            if (input) input.setAttribute('aria-invalid', 'true');
        });
        return Object.keys(this.errors).length === 0;
    }

    show() {
        this.render();
        const first = this.form?.querySelector('[aria-invalid="true"]');
        if (first) first.focus();
        return Object.keys(this.errors).length === 0;
    }
}

const Validator = {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,

    on(form) {
        return new FormValidator(form);
    },

    /** Vuelca errores de campo devueltos por el backend. */
    applyServerErrors(form, error) {
        if (!form || !error) return false;
        const fields = error.fields && typeof error.fields === 'object' ? error.fields : {};
        const entries = Object.entries(fields);
        if (!entries.length) return false;

        form.querySelectorAll('[data-error-for]').forEach(node => { node.textContent = ''; });
        entries.forEach(([field, message]) => {
            const slot = form.querySelector(`[data-error-for="${field}"]`);
            if (slot) slot.textContent = message;
            const input = form.querySelector(`[name="${field}"]`);
            if (input) input.setAttribute('aria-invalid', 'true');
        });
        return true;
    },

    clear(form) {
        if (!form) return;
        form.querySelectorAll('[data-error-for]').forEach(node => { node.textContent = ''; });
        form.querySelectorAll('[aria-invalid]').forEach(node => node.removeAttribute('aria-invalid'));
    }
};

export { FormValidator, Validator };
