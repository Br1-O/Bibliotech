/**
* Project     : Bibliotech  |  Frontend - Componente
* <bt-navbar>: barra de navegacion reutilizable, responsiva y multilenguaje.
* Atributo: active (clave del enlace activo: catalog|subjects|panel).
*/

if (!customElements.get('bt-navbar')) {
    class BtNavbar extends HTMLElement {
        connectedCallback() {
            this.render();
            // Re-renderiza al cambiar el idioma (contenido dinamico).
            LanguageManager.onChange(() => this.render());
        }

        render() {
            const role = authHelper.getRole();
            const authed = authHelper.isAuthenticated();
            const active = this.getAttribute('active');

            const linksWrap = el('nav', { className: 'bt-navbar__links', attrs: { id: 'bt-nav-links' } });

            const link = (href, key, isActive) => el('a', {
                className: `bt-navbar__link${isActive ? ' bt-navbar__link--active' : ''}`,
                text: LanguageManager.t(key),
                attrs: { href }
            });

            linksWrap.appendChild(link('/', 'nav.catalog', active === 'catalog'));
            linksWrap.appendChild(link('/catalogo#materias', 'nav.subjects', active === 'subjects'));

            if (authed) {
                linksWrap.appendChild(link(authHelper.panelRoute(), 'nav.myPanel', active === 'panel'));
                if (role === 'Alumno') {
                    linksWrap.appendChild(link('/#suscritas', 'nav.mySubscriptions', active === 'subscribed'));
                }
                linksWrap.appendChild(link('/favoritos', 'nav.favorites', active === 'favorites'));
                linksWrap.appendChild(el('a', {
                    className: 'bt-navbar__link', text: LanguageManager.t('nav.logout'),
                    attrs: { href: '#' },
                    on: { click: (e) => { e.preventDefault(); authHelper.logout(); } }
                }));
            } else {
                linksWrap.appendChild(link('/login', 'nav.login', false));
                linksWrap.appendChild(link('/register', 'nav.register', false));
            }

            // Selector de idioma.
            const lang = el('div', { className: 'bt-lang' });
            LanguageManager.SUPPORTED.forEach(code => {
                lang.appendChild(el('button', {
                    className: `bt-lang__btn${LanguageManager.language === code ? ' bt-lang__btn--active' : ''}`,
                    text: code.toUpperCase(),
                    attrs: { type: 'button', 'aria-label': code },
                    on: { click: () => LanguageManager.load(code) }
                }));
            });
            linksWrap.appendChild(lang);

            const toggle = el('button', {
                className: 'bt-navbar__toggle',
                text: '☰',
                attrs: { type: 'button', 'aria-label': LanguageManager.t('nav.menu') },
                on: {
                    click: () => {
                        const links = this.querySelector('#bt-nav-links');
                        links.toggleAttribute('open');
                    }
                }
            });

            const brand = el('a', { className: 'bt-navbar__brand', attrs: { href: '/' } }, [
                el('span', { text: '📚' }),
                el('span', { text: LanguageManager.t('app.name') })
            ]);

            const inner = el('div', { className: 'bt-navbar__inner' }, [brand, toggle, linksWrap]);
            this.replaceChildren(inner);
        }
    }
    customElements.define('bt-navbar', BtNavbar);
}
