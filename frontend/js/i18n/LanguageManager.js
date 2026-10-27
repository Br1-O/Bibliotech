/**
* Project     : Bibliotech  |  Frontend
* LanguageManager: internacionalizacion del contenido de la plataforma.
* Carga locales JSON, resuelve mensajes y aplica traducciones al DOM mediante
* atributos data-i18n. Notifica cambios de idioma a los suscriptores (Observer).
*/

const LanguageManager = (() => {
    const DEFAULT_LANG = localStorage.getItem('bt_lang') || 'es';
    const LOCALES_PATH = '/js/i18n/locales';
    const SUPPORTED = ['es', 'en'];

    let language = SUPPORTED.includes(DEFAULT_LANG) ? DEFAULT_LANG : 'es';
    let dictionary = {};
    const listeners = [];

    async function load(lang) {
        try {
            const res = await fetch(`${LOCALES_PATH}/${lang}.json`);
            if (!res.ok) throw new Error(`No se pudo cargar el locale ${lang}`);
            dictionary = await res.json();
            language = lang;
            localStorage.setItem('bt_lang', lang);
            document.documentElement.setAttribute('lang', lang);
            apply();
            listeners.forEach(fn => fn(lang));
            return lang;
        } catch (error) {
            console.error(error);
            return language;
        }
    }

    /** Traduce una clave con notacion de punto e interpola {parametros}. */
    function t(key, params = {}) {
        const raw = key.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), dictionary);
        const template = raw !== undefined ? raw : key;
        return String(template).replace(/\{(\w+)\}/g, (_, token) =>
            params[token] !== undefined ? params[token] : `{${token}}`);
    }

    /** Traduce solo si la clave existe; si no, devuelve el texto original. */
    function tr(key, params = {}) {
        if (typeof key !== 'string') return key;
        const raw = key.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), dictionary);
        return raw === undefined ? key : t(key, params);
    }

    /** Aplica las traducciones a todos los nodos con data-i18n. */
    function apply(root = document) {
        root.querySelectorAll('[data-i18n]').forEach(node => {
            node.textContent = t(node.getAttribute('data-i18n'));
        });
        root.querySelectorAll('[data-i18n-placeholder]').forEach(node => {
            node.setAttribute('placeholder', t(node.getAttribute('data-i18n-placeholder')));
        });
        root.querySelectorAll('[data-i18n-title]').forEach(node => {
            node.setAttribute('title', t(node.getAttribute('data-i18n-title')));
        });
    }

    function onChange(fn) { listeners.push(fn); }

    async function init() { return load(language); }

    return { init, load, t, tr, apply, onChange, get language() { return language; }, SUPPORTED };
})();
