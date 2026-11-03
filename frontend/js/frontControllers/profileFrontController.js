/**
* Project     : Bibliotech  |  Frontend - Controlador
* profileFrontController: perfil propio y publico, edicion en linea,
* insignias, rachas, seguidores, carpetas y progreso de lectura.
*/

document.addEventListener('bt:ready', () => {
    const root = document.getElementById('profileContent');
    if (!root) return;

    const segments = window.location.pathname.split('/').filter(Boolean);
    const requestedId = segments[0] === 'perfil' && segments[1] ? Number(segments[1]) : null;
    const viewer = authHelper.getUser() || {};
    const viewerId = authHelper.isAuthenticated() ? Number(viewer.id) : null;
    const targetId = requestedId || viewerId;

    if (!targetId) {
        window.location.href = '/login';
        return;
    }

    const state = {
        profile: null,
        tab: 'uploads',
        materials: [],
        page: 1,
        total: 0,
        pictures: null,
        unavailablePictures: false
    };
    const PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;

    const tr = (key, params) => LanguageManager.t(key, params);
    const iconOr = (factory, fallback) => (typeof Icons !== 'undefined' && Icons[factory]) ? Icons[factory]() : document.createTextNode(fallback);

    function fireIcon() {
        return el('span', { className: 'bt-profile__fire', attrs: { 'aria-hidden': 'true' }, text: '🔥' });
    }

    async function load() {
        Loader.skeletons(root, 3);
        try {
            state.profile = await apiService.get(`/profile/${targetId}`);
            document.title = `Bibliotech · ${state.profile.user.nombreCompleto}`;
            renderProfile();
            await loadTab(state.tab);
        } catch (error) {
            render(root, Cards.empty(error.message));
        }
    }

    function stat(value, labelKey, extra = null) {
        return el('div', { className: 'bt-stat bt-profile__stat' }, [
            el('span', { className: 'bt-stat__value', text: String(value ?? 0) }),
            el('span', { className: 'bt-stat__label', text: tr(labelKey) }),
            extra
        ]);
    }

    function renderProfile() {
        const { user, stats, streak, badges, allBadges, isSelf } = state.profile;
        const rank = user.rank || {};
        const unlocked = new Set(badges.map(badge => badge.key));
        const streakCount = Number(streak?.currentStreak) || 0;
        const avatar = el('button', {
            className: `bt-profile__avatar${isSelf ? ' is-editable' : ''}`,
            attrs: { type: 'button', 'aria-label': tr(isSelf ? 'profile.changePicture' : 'profile.avatar') }
        }, [
            el('img', { attrs: { src: user.profilePicture || '/img/profile_pictures/default-1.png', alt: user.nombreCompleto } })
        ]);
        if (isSelf) avatar.addEventListener('click', openPicturePicker);

        const header = el('section', { className: 'bt-profile__hero' }, [
            avatar,
            el('div', { className: 'bt-profile__identity bt-stack' }, [
                el('div', { className: 'bt-profile__name-row' }, [
                    el('h1', { text: user.nombreCompleto }),
                    el('span', { className: 'bt-badge bt-badge--subject', text: tr(`roles.${user.roleNombre}`) })
                ]),
                user.email ? el('a', {
                    className: 'bt-profile__email',
                    text: user.email,
                    attrs: { href: `mailto:${user.email}` }
                }) : null,
                el('div', { className: 'bt-profile__rank-row' }, [
                    el('span', { className: 'bt-profile__rank-badge' }, [
                        el('img', { attrs: { src: rank.picture || '/img/profile_pictures/default-1.png', alt: '' } }),
                        el('strong', { text: rank.title || tr('profile.noRank') })
                    ]),
                    el('span', { className: 'bt-profile__xp', text: tr('profile.xp', { xp: user.xp || 0 }) }),
                    streakCount > 0
                        ? el('span', { className: 'bt-profile__streak', title: tr('profile.streak') }, [
                            fireIcon(),
                            el('span', { text: tr('profile.streakDays', { count: streakCount }) })
                        ])
                        : null
                ]),
                state.profile.nextRank
                    ? el('div', { className: 'bt-profile__progress', attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(state.profile.rankProgress || 0)) } }, [
                        el('span', { attrs: { style: `width:${Math.round(state.profile.rankProgress || 0)}%` } }),
                        el('small', {
                            text: tr('profile.nextRank', {
                                rank: state.profile.nextRank.title,
                                xp: Math.max(0, state.profile.nextRank.minXp - (user.xp || 0))
                            })
                        })
                    ])
                    : el('p', { className: 'bt-text-muted', text: tr('profile.maxRank') })
            ]),
            buildHeaderActions(isSelf)
        ]);

        const statsGrid = el('div', { className: 'bt-stats bt-profile__stats' }, [
            stat(stats.reads, 'profile.stats.reads'),
            stat(stats.favorites, 'profile.stats.favorites'),
            stat(stats.uploads, 'profile.stats.uploads'),
            stat(stats.followers, 'profile.stats.followers'),
            stat(stats.following, 'profile.stats.following'),
            stat(stats.backlog, 'profile.stats.backlog')
        ]);

        const info = renderInfo(user, isSelf);
        const badgesSection = renderBadges(allBadges, unlocked);
        if (!isSelf && state.tab !== 'uploads') state.tab = 'uploads';
        const tabs = renderTabs(isSelf);

        render(root, [
            header,
            statsGrid,
            el('div', { className: 'bt-profile__grid' }, [info, badgesSection]),
            tabs
        ]);
    }

    function buildHeaderActions(isSelf) {
        const actions = el('div', { className: 'bt-profile__actions' });
        if (isSelf) {
            actions.appendChild(el('a', {
                className: 'bt-btn bt-btn--secondary bt-btn--sm',
                text: tr('profile.editProfile'),
                attrs: { href: '#profileInfo' }
            }));
        } else if (authHelper.isAuthenticated()) {
            const following = Boolean(state.profile.isFollowing);
            const btn = el('button', {
                className: `bt-btn ${following ? 'bt-btn--ghost' : ''} bt-btn--sm`,
                text: tr(following ? 'profile.following' : 'profile.follow'),
                attrs: { type: 'button' }
            });
            btn.addEventListener('click', () => toggleFollow(btn, following));
            actions.appendChild(btn);
        } else {
            actions.appendChild(el('a', {
                className: 'bt-btn bt-btn--sm',
                text: tr('profile.follow'),
                attrs: { href: `/login?redirect=${encodeURIComponent(window.location.pathname)}` }
            }));
        }
        return actions;
    }

    async function toggleFollow(btn, following) {
        btn.disabled = true;
        try {
            if (following) {
                await apiService.del(`/subscriptions/${targetId}`);
                Toast.success(tr('messages.unfollowedUser'));
            } else {
                await apiService.post(`/subscriptions/${targetId}`, {});
                Toast.success(tr('messages.followedUser'));
            }
            state.profile = await apiService.get(`/profile/${targetId}`);
            renderProfile();
            await loadTab(state.tab);
        } catch (error) {
            Toast.error(error.message);
        } finally {
            btn.disabled = false;
        }
    }

    function infoRow(labelKey, value, field, type = 'text', isSelf = false, options = {}) {
        const display = value === null || value === undefined || value === '' ? '-' : String(value);
        const valueNode = el('span', { className: 'bt-profile__value', text: display });
        const row = el('div', { className: 'bt-profile__info-row' }, [
            el('span', { className: 'bt-profile__label', text: tr(labelKey) }),
            valueNode
        ]);
        if (!isSelf) return row;

        const editBtn = el('button', {
            className: 'bt-profile__edit',
            attrs: { type: 'button', 'aria-label': tr('profile.editField', { field: tr(labelKey) }), title: tr('profile.editField', { field: tr(labelKey) }) }
        });
        editBtn.textContent = '✎';

        editBtn.addEventListener('click', () => {
            if (row.querySelector('input, select, textarea')) return;
            const inputValue = options.inputValue !== undefined
                ? options.inputValue
                : (display === '-' ? '' : display);
            let input;
            if (type === 'textarea') {
                input = el('textarea', {
                    className: 'bt-textarea bt-input--inline',
                    attrs: { rows: '3', maxlength: options.maxlength || '300', 'aria-label': tr(labelKey) },
                    value: inputValue
                });
            } else if (type === 'gender') {
                input = el('select', {
                    className: 'bt-select bt-input--inline',
                    attrs: { 'aria-label': tr(labelKey) }
                }, [
                    el('option', { value: '', text: '-' }),
                    ...['Male', 'Female', 'Non-Binary', 'Other'].map(value => el('option', {
                        value,
                        text: tr(`profile.genders.${value}`)
                    }))
                ]);
                input.value = inputValue || '';
            } else {
                input = el('input', {
                    className: 'bt-input bt-input--inline',
                    attrs: {
                        type,
                        value: inputValue,
                        maxlength: options.maxlength || '255',
                        'aria-label': tr(labelKey)
                    }
                });
            }

            let customInput = null;
            if (type === 'gender') {
                customInput = el('input', {
                    className: 'bt-input bt-input--inline',
                    attrs: { type: 'text', maxlength: '10', placeholder: tr('profile.fields.genderCustom'), 'aria-label': tr('profile.fields.genderCustom') },
                    value: options.customValue || ''
                });
                customInput.hidden = input.value !== 'Other';
                input.addEventListener('change', () => { customInput.hidden = input.value !== 'Other'; });
            }

            const editor = el('div', { className: 'bt-profile__inline-editor' }, [input, customInput].filter(Boolean));
            const save = el('button', { className: 'bt-btn bt-btn--sm', attrs: { type: 'button' }, text: tr('common.save') });
            const cancel = el('button', { className: 'bt-btn bt-btn--ghost bt-btn--sm', attrs: { type: 'button' }, text: tr('common.cancel') });
            valueNode.replaceChildren(editor);
            row.querySelector('.bt-profile__edit')?.remove();
            row.appendChild(el('div', { className: 'bt-profile__edit-actions' }, [save, cancel]));

            cancel.addEventListener('click', () => renderProfile());
            save.addEventListener('click', async () => {
                save.disabled = true;
                try {
                    const payload = { [field]: input.value.trim() };
                    if (type === 'gender') payload.genderCustom = customInput.value.trim();
                    state.profile = await apiService.put('/profile', payload);
                    Toast.success(tr('messages.profileUpdated'));
                    renderProfile();
                    await loadTab(state.tab);
                } catch (error) {
                    Toast.error(error.message);
                    save.disabled = false;
                }
            });
            input.addEventListener('keydown', event => {
                if (event.key === 'Enter' && type !== 'textarea') save.click();
                if (event.key === 'Escape') renderProfile();
            });
            input.focus();
            input.select?.();
        });
        row.appendChild(editBtn);
        return row;
    }

    function renderInfo(user, isSelf) {
        const genderLabel = user.gender === 'Other'
            ? (user.genderCustom || tr('profile.genders.Other'))
            : (user.gender ? tr(`profile.genders.${user.gender}`) : '-');
        const rows = [
            infoRow('profile.fields.name', user.nombre, 'nombre', 'text', isSelf, { maxlength: 50 }),
            infoRow('profile.fields.lastName', user.apellido, 'apellido', 'text', isSelf, { maxlength: 50 }),
            ...(user.email ? [infoRow('profile.fields.email', user.email, 'email', 'email', false)] : []),
            infoRow('profile.fields.age', user.age, 'birthdate', 'date', isSelf, { inputValue: user.birthdate || '' }),
            infoRow('profile.fields.gender', genderLabel, 'gender', 'gender', isSelf, {
                inputValue: user.gender || '',
                customValue: user.genderCustom || ''
            }),
            infoRow('profile.fields.city', user.city, 'city', 'text', isSelf, { maxlength: 50 }),
            infoRow('profile.fields.country', user.country, 'country', 'text', isSelf, { maxlength: 50 }),
            infoRow('profile.fields.phone', user.phone, 'phone', 'tel', isSelf, { maxlength: 20 }),
            infoRow('profile.fields.linkedin', user.linkedin, 'linkedin', 'text', isSelf, { maxlength: 100 }),
            infoRow('profile.fields.github', user.github, 'github', 'text', isSelf, { maxlength: 100 }),
            infoRow('profile.fields.instagram', user.instagram, 'instagram', 'text', isSelf, { maxlength: 100 }),
            infoRow('profile.fields.career', user.career, 'career', 'text', isSelf, { maxlength: 80 }),
            infoRow('profile.fields.institute', user.institute, 'institute', 'text', isSelf, { maxlength: 80 }),
            infoRow('profile.fields.aboutMe', user.aboutMe, 'aboutMe', 'textarea', isSelf, { maxlength: 300 }),
            el('div', { className: 'bt-profile__info-row' }, [
                el('span', { className: 'bt-profile__label', text: tr('profile.fields.memberSince') }),
                el('span', { className: 'bt-profile__value', text: formatDate(user.createdAt) })
            ])
        ];
        return el('section', { className: 'bt-panel bt-profile__info', attrs: { id: 'profileInfo' } }, [
            el('h2', { text: tr('profile.about') }),
            ...rows
        ]);
    }

    function formatDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return new Intl.DateTimeFormat(LanguageManager.language === 'en' ? 'en-US' : 'es-ES', {
            year: 'numeric', month: 'long', day: 'numeric'
        }).format(date);
    }

    function renderBadges(allBadges, unlocked) {
        const grid = el('div', { className: 'bt-badges-grid' }, (allBadges || []).map(badge => {
            const earned = unlocked.has(badge.key);
            return el('div', {
                className: `bt-badge-card${earned ? ' is-earned' : ' is-locked'}`,
                attrs: { title: tr(earned ? `badges.${badge.key}.description` : `badges.${badge.key}.requirement`) }
            }, [
                el('img', { attrs: { src: badge.icon, alt: '', loading: 'lazy' } }),
                el('strong', { text: tr(`badges.${badge.key}.name`) }),
                el('span', { text: tr(`badges.${badge.key}.${earned ? 'description' : 'requirement'}`) })
            ]);
        }));
        return el('section', { className: 'bt-panel bt-profile__badges' }, [
            el('h2', { text: tr('profile.badges') }),
            grid
        ]);
    }

    function renderTabs(isSelf) {
        const definitions = [
            ['uploads', 'profile.tabs.uploads'],
            ['favorites', 'profile.tabs.favorites'],
            ['reads', 'profile.tabs.reads'],
            ['backlog', 'profile.tabs.backlog']
        ].filter(([key]) => isSelf || key === 'uploads');
        const buttons = definitions.map(([key, label]) => {
            const btn = el('button', {
                className: `bt-profile__tab${state.tab === key ? ' is-active' : ''}`,
                attrs: { type: 'button', role: 'tab', 'aria-selected': state.tab === key ? 'true' : 'false' },
                text: tr(label)
            });
            btn.addEventListener('click', async () => {
                state.tab = key;
                state.page = 1;
                renderProfile();
                await loadTab(key);
            });
            return btn;
        });
        return el('section', { className: 'bt-profile__folders bt-stack' }, [
            el('div', { className: 'bt-profile__tabs', attrs: { role: 'tablist' } }, buttons),
            el('div', { id: 'profileFolder', className: 'bt-grid' })
        ]);
    }

    async function loadTab(tab) {
        const folder = document.getElementById('profileFolder');
        if (!folder) return;
        Loader.skeletons(folder, 3);
        try {
            const pagination = { page: state.page, pageSize: PAGE_SIZE };
            if (tab === 'backlog') {
                const result = await apiService.get(`/users/${targetId}/backlog`, pagination);
                state.total = Number(result.pagination?.total ?? (result.items || []).length);
                renderBacklog(folder, result.items || []);
                return;
            }
            const endpoint = {
                uploads: `/users/${targetId}/uploads`,
                favorites: `/users/${targetId}/favorites`,
                reads: `/users/${targetId}/reads`
            }[tab];
            const result = await apiService.get(endpoint, pagination);
            state.materials = result.materials || [];
            state.total = Number(result.pagination?.total ?? state.materials.length);
            const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
            if (state.page > totalPages) {
                state.page = totalPages;
                return loadTab(tab);
            }
            renderMaterials(folder);
        } catch (error) {
            render(folder, Cards.empty(error.message));
        }
    }

    function renderPagination(total) {
        const folder = document.getElementById('profileFolder');
        let pagination = document.getElementById('profilePagination');
        if (!pagination) {
            pagination = el('div', { id: 'profilePagination', className: 'bt-mt-4' });
            folder.after(pagination);
        }
        Pagination.render(pagination, {
            page: state.page,
            total,
            pageSize: PAGE_SIZE,
            onChange: page => { state.page = page; loadTab(state.tab); }
        });
    }

    function renderMaterials(folder) {
        const total = state.total;
        if (!total) {
            render(folder, Cards.empty(tr(`profile.empty.${state.tab}`)));
            const existing = document.getElementById('profilePagination');
            if (existing) existing.remove();
            return;
        }
        render(folder, state.materials.map(material => Cards.material(material, {
            onToggleFavorite: authHelper.isAuthenticated() ? value => Cards.toggleFavorite(value) : null,
            onEdit: canEdit(material) ? editMaterial : null
        })));
        renderPagination(total);
    }

    function canEdit(material) {
        return Cards.canEdit(material);
    }

    function editMaterial(material) {
        MaterialEditor.open(material, async () => {
            state.profile = await apiService.get(`/profile/${targetId}`);
            renderProfile();
            await loadTab(state.tab);
        });
    }

    async function refreshBacklog() {
        try {
            state.profile = await apiService.get(`/profile/${targetId}`);
            renderProfile();
            await loadTab('backlog');
        } catch (error) {
            Toast.error(error.message);
        }
    }

    function renderBacklog(folder, items) {
        if (!state.total) {
            render(folder, Cards.empty(tr('profile.empty.backlog')));
            const existing = document.getElementById('profilePagination');
            if (existing) existing.remove();
            return;
        }
        const canManage = authHelper.isAuthenticated() && Number(viewerId) === Number(targetId);
        render(folder, items.map(item => Cards.backlogCard(item, {
            onOpen: (material, page) => openInViewer(material, page),
            onRead: canManage ? () => refreshBacklog() : null,
            onRemove: canManage ? async material => {
                try {
                    await apiService.del(`/backlog/${material.id}`);
                    await refreshBacklog();
                } catch (error) {
                    Toast.error(error.message);
                }
            } : null
        })).filter(Boolean));
        renderPagination(state.total);
    }

    function openInViewer(material, page = 1) {
        const refresh = async () => {
            if (!authHelper.isAuthenticated()) return;
            state.profile = await apiService.get(`/profile/${targetId}`);
            renderProfile();
            await loadTab('backlog');
        };
        if (typeof MaterialViewer !== 'undefined' && (MaterialViewer.isPdf(material) || MaterialViewer.isYoutube(material))) {
            MaterialViewer.open(material, { startPage: page, onClose: refresh });
        } else {
            const fallback = typeof MaterialViewer !== 'undefined'
                ? (MaterialViewer.downloadHref(material) || material.urlOrPath)
                : material.urlOrPath;
            window.open(fallback, '_blank', 'noopener');
        }
    }

    async function openPicturePicker() {
        try {
            if (!state.pictures) {
                const result = await apiService.get('/profile-pictures');
                state.pictures = result.pictures || [];
            }
        } catch (error) {
            Toast.error(error.message);
            return;
        }
        const grid = el('div', { className: 'bt-picture-grid' }, state.pictures.map(picture => {
            const active = picture.picture === state.profile.user.profilePicture;
            const btn = el('button', {
                className: `bt-picture-option${active ? ' is-active' : ''}`,
                attrs: { type: 'button', title: picture.label }
            }, [
                el('img', { attrs: { src: picture.picture, alt: picture.label } }),
                el('span', { text: picture.label })
            ]);
            btn.addEventListener('click', async () => {
                try {
                    state.profile = await apiService.put('/profile', { profilePicture: picture.picture });
                    state.pictures = null;
                    Toast.success(tr('messages.profileUpdated'));
                    renderProfile();
                    await loadTab(state.tab);
                    Modal.dismiss?.();
                } catch (error) {
                    Toast.error(error.message);
                }
            });
            return btn;
        }));

        if (typeof Modal !== 'undefined') {
            Modal.info({
                title: tr('profile.choosePicture'),
                description: tr('profile.choosePictureHint'),
                content: grid
            });
        }
    }

    Loader.skeletons(root, 3);
    load();
    LanguageManager.onChange(() => {
        if (!state.profile) return;
        renderProfile();
        loadTab(state.tab);
    });
});
