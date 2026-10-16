/**
* Project     : Bibliotech  |  Frontend - Utilidades
* authHelper: persistencia de sesion, identidad y guardas de navegacion.
*/

const authHelper = {
    storage: localStorage,

    saveSession(token, user) {
        this.storage.setItem('bt_token', token);
        this.storage.setItem('bt_user', JSON.stringify(user || {}));
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
        this.storage.removeItem('bt_token');
        this.storage.removeItem('bt_user');
        window.location.href = '/login';
    }
};
