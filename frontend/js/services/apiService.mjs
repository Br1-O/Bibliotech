/**
* Project     : Bibliotech  |  Frontend - Servicio
* apiService: cliente HTTP centralizado. Adjunta el token JWT, propaga el
* idioma activo (lang) y normaliza el manejo de errores.
*/
import { LanguageManager } from '../i18n/LanguageManager.mjs';
import { authHelper } from '../utils/authHelper.mjs';
import { el } from '../utils/dom.mjs';


const apiService = {
    baseUrl: '/api',

    async request(endpoint, method = 'GET', data = null, isFormData = false) {
        const token = authHelper.getToken();
        const lang = LanguageManager.language;

        const url = `/api${endpoint}${endpoint.includes('?') ? '&' : '?'}lang=${lang}`;

        const headers = {};
        if (!isFormData) headers['Content-Type'] = 'application/json';
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const config = { method, headers };
        if (data !== null && data !== undefined) {
            config.body = (data instanceof FormData) ? data : JSON.stringify(data);
        }

        const requestEvent = new CustomEvent('bt:api-start', { detail: { method, endpoint } });
        document.dispatchEvent(requestEvent);

        let response;
        try {
            response = await fetch(url, config);
        } catch (error) {
            throw new Error(LanguageManager.t('errors.network'));
        } finally {
            document.dispatchEvent(new CustomEvent('bt:api-end', { detail: { method, endpoint } }));
        }

        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
            const err = new Error(body.message || LanguageManager.t('errors.serverError'));
            err.status = response.status;
            err.code = body.code || null;
            err.errors = body.errors || [];
            err.fields = body.fields || {};

            const publicAuth = /^\/auth\/(login|register|forgot-password|reset-password|verify-account|activate|resend-verification)/.test(endpoint);
            if (response.status === 401 && token && !publicAuth) authHelper.logout();
            throw err;
        }
        return body;
    },

    get(endpoint, params = {}) {
        const query = new URLSearchParams(
            Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)
        ).toString();
        return this.request(query ? `${endpoint}?${query}` : endpoint, 'GET');
    },

    post(endpoint, data) { return this.request(endpoint, 'POST', data); },
    put(endpoint, data) { return this.request(endpoint, 'PUT', data); },
    putForm(endpoint, formData) { return this.request(endpoint, 'PUT', formData, true); },
    del(endpoint) { return this.request(endpoint, 'DELETE'); },

    upload(endpoint, formData) { return this.request(endpoint, 'POST', formData, true); }
};

export { apiService };
