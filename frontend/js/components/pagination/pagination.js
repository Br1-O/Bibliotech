/**
* Project     : Bibliotech  |  Frontend - Componente
* Pagination: control de paginacion reutilizable (anterior/siguiente + numeros).
* Uso:
*   Pagination.render(containerNode, { page, total, pageSize, onChange });
* Se adapta al idioma activo y es responsivo.
*/
import { LanguageManager } from '../../i18n/LanguageManager.js';
import { el, render } from '../../utils/dom.js';


const Pagination = {
    DEFAULT_PAGE_SIZE: 8,

    /** Calcula el total de paginas. */
    totalPages(total, pageSize) {
        return Math.max(1, Math.ceil(Number(total) / Number(pageSize || this.DEFAULT_PAGE_SIZE)));
    },

    /** Devuelve el arreglo de paginas a mostrar (con elipsis). */
    pageList(current, totalPages, siblings = 1) {
        const pages = [];
        const start = Math.max(2, current - siblings);
        const end = Math.min(totalPages - 1, current + siblings);
        pages.push(1);
        if (start > 2) pages.push('...');
        for (let i = start; i <= end; i++) pages.push(i);
        if (end < totalPages - 1) pages.push('...');
        if (totalPages > 1) pages.push(totalPages);
        return pages;
    },

    /** Construye el nodo <nav> de paginacion. */
    build(options = {}) {
        const total = Number(options.total) || 0;
        const pageSize = Number(options.pageSize) || this.DEFAULT_PAGE_SIZE;
        const totalPages = this.totalPages(total, pageSize);
        const current = Math.min(Math.max(1, Number(options.page) || 1), totalPages);
        const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};

        const nav = el('nav', {
            className: 'bt-pagination',
            attrs: { 'aria-label': LanguageManager.t('pagination.label') }
        });

        if (totalPages <= 1) return nav;

        const go = (target) => {
            const next = Math.min(Math.max(1, target), totalPages);
            if (next !== current) onChange(next);
        };

        const makeButton = (text, target, opts = {}) => {
            const attrs = { type: 'button', 'aria-label': opts.ariaLabel || String(text) };
            if (opts.active) attrs['aria-current'] = 'page';
            const btn = el('button', {
                className: `bt-pagination__btn${opts.active ? ' is-active' : ''}`,
                text,
                attrs
            });
            if (opts.disabled) btn.disabled = true;
            else btn.addEventListener('click', () => go(target));
            return btn;
        };

        nav.appendChild(makeButton('‹', current - 1, {
            disabled: current === 1,
            ariaLabel: LanguageManager.t('pagination.previous')
        }));

        this.pageList(current, totalPages).forEach(p => {
            if (p === '...') {
                nav.appendChild(el('span', { className: 'bt-pagination__ellipsis', text: '…' }));
            } else {
                nav.appendChild(makeButton(String(p), p, { active: p === current }));
            }
        });

        nav.appendChild(makeButton('›', current + 1, {
            disabled: current === totalPages,
            ariaLabel: LanguageManager.t('pagination.next')
        }));

        return nav;
    },

    /** Reemplaza el contenido de un contenedor con el control de paginacion. */
    render(containerNode, options = {}) {
        if (!containerNode) return;
        containerNode.replaceChildren();
        containerNode.appendChild(this.build(options));
    }
};

export { Pagination };
