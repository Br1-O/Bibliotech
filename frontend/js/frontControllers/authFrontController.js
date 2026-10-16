/**
* Project     : Bibliotech  |  Frontend - Controlador
* authFrontController: login, registro y recuperacion de contrasena (RF-01).
*/

document.addEventListener('bt:ready', () => {
    bindLogin();
    bindRegister();
    bindForgot();
    bindReset();
});

function fieldValues(form) {
    return Object.fromEntries(new FormData(form).entries());
}

function setBusy(form, busy) {
    const btn = form.querySelector('bt-button');
    if (btn) btn.setLoading(busy);
    busy ? Loader.show() : Loader.hide();
}

function bindLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = fieldValues(form);
        const errors = Validator.validate([
            { name: 'email', label: LanguageManager.t('auth.email'), value: data.email, checks: [{ type: 'required' }, { type: 'email' }] },
            { name: 'password', label: LanguageManager.t('auth.password'), value: data.password, checks: [{ type: 'required' }] }
        ]);
        if (!Validator.renderErrors(form, errors)) return;

        try {
            setBusy(form, true);
            const result = await apiService.post('/auth/login', { email: data.email, password: data.password });
            authHelper.saveSession(result.token, result.user);
            Toast.success(LanguageManager.t('common.welcome'));
            window.location.href = authHelper.panelRoute();
        } catch (error) {
            Toast.error(error.message);
        } finally {
            setBusy(form, false);
        }
    });
}

function bindRegister() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = fieldValues(form);
        const errors = Validator.validate([
            { name: 'nombre', label: LanguageManager.t('auth.firstName'), value: data.nombre, checks: [{ type: 'required' }, { type: 'minLength', param: 2 }] },
            { name: 'apellido', label: LanguageManager.t('auth.lastName'), value: data.apellido, checks: [{ type: 'required' }, { type: 'minLength', param: 2 }] },
            { name: 'email', label: LanguageManager.t('auth.email'), value: data.email, checks: [{ type: 'required' }, { type: 'email' }] },
            { name: 'password', label: LanguageManager.t('auth.password'), value: data.password, checks: [{ type: 'required' }, { type: 'password' }] }
        ]);
        if (!Validator.renderErrors(form, errors)) return;

        try {
            setBusy(form, true);
            await apiService.post('/auth/register', data);
            await Modal.alert(LanguageManager.t('common.successTitle'), LanguageManager.t('messages.registerSuccess'));
            window.location.href = '/login';
        } catch (error) {
            Toast.error(error.message);
        } finally {
            setBusy(form, false);
        }
    });
}

function bindForgot() {
    const form = document.getElementById('forgotForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = fieldValues(form);
        const errors = Validator.validate([
            { name: 'email', label: LanguageManager.t('auth.email'), value: data.email, checks: [{ type: 'required' }, { type: 'email' }] }
        ]);
        if (!Validator.renderErrors(form, errors)) return;

        try {
            setBusy(form, true);
            const result = await apiService.post('/auth/forgot-password', { email: data.email });
            // En un entorno real el token viaja por correo; aqui se ofrece el enlace.
            if (result.token) {
                window.location.href = `/reset-password?token=${encodeURIComponent(result.token)}`;
            } else {
                await Modal.alert(LanguageManager.t('common.successTitle'), result.message);
            }
        } catch (error) {
            Toast.error(error.message);
        } finally {
            setBusy(form, false);
        }
    });
}

function bindReset() {
    const form = document.getElementById('resetForm');
    if (!form) return;

    const token = new URLSearchParams(window.location.search).get('token') || '';
    const tokenInput = form.querySelector('[name="token"]');
    if (tokenInput) tokenInput.value = token;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = fieldValues(form);
        const errors = Validator.validate([
            { name: 'password', label: LanguageManager.t('auth.password'), value: data.password, checks: [{ type: 'required' }, { type: 'password' }] }
        ]);
        if (!Validator.renderErrors(form, errors)) return;

        try {
            setBusy(form, true);
            await apiService.post('/auth/reset-password', { token: data.token, password: data.password });
            await Modal.alert(LanguageManager.t('common.successTitle'), LanguageManager.t('messages.passwordChanged'));
            window.location.href = '/login';
        } catch (error) {
            Toast.error(error.message);
        } finally {
            setBusy(form, false);
        }
    });
}
