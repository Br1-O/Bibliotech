/**
* Project     : Bibliotech  |  Frontend - Componentes
* Tarjetas y tablas reutilizables: material, materia y listas.
*/

const Cards = {
    typeBadge(tipo) {
        const map = { PDF: 'danger', Word: 'info', Presentacion: 'warning', Link_Drive: 'success', Youtube: 'danger' };
        return el('span', { className: `bt-badge bt-badge--${map[tipo] || 'info'}`, text: LanguageManager.t(`material.types.${tipo}`) });
    },

    stateBadge(estado) {
        const map = { Aprobado: 'success', Pendiente: 'warning', Cancelado: 'danger' };
        return el('span', { className: `bt-badge bt-badge--${map[estado] || 'info'}`, text: LanguageManager.t(`material.states.${estado}`) });
    },

    chips(items) {
        return (items || []).map(c => el('span', { className: 'bt-chip', text: c }));
    },

    /** Boton "+ info" que muestra la descripcion del material en un aviso. */
    infoButton(material) {
        const btn = el('button', {
            className: 'bt-btn bt-btn--ghost bt-btn--sm',
            text: `+ ${LanguageManager.t('material.info')}`,
            attrs: { type: 'button' }
        });
        btn.addEventListener('click', () => Modal.alert(material.titulo, material.descripcion));
        return btn;
    },

    /** Estrella para agregar/quitar el material de favoritos (toggle). */
    favoriteButton(material, onToggle) {
        const activeLabel = () => Number(material.esFavorito) === 1;
        const label = () => LanguageManager.t(activeLabel() ? 'material.removeFavorite' : 'material.addFavorite');
        const active = activeLabel();

        const btn = el('button', {
            className: `bt-fav-btn${active ? ' is-active' : ''}`,
            text: active ? '★' : '☆',
            attrs: {
                type: 'button',
                title: label(),
                'aria-label': label(),
                'aria-pressed': active ? 'true' : 'false'
            }
        });
        btn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            btn.disabled = true;
            try {
                const result = await onToggle(material);
                const nowActive = result && typeof result.favorited === 'boolean'
                    ? result.favorited
                    : !activeLabel();
                material.esFavorito = nowActive ? 1 : 0;
                btn.textContent = nowActive ? '★' : '☆';
                btn.classList.toggle('is-active', nowActive);
                btn.setAttribute('aria-pressed', nowActive ? 'true' : 'false');
                btn.title = label();
                btn.setAttribute('aria-label', label());
            } finally {
                btn.disabled = false;
            }
        });
        return btn;
    },

    /** Alterna el material en la lista de favoritos del usuario autenticado. */
    async toggleFavorite(material) {
        const result = await apiService.post(`/materials/${material.id}/favorite`, {});
        Toast.success(LanguageManager.t(result.favorited ? 'messages.favoriteAdded' : 'messages.favoriteRemoved'));
        return result;
    },

    material(material, options = {}) {
        const isFile = String(material.urlOrPath).startsWith('/uploads/');
        const link = material.urlOrPath;

        const meta = el('div', { className: 'bt-card__meta bt-row', style: { gap: 'var(--space-2)' } }, [
            this.typeBadge(material.tipo),
            el('span', { text: material.autorNombre ? `· ${material.autorNombre}` : '' })
        ]);

        const body = el('div', { className: 'bt-card__body bt-stack', style: { gap: 'var(--space-3)' } }, [
            el('h3', { className: 'bt-card__title', text: material.titulo }),
            meta,
            el('div', { className: 'bt-row', style: { gap: '6px' } }, this.chips(material.materias)),
            el('div', { className: 'bt-row', style: { gap: '6px' } }, this.chips(material.categories))
        ]);

        const actions = [
            options.onToggleFavorite ? this.favoriteButton(material, options.onToggleFavorite) : null,
            isFile
                ? el('a', { className: 'bt-btn bt-btn--secondary bt-btn--sm', text: LanguageManager.t('common.download'), attrs: { href: link, download: '', target: '_blank', rel: 'noopener' } })
                : el('a', { className: 'bt-btn bt-btn--secondary bt-btn--sm', text: LanguageManager.t('common.open'), attrs: { href: link, target: '_blank', rel: 'noopener' } }),
            material.descripcion ? this.infoButton(material) : null,
            options.onCancel ? el('bt-button', {
                size: 'sm', variant: 'accent', label: LanguageManager.t('material.cancel'),
                on: { click: () => options.onCancel(material) }
            }) : null,
            options.onEdit ? el('bt-button', {
                size: 'sm', variant: 'accent', label: LanguageManager.t('common.edit'),
                on: { click: () => options.onEdit(material) }
            }) : null,
            options.onDelete
                ? el('bt-button', {
                    variant: 'danger', size: 'sm',
                    label: LanguageManager.t(options.deleteLabel || 'common.delete'),
                    on: { click: () => options.onDelete(material) }
                })
                : null
        ];

        const footer = el('div', { className: 'bt-card__footer bt-between bt-row' }, [
            options.showState ? this.stateBadge(material.estado) : el('span'),
            el('div', { className: 'bt-row', style: { gap: 'var(--space-2)' } }, actions.filter(Boolean))
        ]);

        return el('article', { className: 'bt-card bt-card--interactive' }, [body, footer]);
    },

    /** Tarjeta de materia (categoria de agrupacion). */
    subject(subject, options = {}) {
        const teacher = subject.profesorNombre || LanguageManager.t('subject.noTeacher');
        const isTeacher = Boolean(subject.profesorNombre);

        const actions = [];
        if (!options.hideViewMaterials) {
            actions.push(el('a', {
                className: 'bt-btn bt-btn--secondary bt-btn--sm',
                text: LanguageManager.t('subjects.viewMaterials'),
                attrs: { href: `/materia/${subject.id}` }
            }));
        }
        if (options.subscribeButton) actions.push(options.subscribeButton);
        if (options.editButton) actions.push(options.editButton);

        const footer = el('div', { className: 'bt-card__footer bt-between bt-row' }, [
            el('span', { className: 'bt-card__meta', text: `${subject.totalMateriales ?? 0} ${LanguageManager.t('subjects.viewMaterials').toLowerCase()}` }),
            el('div', { className: 'bt-row', style: { gap: 'var(--space-2)' } }, actions)
        ]);

        return el('div', { className: 'bt-card bt-card--interactive' }, [
            el('div', { className: 'bt-card__body bt-stack', style: { gap: 'var(--space-3)' } }, [
                el('div', { className: 'bt-row', style: { gap: 'var(--space-2)' } }, [
                    el('span', { className: 'bt-badge bt-badge--subject', text: LanguageManager.t('subject.badge') })
                ]),
                el('h3', { className: 'bt-card__title', text: subject.nombre }),
                el('p', { className: 'bt-card__meta', text: subject.descripcion || '' }),
                el('span', {
                    className: `bt-badge ${isTeacher ? 'bt-badge--teacher' : 'bt-badge--info'}`,
                    text: isTeacher ? `${LanguageManager.t('subject.teacher')}: ${teacher}` : teacher
                })
            ]),
            footer
        ]);
    },

    empty(message) {
        return el('div', { className: 'bt-empty' }, [
            el('h3', { text: message })
        ]);
    }
};
