/**
* Project     : Bibliotech  |  Frontend - Utilidades
* authHelper: persistencia de sesion, identidad y guardas de navegacion.
*/

const authHelper = {
    storage: localStorage,

    saveSession(token, user) {
        this.storage.setItem('bt_token', token);
        this.storage.setItem('bt_user', JSON.stringify(user || {}));
        this.clearLegacyFileCookie();
    },

    clearLegacyFileCookie() {
        if (typeof document === 'undefined') return;
        document.cookie = 'bt_file_token=; Max-Age=0; Path=/; SameSite=Lax';
    },

    getToken() { return this.storage.getItem('bt_token'); },

    getUser() {
        try { return JSON.parse(this.storage.getItem('bt_user') || 'null'); }
        catch (error) { return null; }
    },

    getRole() { return this.getUser()?.roleNombre || 'Visitante'; },

    isAuthenticated() { return Boolean(this.getToken()); },

    isRole(...roles) { return roles.includes(this.getRole()); },

    /** Ruta del panel correspondiente al rol autenticado. */
    panelRoute() {
        switch (this.getRole()) {
            case 'Superadmin': return '/admin';
            case 'Profesor': return '/profesor';
            case 'Alumno': return '/alumno';
            default: return '/catalogo';
        }
    },

    /** Redirige al login si no hay sesion valida. */
    requireAuth(redirect = '/login') {
        if (!this.isAuthenticated()) window.location.href = redirect;
        return this.isAuthenticated();
    },

    logout() {
        const finish = () => {
            this.storage.removeItem('bt_token');
            this.storage.removeItem('bt_user');
            window.location.href = '/login';
        };
        try {
            fetch('/api/auth/logout', { method: 'POST', keepalive: true, credentials: 'same-origin' })
                .catch(() => {}).finally(finish);
        } catch (error) {
            finish();
        }
    }
};

export { authHelper };
