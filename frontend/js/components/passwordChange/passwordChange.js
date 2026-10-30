/**
* Project     : Bibliotech  |  Frontend - Componente
* PasswordChange: cambio de contrasena autenticado desde el menu del perfil.
*/

const PasswordChange = (() => {
    function field(name, labelKey, autocomplete, confirmFor = null) {
        const input = el('input', {
            className: 'bt-input',
            attrs: {
                type: 'password',
                name,
                id: `btPassword-${name}`,
                autocomplete,
                required: '',
                ...(confirmFor ? { 'data-password-confirm': confirmFor } : {})
            }
        });
        return el('div', { className: 'bt-field' }, [
            el('label', { className: 'bt-label', attrs: { for: `btPassword-${name}` }, text: LanguageManager.t(labelKey) }),
            input,
            el('span', { className: 'bt-error-text', attrs: { 'data-error-for': name } })
        ]);
    }

    function open() {
        if (typeof Modal === 'undefined' || !authHelper.isAuthenticated()) return;

        const current = field('currentPassword', 'password.current', 'current-password');
        const next = field('password', 'auth.newPassword', 'new-password');
        const confirm = field('passwordConfirm', 'auth.repeatPassword', 'new-password', 'password');
        const submit = el('button', {
            className: 'bt-btn bt-btn--block',
            attrs: { type: 'submit' },
            text: LanguageManager.t('password.submit')
        });
        const form = el('form', { className: 'bt-stack', attrs: { novalidate: '' } }, [current, next, confirm, submit]);

        form.addEventListener('submit', async event => {
            event.preventDefault();
            const currentInput = form.querySelector('[name="currentPassword"]');
            const nextInput = form.querySelector('[name="password"]');
            const confirmInput = form.querySelector('[name="passwordConfirm"]');
            if (nextInput.value !== confirmInput.value) {
                Toast.error(LanguageManager.t('validation.passwordMismatch'));
                confirmInput.focus();
                return;
            }
            submit.disabled = true;
            submit.classList.add('bt-btn--loading');
            try {
                const result = await apiService.put('/auth/password', {
                    currentPassword: currentInput.value,
                    password: nextInput.value,
                    passwordConfirm: confirmInput.value
                });
                Toast.success(LanguageManager.tr(result.message));
                Modal.dismiss();
            } catch (error) {
                Toast.error(error.message);
                submit.disabled = false;
                submit.classList.remove('bt-btn--loading');
            }
        });

        Modal.info({
            title: LanguageManager.t('password.title'),
            description: LanguageManager.t('password.hint'),
            content: form
        });
        PasswordField.enhanceAll(form);
        form.querySelector('[name="currentPassword"]')?.focus();
    }

    return { open };
})();
