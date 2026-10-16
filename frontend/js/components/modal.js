/**
* Project     : Bibliotech  |  Frontend - Componente
* Modal de confirmacion / aviso con soporte multilenguaje.
* Uso: const ok = await Modal.confirm({ title, message });
*/

const Modal = (() => {
    let root = null;
    let resolveFn = null;

    function ensure() {
        if (root) return root;
        const title = el('h3', { className: 'bt-card__title' });
        const body = el('div', { className: 'bt-card__meta', style: { color: 'var(--text-secondary)' } });
        const cancelBtn = el('bt-button', { variant: 'ghost' });
        const confirmBtn = el('bt-button', { variant: 'primary' });

        cancelBtn.addEventListener('click', () => close(false));
        confirmBtn.addEventListener('click', () => close(true));

        const content = el('div', { className: 'bt-auth__card' }, [
            el('div', { style: { marginBottom: 'var(--space-3)' } }, [title]),
            body,
            el('div', { className: 'bt-row bt-between', style: { marginTop: 'var(--space-5)' } }, [cancelBtn, confirmBtn])
        ]);

        root = el('div', {
            className: 'bt-loader-overlay',
            attrs: { role: 'dialog', 'aria-modal': 'true' },
            on: { click: (e) => { if (e.target === root) close(false); } }
        }, [content]);
        document.body.appendChild(root);
        return root;
    }

    function close(result) {
        if (root) root.removeAttribute('open');
        if (resolveFn) { resolveFn(result); resolveFn = null; }
    }

    function open({ title, message, confirmText, cancelText, hideCancel = false, variant = 'primary' }) {
        const node = ensure();
        node.querySelector('.bt-card__title').textContent = title || '';
        node.querySelector('.bt-card__meta').textContent = message || '';

        const [cancelBtn, confirmBtn] = node.querySelectorAll('bt-button');
        cancelBtn.setAttribute('label', cancelText || LanguageManager.t('common.cancel'));
        cancelBtn.classList.toggle('bt-hidden', hideCancel);
        confirmBtn.setAttribute('label', confirmText || LanguageManager.t('common.accept'));
        confirmBtn.setAttribute('variant', variant);

        node.setAttribute('open', '');
        return new Promise(resolve => { resolveFn = resolve; });
    }

    return {
        confirm: (opts) => open(opts),
        alert: (title, message) => open({ title, message, hideCancel: true })
    };
})();
