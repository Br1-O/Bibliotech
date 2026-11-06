/**
* Project     : Bibliotech  |  Frontend
* theme.js: tema claro/oscuro persistente. Se carga en <head> para evitar
* el destello de tema incorrecto antes de pintar la pagina.
*/
import { el } from './utils/dom.js';


const Theme = (() => {
    const STORAGE_KEY = 'bt_theme';
    const listeners = [];

    function preferred() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === 'light' || stored === 'dark') return stored;
        } catch (error) { /* almacenamiento no disponible */ }
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    }

    function current() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    function apply(theme, persist = true) {
        const next = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        document.documentElement.style.colorScheme = next;
        if (persist) {
            try { localStorage.setItem(STORAGE_KEY, next); } catch (error) { /* noop */ }
        }
        listeners.forEach(fn => fn(next));
        document.dispatchEvent(new CustomEvent('bt:themechange', { detail: { theme: next } }));
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', next === 'dark' ? '#0e1122' : '#f5f2ff');
        return next;
    }

    function toggle() {
        return apply(current() === 'dark' ? 'light' : 'dark');
    }

    function onChange(fn) {
        listeners.push(fn);
    }

    function init() {
        return apply(preferred(), false);
    }

    return { init, apply, toggle, current, onChange };
})();

Theme.init();

export { Theme };
