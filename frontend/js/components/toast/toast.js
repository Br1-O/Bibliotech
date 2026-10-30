/**
* Project     : Bibliotech  |  Frontend - Componente
* Notificaciones flotantes (toasts).
* Uso: Toast.success('Guardado'), Toast.error('Fallo'), Toast.info('...').
*/

const Toast = (() => {
    let host = null;
    const ICONS = { success: 'OK', error: '!', info: 'i', warning: '!' };

    function ensure() {
        if (!host) {
            host = el('div', { className: 'bt-toasts', attrs: { 'aria-live': 'polite' } });
            document.body.appendChild(host);
        }
        return host;
    }

    function push(message, type = 'info', timeout = 4000) {
        const text = typeof LanguageManager !== 'undefined' ? LanguageManager.tr(String(message ?? '')) : String(message ?? '');
        const node = el('div', { className: `bt-toast bt-toast--${type}`, attrs: { role: 'status' } }, [
            el('strong', { text: (ICONS[type] || '') + ' ' }),
            el('span', { text })
        ]);
        ensure().appendChild(node);
        setTimeout(() => { node.style.opacity = '0'; setTimeout(() => node.remove(), 300); }, timeout);
    }

    return {
        push,
        success: (m) => push(m, 'success'),
        error: (m) => push(m, 'error', 6000),
        info: (m) => push(m, 'info'),
        warning: (m) => push(m, 'warning')
    };
})();
