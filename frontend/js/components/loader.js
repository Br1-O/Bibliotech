/**
* Project     : Bibliotech  |  Frontend - Componente
* Loader global + helpers de esqueletos de carga.
*/

const Loader = (() => {
    let overlay = null;

    function ensure() {
        if (overlay) return overlay;
        overlay = el('div', { className: 'bt-loader-overlay', attrs: { role: 'status', 'aria-live': 'polite' } }, [
            el('div', { className: 'bt-spinner', attrs: { 'aria-hidden': 'true' } }),
            el('span', { className: 'bt-sr-only', text: 'Cargando...' })
        ]);
        document.body.appendChild(overlay);
        return overlay;
    }

    return {
        show() { ensure().setAttribute('open', ''); },
        hide() { if (overlay) overlay.removeAttribute('open'); },
        /** Esqueletos de tarjetas mientras carga una grilla. */
        skeletons(container, count = 6) {
            render(container, Array.from({ length: count }, () =>
                el('div', { className: 'bt-skeleton-card' })));
        }
    };
})();
