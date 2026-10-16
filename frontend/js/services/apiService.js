/**
* Project     : Bibliotech  |  Frontend - Servicio
* apiService: cliente HTTP centralizado. Adjunta el token JWT, propaga el
* idioma activo (lang) y normaliza el manejo de errores.
*/

const apiService = {
    baseUrl: '/api',

    async request(endpoint, method = 'GET', data = null, isFormData = false) {
        const token = authHelper.getToken();
        const lang = LanguageManager.language;

        const separator = endpoint.includes('?') ? '&' : '?';
        const url = `/api${endpoint}${endpoint.includes('?') ? '&' : '?'}lang=${lang}`;

        const headers = {};
        if (!isFormData) headers['Content-Type'] = 'application/json';
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const config = { method, headers };
        if (data !== null && data !== undefined) {
            config.body = (data instanceof FormData) ? data : JSON.stringify(data);
        }

        let response;
        try {
            response = await fetch(url, config);
        } catch (error) {
            throw new Error(LanguageManager.t('errors.network'));
        }

        if (response.status === 401) {
            authHelper.logout();
            throw new Error(LanguageManager.t('errors.unauthorized'));
        }

        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
            const err = new Error(body.message || LanguageManager.t('errors.serverError'));
            error.errors = body.errors || [];
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
    del(endpoint) { return this.request(endpoint, 'DELETE'); },

    upload(endpoint, formData) { return this.request(endpoint, 'POST', formData, true); }
};
