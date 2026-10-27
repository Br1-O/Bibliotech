/**
* Project     : Bibliotech  |  Frontend - Componente
* <bt-navbar>: barra de navegacion reutilizable, responsiva, multilenguaje
* y con selector de tema claro/oscuro.
* Atributo: active (catalog|subjects|panel|subscribed|favorites).
*/

if (!customElements.get('bt-navbar')) {
    class BtNavbar extends HTMLElement {
        connectedCallback() {
            this.classList.add('bt-navbar');
            this._notifications = [];
            this._unreadCount = 0;
            this._notificationsOpen = false;
            this._pollTimer = null;

            this._onKeydown = (event) => {
                if (event.key !== 'Escape') return;
                if (this._notificationsOpen) {
                    this.closeNotifications();
                    this._notifToggle?.focus();
                } else {
                    this.closeMobileMenu();
                }
            };
            this._onDocumentClick = (event) => {
                if (!this._notificationsOpen) return;
                if (this._notifWrapper?.contains(event.target)) return;
                this.closeNotifications();
            };
            this._onVisibility = () => {
                if (document.visibilityState === 'visible' && authHelper.isRole('Alumno')) {
                    this.refreshNotifications();
                }
            };
            this._onThemeChange = () => this.updateThemeButton();

            document.addEventListener('keydown', this._onKeydown);
            document.addEventListener('click', this._onDocumentClick);
            document.addEventListener('visibilitychange', this._onVisibility);
            document.addEventListener('bt:themechange', this._onThemeChange);
            window.addEventListener('focus', this._onVisibility);

            this.render();
            LanguageManager.onChange(() => this.render());
            this.startPolling();
        }

        disconnectedCallback() {
            if (this._onKeydown) document.removeEventListener('keydown', this._onKeydown);
            if (this._onDocumentClick) document.removeEventListener('click', this._onDocumentClick);
            if (this._onVisibility) {
                document.removeEventListener('visibilitychange', this._onVisibility);
                window.removeEventListener('focus', this._onVisibility);
            }
            if (this._onThemeChange) document.removeEventListener('bt:themechange', this._onThemeChange);
            if (this._readyListener) document.removeEventListener('bt:ready', this._readyListener);
            if (this._pollTimer) clearInterval(this._pollTimer);
        }

        startPolling() {
            if (this._pollTimer) return;
            this._pollTimer = setInterval(() => {
                if (authHelper.isRole('Alumno') && document.visibilityState === 'visible') {
                    this.refreshNotifications();
                }
            }, 60000);
        }

        closeMobileMenu() {
            const links = this.querySelector('#bt-nav-links');
            const toggle = this.querySelector('.bt-navbar__toggle');
            if (!links || !toggle) return;
            links.removeAttribute('open');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.replaceChildren(typeof Icons !== 'undefined' ? Icons.menu() : document.createTextNode('☰'));
        }

        updateThemeButton() {
            const btn = this.querySelector('.bt-theme-btn');
            if (!btn) return;
            const dark = document.documentElement.getAttribute('data-theme') === 'dark';
            const label = LanguageManager.t(dark ? 'theme.toLight' : 'theme.toDark');
            btn.setAttribute('aria-label', label);
            btn.setAttribute('title', label);
            btn.replaceChildren(typeof Icons !== 'undefined' ? (dark ? Icons.sun() : Icons.moon()) : document.createTextNode(dark ? '☀' : '☾'));
        }

        buildNotifications() {
            if (!authHelper.isAuthenticated() || !authHelper.isRole('Alumno')) return null;

            const toggle = el('button', {
                className: 'bt-notifications__toggle',
                attrs: {
                    type: 'button',
                    'aria-haspopup': 'true',
                    'aria-expanded': 'false',
                    'aria-controls': 'btNotificationsMenu',
                    'aria-label': LanguageManager.t('notifications.aria'),
                    title: LanguageManager.t('notifications.title')
                },
                on: {
                    click: (event) => {
                        event.stopPropagation();
                        this.toggleNotifications();
                    }
                }
            });
            if (typeof Icons !== 'undefined') toggle.appendChild(Icons.bell());

            const count = el('span', {
                className: 'bt-notifications__count',
                attrs: { hidden: '' }
            });
            toggle.appendChild(count);

            const menu = el('div', {
                className: 'bt-notifications__menu',
                attrs: { id: 'btNotificationsMenu', hidden: '', 'aria-label': LanguageManager.t('notifications.title') }
            });

            const wrapper = el('div', { className: 'bt-notifications' }, [toggle, menu]);
            this._notifWrapper = wrapper;
            this._notifToggle = toggle;
            this._notifCount = count;
            this._notifMenu = menu;
            this._notificationsOpen = false;

            this.updateNotificationButton();
            this.renderNotificationMenu();
            return wrapper;
        }

        updateNotificationButton() {
            if (!this._notifToggle || !this._notifCount) return;
            const unread = Math.max(0, Number(this._unreadCount) || 0);
            this._notifCount.hidden = unread === 0;
            this._notifCount.textContent = unread > 99 ? '99+' : String(unread);
            this._notifToggle.setAttribute(
                'aria-label',
                unread
                    ? LanguageManager.t('notifications.ariaUnread', { count: unread })
                    : LanguageManager.t('notifications.aria')
            );
        }

        renderNotificationMenu() {
            if (!this._notifMenu) return;

            const head = el('div', { className: 'bt-notifications__head' }, [
                el('strong', { text: LanguageManager.t('notifications.title') }),
                this._unreadCount > 0
                    ? el('span', {
                        className: 'bt-notifications__unread',
                        text: LanguageManager.t('notifications.unread', { count: this._unreadCount })
                    })
                    : null
            ]);

            if (!this._notifications.length) {
                this._notifMenu.replaceChildren(
                    head,
                    el('div', { className: 'bt-notifications__empty', text: LanguageManager.t('notifications.empty') })
                );
                return;
            }

            const list = el('div', { className: 'bt-notifications__list' },
                this._notifications.map(notification => this.notificationItem(notification)));
            this._notifMenu.replaceChildren(head, list);
        }

        formatNotificationDate(value) {
            const date = new Date(value);
            if (!value || Number.isNaN(date.getTime())) return '';
            const locale = LanguageManager.language === 'en' ? 'en-US' : 'es-ES';
            return new Intl.DateTimeFormat(locale, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        }

        notificationItem(notification) {
            const date = this.formatNotificationDate(notification.createdAt);
            const meta = [
                notification.profesorNombre
                    ? LanguageManager.t('notifications.byProfessor', { name: notification.profesorNombre })
                    : null,
                date
            ].filter(Boolean).join(' · ');

            const icon = el('span', { className: 'bt-notification__icon', attrs: { 'aria-hidden': 'true' } });
            if (typeof Icons !== 'undefined') icon.appendChild(Icons.book());

            const link = el('a', {
                className: `bt-notification${notification.readAt ? '' : ' is-unread'}`,
                attrs: { href: `/materia/${notification.subjectId}` }
            }, [
                icon,
                el('span', { className: 'bt-notification__body' }, [
                    el('span', { className: 'bt-notification__subject', text: notification.subjectNombre }),
                    el('span', { className: 'bt-notification__title', text: notification.materialTitulo }),
                    el('span', { className: 'bt-notification__meta', text: meta })
                ]),
                notification.readAt
                    ? null
                    : el('span', { className: 'bt-notification__dot', attrs: { 'aria-hidden': 'true' } })
            ]);

            link.addEventListener('click', async (event) => {
                if (event.defaultPrevented || event.button !== 0 ||
                    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                try {
                    await apiService.post(`/notifications/${notification.id}/read`);
                } catch (error) {
                    if (error.status === 401) return;
                }
                window.location.href = `/materia/${notification.subjectId}`;
            });

            return link;
        }

        async refreshNotifications() {
            if (!this._notifMenu || !authHelper.isRole('Alumno') || typeof apiService === 'undefined') return;
            try {
                const result = await apiService.get('/notifications');
                if (!this.isConnected) return;
                this._notifications = result.notifications || [];
                this._unreadCount = Number(result.unreadCount) || 0;
                this.updateNotificationButton();
                this.renderNotificationMenu();
            } catch (error) {
                if (!this._notifications.length) {
                    this._unreadCount = 0;
                    this.updateNotificationButton();
                    this.renderNotificationMenu();
                }
            }
        }

        async toggleNotifications() {
            if (!this._notifMenu) return;
            if (this._notificationsOpen) {
                this.closeNotifications();
                return;
            }

            this.closeMobileMenu();
            this._notificationsOpen = true;
            this._notifWrapper?.classList.add('is-open');
            this._notifMenu.hidden = false;
            this._notifToggle.setAttribute('aria-expanded', 'true');
            await this.refreshNotifications();
        }

        closeNotifications() {
            if (!this._notifMenu) return;
            this._notificationsOpen = false;
            this._notifWrapper?.classList.remove('is-open');
            this._notifMenu.hidden = true;
            this._notifToggle?.setAttribute('aria-expanded', 'false');
        }

        render() {
            const role = authHelper.getRole();
            const authed = authHelper.isAuthenticated();
            const active = this.getAttribute('active');

            const linksWrap = el('nav', {
                className: 'bt-navbar__links',
                attrs: { id: 'bt-nav-links', 'aria-label': LanguageManager.t('nav.menu') },
                on: { click: (event) => { if (event.target.closest('a')) this.closeMobileMenu(); } }
            });

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
                linksWrap.appendChild(el('a', {
                    className: 'bt-navbar__link bt-navbar__link--cta',
                    text: LanguageManager.t('nav.register'),
                    attrs: { href: '/register' }
                }));
            }

            const themeButton = el('button', {
                className: 'bt-theme-btn',
                attrs: { type: 'button', 'aria-label': LanguageManager.t('theme.toDark') },
                on: { click: () => Theme.toggle() }
            });

            const lang = el('div', { className: 'bt-lang' });
            LanguageManager.SUPPORTED.forEach(code => {
                lang.appendChild(el('button', {
                    className: `bt-lang__btn${LanguageManager.language === code ? ' bt-lang__btn--active' : ''}`,
                    text: code.toUpperCase(),
                    attrs: { type: 'button', 'aria-label': code },
                    on: { click: () => LanguageManager.load(code) }
                }));
            });

            const toggle = el('button', {
                className: 'bt-navbar__toggle',
                attrs: {
                    type: 'button',
                    'aria-label': LanguageManager.t('nav.menu'),
                    'aria-expanded': 'false',
                    'aria-controls': 'bt-nav-links'
                },
                on: {
                    click: () => {
                        this.closeNotifications();
                        const links = this.querySelector('#bt-nav-links');
                        const open = links.toggleAttribute('open');
                        toggle.setAttribute('aria-expanded', String(open));
                        toggle.replaceChildren(typeof Icons !== 'undefined' ? (open ? Icons.close() : Icons.menu()) : document.createTextNode(open ? '×' : '☰'));
                    }
                }
            });
            if (typeof Icons !== 'undefined') toggle.appendChild(Icons.menu());

            const notifications = this.buildNotifications();
            const actions = el('div', { className: 'bt-navbar__actions' }, [
                notifications,
                themeButton,
                lang,
                toggle
            ].filter(Boolean));

            const brand = el('a', { className: 'bt-navbar__brand', attrs: { href: '/' } }, [
                el('span', { className: 'bt-navbar__mark', text: 'B' }),
                el('span', { text: LanguageManager.t('app.name') })
            ]);

            const inner = el('div', { className: 'bt-navbar__inner' }, [brand, linksWrap, actions]);
            this.replaceChildren(inner);
            this.updateThemeButton();

            if (this._readyListener) {
                document.removeEventListener('bt:ready', this._readyListener);
                this._readyListener = null;
            }
            if (this._notifToggle) {
                if (typeof apiService !== 'undefined') {
                    this.refreshNotifications();
                } else {
                    this._readyListener = () => {
                        this._readyListener = null;
                        this.refreshNotifications();
                    };
                    document.addEventListener('bt:ready', this._readyListener, { once: true });
                }
            }
        }
    }
    customElements.define('bt-navbar', BtNavbar);
}
