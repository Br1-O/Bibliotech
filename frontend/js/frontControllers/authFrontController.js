/**
* Project     : Bibliotech  |  Frontend - Controlador
* authFrontController: login, registro, verificacion de cuenta y recuperacion
* de contrasena (RF-01 / RD-03).
*/
import { Loader } from '../components/loader/loader.js';
import { Modal } from '../components/modal/modal.js';
import { Toast } from '../components/toast/toast.js';
import { LanguageManager } from '../i18n/LanguageManager.js';
import { apiService } from '../services/apiService.js';
import { authHelper } from '../utils/authHelper.js';
import { Validator } from '../utils/validator.js';


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

function showAlert(id, message, type = 'error') {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = message || '';
    node.style.color = type === 'success' ? 'var(--color-success)' : 'var(--color-danger)';
    node.style.background = type === 'success' ? 'var(--color-success-soft)' : 'var(--color-danger-soft)';
}

function translate(message) {
    return LanguageManager.tr(message);
}

function currentResetToken() {
    const match = window.location.pathname.match(/\/restablecer-password\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

function showActivationNotice() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('activacion');
    if (!status) return;

    if (status === 'exitosa') Toast.success(translate('messages.accountVerified'));
    else Toast.error(translate('errors.invalidToken'));

    params.delete('activacion');
    const query = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
}

function bindLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    showActivationNotice();

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        Validator.clear(form);
        showAlert('loginAlert', '');

        const data = fieldValues(form);
        const valid = Validator.on(form)
            .required('email', LanguageManager.t('auth.email'))
            .email('email', LanguageManager.t('auth.email'))
            .required('password', LanguageManager.t('auth.password'))
            .validateThis()
            .show();
        if (!valid) return;

        try {
            setBusy(form, true);
            const result = await apiService.post('/auth/login', { email: data.email, password: data.password });
            authHelper.saveSession(result.token, result.user);
            Toast.success(translate(result.message || 'common.welcome'));
            window.location.href = authHelper.panelRoute();
        } catch (error) {
            if (error.code === 'errors.accountNotVerified') {
                showAlert('loginAlert', error.message);
            } else {
                Toast.error(error.message);
            }
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
        Validator.clear(form);
        showAlert('registerAlert', '');

        const data = fieldValues(form);
        const valid = Validator.on(form)
            .required('nombre', LanguageManager.t('auth.firstName'))
            .minLength('nombre', 2, LanguageManager.t('auth.firstName'))
            .required('apellido', LanguageManager.t('auth.lastName'))
            .minLength('apellido', 2, LanguageManager.t('auth.lastName'))
            .required('email', LanguageManager.t('auth.email'))
            .email('email', LanguageManager.t('auth.email'))
            .required('password', LanguageManager.t('auth.password'))
            .password('password', LanguageManager.t('auth.password'))
            .required('passwordConfirm', LanguageManager.t('auth.repeatPassword'))
            .match('passwordConfirm', 'password', LanguageManager.t('auth.repeatPassword'))
            .validateThis()
            .show();
        if (!valid) return;

        try {
            setBusy(form, true);
            const result = await apiService.post('/auth/register', {
                nombre: data.nombre,
                apellido: data.apellido,
                email: data.email,
                password: data.password,
                passwordConfirm: data.passwordConfirm
            });

            await Modal.alert(
                LanguageManager.t('common.successTitle'),
                translate(result.message || 'messages.registerSuccess')
            );
            window.location.href = '/login';
        } catch (error) {
            if (!Validator.applyServerErrors(form, error)) {
                showAlert('registerAlert', error.message);
            }
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
        Validator.clear(form);

        const data = fieldValues(form);
        const valid = Validator.on(form)
            .required('email', LanguageManager.t('auth.email'))
            .email('email', LanguageManager.t('auth.email'))
            .validateThis()
            .show();
        if (!valid) return;

        try {
            setBusy(form, true);
            const result = await apiService.post('/auth/forgot-password', { email: data.email });
            await Modal.alert(LanguageManager.t('common.successTitle'), translate(result.message || 'messages.resetRequested'));
            form.reset();
        } catch (error) {
            if (!Validator.applyServerErrors(form, error)) Toast.error(error.message);
        } finally {
            setBusy(form, false);
        }
    });
}

function markResetInvalid() {
    const form = document.getElementById('resetForm');
    if (form) form.hidden = true;
    showAlert('resetAlert', translate('errors.invalidToken'));
}

function bindReset() {
    const form = document.getElementById('resetForm');
    if (!form) return;

    const token = currentResetToken();
    const tokenInput = form.querySelector('[name="token"]');
    if (tokenInput) tokenInput.value = token;
    if (!token) {
        markResetInvalid();
        return;
    }

    apiService.get(`/auth/reset-password/${encodeURIComponent(token)}/validate`)
        .then(result => { if (!result.valid) markResetInvalid(); })
        .catch(markResetInvalid);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        Validator.clear(form);
        showAlert('resetAlert', '');

        const data = fieldValues(form);
        const valid = Validator.on(form)
            .required('password', LanguageManager.t('auth.newPassword'))
            .password('password', LanguageManager.t('auth.newPassword'))
            .required('passwordConfirm', LanguageManager.t('auth.repeatPassword'))
            .match('passwordConfirm', 'password', LanguageManager.t('auth.repeatPassword'))
            .validateThis()
            .show();
        if (!valid) return;
        if (!data.token) {
            markResetInvalid();
            return;
        }

        try {
            setBusy(form, true);
            const result = await apiService.post('/auth/reset-password', {
                token: data.token,
                password: data.password,
                passwordConfirm: data.passwordConfirm
            });
            await Modal.alert(LanguageManager.t('common.successTitle'), translate(result.message || 'messages.passwordChanged'));
            window.location.href = '/login';
        } catch (error) {
            if (!Validator.applyServerErrors(form, error)) showAlert('resetAlert', error.message);
        } finally {
            setBusy(form, false);
        }
    });
}
