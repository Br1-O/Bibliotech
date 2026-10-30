/**
* Project     : Bibliotech  |  Frontend - Componente
* Loader global con marca animada + helpers de esqueletos de carga.
*/

const Loader = (() => {
    const startedAt = performance.now();
    const MIN_VISIBLE_MS = 320;
    const API_IDLE_MS = 180;

    let node = null;
    let hideTimer = null;
    let removeTimer = null;
    let pageReady = false;
    let manual = false;
    let inFlight = 0;
    let lastApiAt = startedAt;
    let visible = true;

    function ensure() {
        if (node) return node;
        node = document.getElementById('btPageLoader');
        if (!node) {
            node = el('div', {
                className: 'bt-page-loader',
                attrs: {
                    id: 'btPageLoader',
                    role: 'status',
                    'aria-live': 'polite',
                    'aria-label': 'Cargando...'
                }
            }, [
                el('span', { className: 'bt-page-loader__mark', text: 'B', attrs: { 'aria-hidden': 'true' } }),
                el('span', { className: 'bt-page-loader__label', text: 'Bibliotech' })
            ]);
            document.body.appendChild(node);
        }
        if (typeof LanguageManager !== 'undefined') {
            node.setAttribute('aria-label', LanguageManager.t('common.loading'));
        }
        return node;
    }

    function showOverlay() {
        ensure();
        clearTimeout(removeTimer);
        if (node) {
            node.hidden = false;
            node.classList.remove('is-leaving');
        }
        visible = true;
    }

    function hideOverlay() {
        ensure();
        if (!node || !visible) return;
        visible = false;
        node.classList.add('is-leaving');
        clearTimeout(removeTimer);
        removeTimer = setTimeout(() => {
            if (!visible && node) node.hidden = true;
        }, 260);
    }

    function scheduleHide() {
        if (!pageReady || manual || inFlight > 0 || !visible) return;
        clearTimeout(hideTimer);
        const now = performance.now();
        const idleWait = API_IDLE_MS - (now - lastApiAt);
        const minVisibleWait = MIN_VISIBLE_MS - (now - startedAt);
        const wait = Math.max(idleWait, minVisibleWait, 0);
        hideTimer = setTimeout(() => {
            if (!pageReady || manual || inFlight > 0) return;
            hideOverlay();
        }, wait);
    }

    document.addEventListener('bt:api-start', () => {
        inFlight += 1;
        clearTimeout(hideTimer);
    });

    document.addEventListener('bt:api-end', () => {
        inFlight = Math.max(0, inFlight - 1);
        lastApiAt = performance.now();
        scheduleHide();
    });

    return {
        show() {
            manual = true;
            clearTimeout(hideTimer);
            showOverlay();
        },

        hide() {
            manual = false;
            scheduleHide();
        },

        pageReady() {
            pageReady = true;
            lastApiAt = performance.now();
            ensure();
            scheduleHide();
        },

        /** Esqueletos de tarjetas mientras carga una grilla. */
        skeletons(container, count = 6) {
            render(container, Array.from({ length: count }, () =>
                el('div', { className: 'bt-skeleton-card' })));
        }
    };
})();
