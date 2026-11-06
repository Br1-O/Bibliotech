/**
* Project     : Bibliotech  |  Frontend - Componente
* <bt-button>: boton reutilizable con variantes y estado de carga.
* Atributos: label, variant (primary|secondary|accent|danger|success|ghost),
*            size (sm), block, type, icon.
*/
import { LanguageManager } from '../../i18n/LanguageManager.js';
import { el, render } from '../../utils/dom.js';


if (!customElements.get('bt-button')) {
    class BtButton extends HTMLElement {
        static get observedAttributes() { return ['label', 'label-i18n', 'variant', 'size', 'block', 'disabled']; }

        connectedCallback() {
            this.render();
            LanguageManager.onChange(() => this.render());
        }
        attributeChangedCallback() { if (this.isConnected) this.render(); }

        get button() { return this.querySelector('button'); }
        setLoading(value) {
            const btn = this.button;
            if (!btn) return;
            btn.disabled = value || this.hasAttribute('disabled');
            btn.classList.toggle('bt-btn--loading', value);
        }

        render() {
            const variant = this.getAttribute('variant') || 'primary';
            const classes = ['bt-btn'];
            if (variant !== 'primary') classes.push(`bt-btn--${variant}`);
            if (this.hasAttribute('size')) classes.push(`bt-btn--${this.getAttribute('size')}`);
            if (this.hasAttribute('block')) classes.push('bt-btn--block');

            const label = this.getAttribute('label-i18n')
                ? LanguageManager.t(this.getAttribute('label-i18n'))
                : (this.getAttribute('label') || this.textContent.trim() || '');
            const icon = this.getAttribute('icon');
            this.replaceChildren();

            const btn = el('button', {
                className: classes.join(' '),
                type: this.getAttribute('type') || 'button',
                attrs: this.hasAttribute('disabled') ? { disabled: '' } : {}
            });
            if (icon) btn.appendChild(el('span', { className: 'bt-btn__icon', text: icon }));
            if (label) btn.appendChild(el('span', { text: label }));

            btn.addEventListener('click', (event) => {
                if (this.hasAttribute('disabled')) { event.preventDefault(); event.stopImmediatePropagation(); }
            });

            this.appendChild(btn);
        }
    }
    customElements.define('bt-button', BtButton);
}
