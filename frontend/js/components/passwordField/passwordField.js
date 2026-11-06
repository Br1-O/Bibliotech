/**
* Project     : Bibliotech  |  Frontend - Componente
* passwordField.js: boton de visibilidad y validacion temprana de confirmacion.
*/
import { LanguageManager } from '../../i18n/LanguageManager.js';
import { Icons } from '../icons/icons.js';


const PasswordField = (() => {
    function iconNode(name) {
        return typeof Icons !== 'undefined' && Icons[name] ? Icons[name]() : document.createTextNode(name === 'eye' ? 'Ver' : 'Ocultar');
    }

    function enhance(input) {
        if (!input || input.dataset.passwordEnhanced === 'true') return;
        if (!input.parentNode) return;

        input.dataset.passwordEnhanced = 'true';
        const wrapper = document.createElement('div');
        wrapper.className = 'bt-input-group';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bt-input-group__action';
        button.setAttribute('aria-label', LanguageManager.t('auth.showPassword'));
        button.setAttribute('title', LanguageManager.t('auth.showPassword'));
        button.appendChild(iconNode('eye'));
        wrapper.appendChild(button);

        button.addEventListener('click', () => {
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            const label = LanguageManager.t(show ? 'auth.hidePassword' : 'auth.showPassword');
            button.setAttribute('aria-label', label);
            button.setAttribute('title', label);
            button.replaceChildren(iconNode(show ? 'eyeOff' : 'eye'));
        });
    }

    function slotFor(input) {
        const field = input.closest('.bt-field');
        return field ? field.querySelector(`[data-error-for="${input.name}"]`) : null;
    }

    function setMismatch(input, mismatch) {
        const slot = slotFor(input);
        if (mismatch) {
            const message = LanguageManager.t('validation.passwordMismatch');
            if (slot) slot.textContent = message;
            input.setAttribute('aria-invalid', 'true');
        } else {
            if (slot && slot.textContent === LanguageManager.t('validation.passwordMismatch')) slot.textContent = '';
            if (slot && !slot.textContent) input.removeAttribute('aria-invalid');
        }
    }

    function bindConfirmation(confirmInput) {
        const originalName = confirmInput.dataset.passwordConfirm;
        if (!originalName || confirmInput.dataset.passwordMatchBound === 'true') return;
        const form = confirmInput.form;
        const original = form ? form.querySelector(`[name="${originalName}"]`) : null;
        if (!original) return;

        confirmInput.dataset.passwordMatchBound = 'true';
        const sync = () => {
            const hasValue = confirmInput.value.length > 0;
            setMismatch(confirmInput, hasValue && confirmInput.value !== original.value);
        };
        confirmInput.addEventListener('input', sync);
        original.addEventListener('input', sync);
    }

    function enhanceAll(root = document) {
        root.querySelectorAll('input[type="password"]').forEach(enhance);
        root.querySelectorAll('[data-password-confirm]').forEach(bindConfirmation);
    }

    return { enhance, enhanceAll, bindConfirmation };
})();

export { PasswordField };
