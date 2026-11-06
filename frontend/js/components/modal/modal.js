/**
* Project     : Bibliotech  |  Frontend - Componente
* Modal de confirmacion / aviso con soporte multilenguaje.
* Uso: const ok = await Modal.confirm({ title, message });
*/
import { LanguageManager } from '../../i18n/LanguageManager.js';
import { el } from '../../utils/dom.js';


const Modal = (() => {
    let root = null;
    let resolveFn = null;

    function ensure() {
        if (root) return root;
        const title = el('h3', { className: 'bt-modal__title' });
        const body = el('div', { className: 'bt-modal__body' });
        const cancelBtn = el('bt-button', { variant: 'ghost' });
        const confirmBtn = el('bt-button', { variant: 'primary' });

        cancelBtn.addEventListener('click', () => close(false));
        confirmBtn.addEventListener('click', () => close(true));

        const content = el('div', { className: 'bt-modal__content', attrs: { role: 'document' } }, [
            el('div', { className: 'bt-modal__header' }, [title]),
            body,
            el('div', { className: 'bt-modal__footer' }, [cancelBtn, confirmBtn])
        ]);

        root = el('div', {
            className: 'bt-modal',
            attrs: { role: 'dialog', 'aria-modal': 'true' },
            on: { click: (e) => { if (e.target === root) close(false); } }
        }, [content]);
        document.body.appendChild(root);

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && root.hasAttribute('open')) close(false);
        });
        return root;
    }

    function close(result) {
        if (root) root.removeAttribute('open');
        if (resolveFn) { resolveFn(result); resolveFn = null; }
    }

    function open({ title, message, content = null, confirmText, cancelText, hideCancel = false, variant = 'primary', rich = false }) {
        const node = ensure();
        const body = node.querySelector('.bt-modal__body');
        node.classList.toggle('bt-modal--rich', Boolean(rich || content));
        node.querySelector('.bt-modal__title').textContent = title || '';
        body.classList.toggle('bt-modal__body--rich', Boolean(rich || content));
        if (content) body.replaceChildren(...[
            message ? el('p', { className: 'bt-modal__message', text: message }) : null,
            content
        ].filter(Boolean));
        else body.textContent = message || '';

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
        alert: (title, message) => open({ title, message, hideCancel: true }),
        info: ({ title, description, content }) => open({
            title,
            message: description,
            content,
            hideCancel: true,
            confirmText: LanguageManager.t('common.close'),
            rich: true
        }),
        dismiss: () => close(true)
    };
})();

export { Modal };
