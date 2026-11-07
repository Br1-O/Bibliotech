/**
* Project     : Bibliotech  |  Frontend - Componente
* <bt-navbar>: barra de navegacion reutilizable, responsiva, multilenguaje
* y con selector de tema claro/oscuro.
* Atributo: active (catalog|subjects|panel|content|subscribed).
*/
import { LanguageManager } from '../../i18n/LanguageManager.mjs';
import { apiService } from '../../services/apiService.mjs';
import { Theme } from '../../theme.mjs';
import { authHelper } from '../../utils/authHelper.mjs';
import { el, render } from '../../utils/dom.mjs';
import { Icons } from '../icons/icons.mjs';
import { PasswordChange } from '../passwordChange/passwordChange.mjs';


if (!customElements.get('bt-navbar')) {
    class BtNavbar extends HTMLElement {
        connectedCallback() {
            this.classList.add('bt-navbar');
            this._notifications = [];
            this._unreadCount = 0;
            this._notificationsOpen = false;
            this._profileMenuOpen = false;
            this._pollTimer = null;
            this._profile = null;

            this._onKeydown = (event) => {
                if (event.key !== 'Escape') return;
                if (this._profileMenuOpen) {
                    this.closeProfileMenu();
                } else if (this._notificationsOpen) {
                    this.closeNotifications();
                    this._notifToggle?.focus();
                } else {
                    this.closeMobileMenu();
                }
            };
            this._onDocumentClick = (event) => {
                if (this._profileMenuOpen && !this._profileWrapper?.contains(event.target)) {
                    this.closeProfileMenu();
                }
                if (this._notificationsOpen && !this._notifWrapper?.contains(event.target)) {
                    this.closeNotifications();
                }
            };
            this._onVisibility = () => {
                if (document.visibilityState === 'visible' && authHelper.isAuthenticated()) {
                    this.refreshNotifications();
                    this.refreshMiniProfile();
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
                if (authHelper.isAuthenticated() && document.visibilityState === 'visible') {
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

        buildMiniProfile() {
            if (!authHelper.isAuthenticated()) return null;
            const user = authHelper.getUser() || {};
            const profile = this._profile;
            const rankTitle = profile?.user?.rankTitle || profile?.user?.rank?.title || user.rankTitle || user.rankNombre || '';
            const streak = Number(profile?.streak?.currentStreak) || 0;
            const picture = profile?.user?.profilePicture || user.profilePicture || '/img/profile_pictures/default-1.png';
            const name = profile?.user?.nombreCompleto || user.nombreCompleto || `${user.nombre || ''} ${user.apellido || ''}`.trim() || LanguageManager.t('nav.profile');

            const toggle = el('button', {
                className: 'bt-navbar__profile',
                attrs: {
                    type: 'button',
                    'aria-haspopup': 'true',
                    'aria-expanded': 'false',
                    title: LanguageManager.t('nav.profile'),
                    'aria-label': LanguageManager.t('nav.profile')
                }
            }, [
                el('img', { className: 'bt-navbar__avatar', attrs: { src: picture, alt: '' } }),
                el('span', { className: 'bt-navbar__profile-text' }, [
                    el('strong', { text: name }),
                    el('small', { text: rankTitle || LanguageManager.t('profile.noRank') }),
                    streak > 0
                        ? el('small', { className: 'bt-navbar__streak', title: LanguageManager.t('profile.streak') }, [
                            el('span', { attrs: { 'aria-hidden': 'true' }, text: '🔥' }),
                            el('span', { text: String(streak) })
                        ])
                        : null
                ])
            ]);

            const item = (tag, key, attrs = {}, handler = null) => {
                const node = el(tag, {
                    className: 'bt-navbar__dropdown-item',
                    text: LanguageManager.t(key),
                    attrs
                });
                if (handler) node.addEventListener('click', handler);
                return node;
            };
            const menu = el('div', {
                className: 'bt-navbar__dropdown',
                attrs: { hidden: '', role: 'menu' }
            }, [
                item('a', 'nav.profile', { href: '/perfil', role: 'menuitem' }),
                item('button', 'nav.password', { type: 'button', role: 'menuitem' }, () => {
                    this.closeProfileMenu();
                    if (typeof PasswordChange !== 'undefined') PasswordChange.open();
                }),
                item('button', 'nav.logout', { type: 'button', role: 'menuitem' }, () => authHelper.logout())
            ]);

            const wrapper = el('div', { className: 'bt-navbar__profile-menu' }, [toggle, menu]);
            toggle.addEventListener('click', event => {
                event.stopPropagation();
                const open = !this._profileMenuOpen;
                this.closeNotifications();
                this._profileMenuOpen = open;
                wrapper.classList.toggle('is-open', open);
                menu.hidden = !open;
                toggle.setAttribute('aria-expanded', String(open));
            });

            this._miniProfile = wrapper;
            this._profileWrapper = wrapper;
            this._profileMenu = menu;
            this._profileToggle = toggle;
            return wrapper;
        }

        closeProfileMenu() {
            this._profileMenuOpen = false;
            this._profileWrapper?.classList.remove('is-open');
            if (this._profileMenu) this._profileMenu.hidden = true;
            this._profileToggle?.setAttribute('aria-expanded', 'false');
        }

        async refreshMiniProfile() {
            if (!authHelper.isAuthenticated() || typeof apiService === 'undefined') return;
            const user = authHelper.getUser() || {};
            if (!user.id) return;
            try {
                const profile = await apiService.get(`/profile/${user.id}`);
                if (!this.isConnected) return;
                this._profile = profile;
                const rankTitle = profile?.user?.rankTitle || profile?.user?.rank?.title;
                const picture = profile?.user?.profilePicture;
                if (rankTitle || picture) {
                    authHelper.saveSession(authHelper.getToken(), {
                        ...user,
                        rankTitle,
                        rankNombre: rankTitle,
                        profilePicture: picture
                    });
                }
                this.updateMiniProfile();
            } catch (error) {
                // El perfil se reintentara al recuperar la sesion o abrir la bandeja.
            }
        }

        updateMiniProfile() {
            if (!this._miniProfile || !this._miniProfile.isConnected) return;
            const fresh = this.buildMiniProfile();
            if (fresh) this._miniProfile.replaceWith(fresh);
        }

        buildNotifications() {
            if (!authHelper.isAuthenticated()) return null;

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

        notificationIcon(type) {
            const icon = el('span', { className: 'bt-notification__icon', attrs: { 'aria-hidden': 'true' } });
            if (type === 'streak') { icon.textContent = '🔥'; return icon; }
            if (typeof Icons !== 'undefined') {
                icon.appendChild(type === 'badge' ? Icons.sparkle() : (type === 'material' ? Icons.book() : Icons.heart()));
            }
            return icon;
        }

        notificationContent(notification) {
            const type = notification.type || 'material';
            let title = notification.materialTitulo || notification.subjectNombre || '';
            let body = '';
            if (type === 'streak') {
                title = LanguageManager.t('notifications.streakTitle');
                body = LanguageManager.t('notifications.streakBody', { count: Number(notification.message) || 1 });
            } else if (type === 'badge') {
                title = LanguageManager.t('notifications.badgeTitle');
                body = LanguageManager.t(`badges.${notification.message}.name`);
                if (body === `badges.${notification.message}.name`) body = notification.message || '';
            } else if (type === 'read') {
                title = LanguageManager.t('notifications.readTitle');
                body = notification.materialTitulo || '';
            } else if (type === 'upload') {
                title = LanguageManager.t('notifications.uploadTitle');
                body = notification.materialTitulo || '';
            } else {
                body = notification.subjectNombre || '';
            }
            return { type, title: title || '', body: body || '' };
        }

        notificationHref(notification) {
            if (notification.type === 'material' && notification.subjectId) return `/materia/${notification.subjectId}`;
            if (notification.actorId) return `/perfil/${notification.actorId}`;
            return '/mi-contenido';
        }

        notificationItem(notification) {
            const date = this.formatNotificationDate(notification.createdAt);
            const content = this.notificationContent(notification);
            const meta = [
                notification.actorNombre || null,
                date
            ].filter(Boolean).join(' · ');

            const href = this.notificationHref(notification);
            const link = el('a', {
                className: `bt-notification${notification.readAt ? '' : ' is-unread'}`,
                attrs: { href }
            }, [
                this.notificationIcon(content.type),
                el('span', { className: 'bt-notification__body' }, [
                    el('span', { className: 'bt-notification__subject', text: content.title }),
                    content.body ? el('span', { className: 'bt-notification__title', text: content.body }) : null,
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
                window.location.href = href;
            });

            return link;
        }

        async refreshNotifications() {
            if (!this._notifMenu || !authHelper.isAuthenticated() || typeof apiService === 'undefined') return;
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

        async markAllNotificationsRead() {
            if (!this._notifMenu || this._unreadCount <= 0 || this._markingAllRead) return;
            this._markingAllRead = true;
            try {
                await apiService.post('/notifications/read-all', {});
                if (!this.isConnected) return;
                const now = new Date().toISOString();
                this._notifications.forEach(notification => {
                    if (!notification.readAt) notification.readAt = now;
                });
                this._unreadCount = 0;
                this.updateNotificationButton();
                this.renderNotificationMenu();
            } catch (error) {
                // Se reintentara al volver a abrir la bandeja.
            } finally {
                this._markingAllRead = false;
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
            await this.markAllNotificationsRead();
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
            linksWrap.appendChild(link('/materias', 'nav.subjects', active === 'subjects'));

            if (authed) {
                linksWrap.appendChild(link(authHelper.panelRoute(), 'nav.myPanel', active === 'panel'));
                linksWrap.appendChild(link('/mi-contenido', 'nav.myContent', active === 'content'));
                if (role === 'Alumno') {
                    linksWrap.appendChild(link('/materias#suscritas', 'nav.mySubscriptions', active === 'subscribed'));
                }
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
            const miniProfile = this.buildMiniProfile();
            const actions = el('div', { className: 'bt-navbar__actions' }, [
                miniProfile,
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
            if (miniProfile && !this._profile && typeof apiService !== 'undefined') {
                this.refreshMiniProfile();
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
