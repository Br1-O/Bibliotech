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

    tagChips(items) {
        return (items || []).map(c => el('span', { className: 'bt-chip bt-chip--tag', text: c }));
    },

    uploadInfo(value) {
        const date = new Date(value);
        if (!value || Number.isNaN(date.getTime())) return { isNew: false, node: null };

        const locale = LanguageManager.language === 'en' ? 'en-US' : 'es-ES';
        const formatted = new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).format(date);

        const children = [];
        if (typeof Icons !== 'undefined') children.push(Icons.clock());
        children.push(el('span', { text: LanguageManager.t('material.uploadedOn', { date: formatted }) }));

        return {
            isNew: Date.now() - date.getTime() < 7 * 24 * 60 * 60 * 1000,
            node: el('time', {
                className: 'bt-card__date',
                attrs: { datetime: date.toISOString() }
            }, children)
        };
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

    addToSubjectsButton(material, onSuccess) {
        if (typeof authHelper === 'undefined' || !authHelper.isRole('Profesor')) return null;

        const btn = el('button', {
            className: 'bt-btn bt-btn--secondary bt-btn--sm',
            text: LanguageManager.t('material.addToSubjects'),
            attrs: { type: 'button', 'aria-haspopup': 'dialog' }
        });

        btn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            btn.disabled = true;
            try {
                const me = authHelper.getUser() || {};
                const { subjects } = await apiService.get('/subjects');
                const owned = (subjects || []).filter(subject =>
                    String(subject.profesorId) === String(me.id));
                this.openAddToSubjectsModal(material, owned, onSuccess);
            } catch (error) {
                Toast.error(error.message);
            } finally {
                btn.disabled = false;
            }
        });

        return btn;
    },

    openAddToSubjectsModal(material, ownedSubjects, onSuccess) {
        if (typeof authHelper === 'undefined' || !authHelper.isRole('Profesor')) return;

        const linkedIds = new Set((material.materiasIds || []).map(Number));
        const owned = Array.isArray(ownedSubjects) ? ownedSubjects : [];
        const available = owned
            .filter(subject => !linkedIds.has(Number(subject.id)))
            .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
        const selected = new Map();
        let saving = false;
        let closed = false;
        let subjectSelect = null;
        let previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;

        const titleId = 'btAssociateTitle';
        const hintId = 'btAssociateHint';
        const selectId = 'btAssociateSubject';
        const dialog = el('div', {
            className: 'bt-modal bt-associate-modal',
            attrs: {
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': titleId,
                'aria-describedby': hintId
            }
        });

        const closeBtn = el('button', {
            className: 'bt-modal__close',
            attrs: { type: 'button', 'aria-label': LanguageManager.t('common.close') }
        });
        closeBtn.appendChild(typeof Icons !== 'undefined' ? Icons.close() : document.createTextNode('×'));

        const header = el('div', { className: 'bt-associate__head' }, [
            el('div', {}, [
                el('h3', { className: 'bt-modal__title', id: titleId, text: LanguageManager.t('material.addToSubjectsTitle') }),
                el('p', { className: 'bt-associate__hint', id: hintId, text: LanguageManager.t('material.addToSubjectsHint') })
            ]),
            closeBtn
        ]);

        const body = el('div', { className: 'bt-associate__body bt-stack' }, [
            el('div', { className: 'bt-associate__material' }, [
                el('span', { className: 'bt-associate__material-label', text: LanguageManager.t('material.addToSubjectsMaterial') }),
                el('strong', { text: material.titulo })
            ])
        ]);

        const footer = el('div', { className: 'bt-modal__footer' });
        const cancelBtn = el('button', {
            className: 'bt-btn bt-btn--ghost',
            text: LanguageManager.t('common.cancel'),
            attrs: { type: 'button' }
        });
        const confirmBtn = el('button', {
            className: 'bt-btn',
            text: LanguageManager.t('material.associateConfirm'),
            attrs: { type: 'button', disabled: '' }
        });
        footer.append(cancelBtn, confirmBtn);

        let refreshSelection = () => {};

        if (!owned.length) {
            body.appendChild(el('p', {
                className: 'bt-associate__notice',
                text: LanguageManager.t('teacher.noSubjects')
            }));
        } else if (!available.length) {
            body.appendChild(el('p', {
                className: 'bt-associate__notice',
                text: LanguageManager.t('material.alreadyInAllSubjects')
            }));
        } else {
            const select = el('select', {
                className: 'bt-select',
                id: selectId,
                attrs: { 'aria-describedby': hintId }
            });
            const selectedHeader = el('span', { className: 'bt-associate__selected-head' });
            const chipList = el('div', { className: 'bt-associate__chips', attrs: { 'aria-live': 'polite' } });
            const empty = el('p', {
                className: 'bt-associate__empty',
                text: LanguageManager.t('material.noSelection')
            });

            const refreshOptions = () => {
                const remaining = available.filter(subject => !selected.has(Number(subject.id)));
                const placeholder = remaining.length
                    ? LanguageManager.t('material.addToSubjectsPlaceholder')
                    : LanguageManager.t('material.allSubjectsSelected');
                render(select, [
                    el('option', { value: '', text: placeholder, attrs: { disabled: '', selected: '' } }),
                    ...remaining.map(subject => el('option', { value: String(subject.id), text: subject.nombre }))
                ]);
                select.value = '';
                select.disabled = remaining.length === 0;
            };

            refreshSelection = () => {
                selectedHeader.textContent = LanguageManager.t('material.selectedSubjects', { count: selected.size });
                render(chipList, [...selected.values()].map(subject => {
                    const removeBtn = el('button', {
                        attrs: {
                            type: 'button',
                            'aria-label': LanguageManager.t('material.removeSubject', { name: subject.nombre })
                        }
                    });
                    removeBtn.appendChild(typeof Icons !== 'undefined' ? Icons.close() : document.createTextNode('×'));
                    removeBtn.addEventListener('click', () => {
                        if (saving) return;
                        selected.delete(Number(subject.id));
                        refreshOptions();
                        refreshSelection();
                        select.focus();
                    });
                    return el('span', { className: 'bt-associate__chip' }, [
                        el('span', { text: subject.nombre }),
                        removeBtn
                    ]);
                }));
                chipList.classList.toggle('bt-hidden', selected.size === 0);
                empty.classList.toggle('bt-hidden', selected.size > 0);
                confirmBtn.disabled = selected.size === 0;
            };

            select.addEventListener('change', () => {
                if (saving) return;
                const subject = available.find(item => String(item.id) === select.value);
                if (!subject) return;
                selected.set(Number(subject.id), subject);
                refreshOptions();
                refreshSelection();
                select.focus();
            });

            body.append(
                el('div', { className: 'bt-associate__field' }, [
                    el('label', {
                        className: 'bt-label',
                        attrs: { for: selectId },
                        text: LanguageManager.t('material.subjects')
                    }),
                    select
                ]),
                el('div', { className: 'bt-associate__selected' }, [
                    selectedHeader,
                    empty,
                    chipList
                ])
            );

            refreshOptions();
            refreshSelection();
            subjectSelect = select;
        }

        const content = el('div', { className: 'bt-modal__content', attrs: { role: 'document' } }, [
            header,
            body,
            footer
        ]);
        dialog.appendChild(content);

        function close(force = false) {
            if (closed || (saving && !force)) return;
            closed = true;
            document.removeEventListener('keydown', onKeydown);
            dialog.remove();
            document.body.style.overflow = previousOverflow;
            if (previousFocus && previousFocus.isConnected) previousFocus.focus();
        }

        function focusable() {
            return [...dialog.querySelectorAll('button, select, a[href], input, [tabindex]:not([tabindex="-1"])')]
                .filter(node => !node.disabled && !node.closest('.bt-hidden'));
        }

        function onKeydown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
                return;
            }
            if (event.key !== 'Tab') return;
            const nodes = focusable();
            if (!nodes.length) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        closeBtn.addEventListener('click', () => close());
        cancelBtn.addEventListener('click', () => close());
        dialog.addEventListener('click', event => {
            if (event.target === dialog) close();
        });
        confirmBtn.addEventListener('click', async () => {
            if (!selected.size || saving) return;
            saving = true;
            confirmBtn.disabled = true;
            confirmBtn.classList.add('bt-btn--loading');
            const ids = [...selected.keys()];

            try {
                const result = await apiService.post(`/materials/${material.id}/associate`, { subjectIds: ids });
                const added = [...selected.values()];
                material.materiasIds = [...new Set([...(material.materiasIds || []).map(Number), ...ids])];
                material.materias = [...(material.materias || []), ...added.map(subject => subject.nombre)];
                Toast.success(ids.length === 1
                    ? LanguageManager.tr(result.message)
                    : LanguageManager.t('messages.materialAssociatedMany', { count: ids.length }));
                if (typeof onSuccess === 'function') onSuccess(added);
                close(true);
            } catch (error) {
                Toast.error(error.message);
            } finally {
                saving = false;
                confirmBtn.disabled = selected.size === 0;
                confirmBtn.classList.remove('bt-btn--loading');
            }
        });

        document.body.style.overflow = 'hidden';
        document.body.appendChild(dialog);
        dialog.setAttribute('open', '');
        document.addEventListener('keydown', onKeydown);
        if (subjectSelect && !subjectSelect.disabled) subjectSelect.focus();
        else closeBtn.focus();
    },

    /** Estrella con contador para agregar/quitar el material de favoritos. */
    favoriteButton(material, onToggle) {
        const activeLabel = () => Number(material.esFavorito) === 1;
        const label = () => LanguageManager.t(activeLabel() ? 'material.removeFavorite' : 'material.addFavorite');
        const active = activeLabel();
        const total = Number(material.contadorFavoritos || 0);

        const icon = (filled) => (typeof Icons !== 'undefined' ? (filled ? Icons.starFilled() : Icons.star()) : (filled ? '★' : '☆'));
        const btn = el('button', {
            className: `bt-fav-btn${active ? ' is-active' : ''}`,
            attrs: {
                type: 'button',
                title: label(),
                'aria-label': label(),
                'aria-pressed': active ? 'true' : 'false'
            }
        });
        btn.appendChild(icon(active));
        const count = el('span', { className: 'bt-fav__count', text: String(total) });
        const wrap = el('div', { className: 'bt-fav' }, [btn, count]);

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
                if (result && result.contadorFavoritos !== undefined) {
                    material.contadorFavoritos = Number(result.contadorFavoritos);
                } else {
                    material.contadorFavoritos = Math.max(0, Number(material.contadorFavoritos || 0) + (nowActive ? 1 : -1));
                }
                btn.replaceChildren(icon(nowActive));
                btn.classList.toggle('is-active', nowActive);
                btn.setAttribute('aria-pressed', nowActive ? 'true' : 'false');
                btn.title = label();
                btn.setAttribute('aria-label', label());
                count.textContent = String(material.contadorFavoritos);
            } catch (error) {
                Toast.error(error.message);
            } finally {
                btn.disabled = false;
            }
        });
        return wrap;
    },

    /** Alterna el material en la lista de favoritos del usuario autenticado. */
    async toggleFavorite(material) {
        const result = await apiService.post(`/materials/${material.id}/favorite`, {});
        Toast.success(LanguageManager.t(result.favorited ? 'messages.favoriteAdded' : 'messages.favoriteRemoved'));
        return result;
    },

    isFileMaterial(material) {
        const tipo = String(material.tipo || '');
        const link = String(material.urlOrPath || '');
        return !['Link_Drive', 'Youtube'].includes(tipo)
            || link.startsWith('/uploads/')
            || /res\.cloudinary\.com\//i.test(link);
    },

    openButton(material, link) {
        const anchor = el('a', {
            className: 'bt-btn bt-btn--secondary bt-btn--sm',
            text: LanguageManager.t('common.open'),
            attrs: { href: link, target: '_blank', rel: 'noopener' }
        });
        const hasViewer = typeof MaterialViewer !== 'undefined'
            && (MaterialViewer.isPdf(material) || MaterialViewer.isYoutube(material));
        if (!hasViewer) return anchor;

        anchor.addEventListener('click', event => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            MaterialViewer.open(material);
        });
        return anchor;
    },

    downloadButton(material) {
        if (typeof MaterialViewer !== 'undefined') {
            return MaterialViewer.downloadButton(material, 'bt-btn bt-btn--secondary bt-btn--sm');
        }
        return el('a', {
            className: 'bt-btn bt-btn--secondary bt-btn--sm',
            text: LanguageManager.t('common.download'),
            attrs: { href: material.urlOrPath, download: '', target: '_blank', rel: 'noopener' }
        });
    },

    material(material, options = {}) {
        const link = typeof MaterialViewer !== 'undefined'
            ? MaterialViewer.safeHref(material.urlOrPath)
            : String(material.urlOrPath || '');
        const isFile = this.isFileMaterial(material);
        const upload = this.uploadInfo(material.createdAt);

        const meta = el('div', { className: 'bt-card__meta bt-row', style: { gap: 'var(--space-2)' } }, [
            upload.isNew
                ? el('span', { className: 'bt-badge bt-badge--new', text: LanguageManager.t('material.new') })
                : null,
            this.typeBadge(material.tipo),
            el('span', { text: material.autorNombre ? `· ${material.autorNombre}` : '' })
        ]);
        const favorite = options.onToggleFavorite ? this.favoriteButton(material, options.onToggleFavorite) : null;
        const subjectChips = el('div', { className: 'bt-row', style: { gap: '6px' } }, this.chips(material.materias));

        const body = el('div', { className: 'bt-card__body bt-stack', style: { gap: 'var(--space-3)' } }, [
            el('div', { className: 'bt-card__top' }, [meta, favorite || el('span')]),
            el('h3', { className: 'bt-card__title', text: material.titulo }),
            upload.node,
            subjectChips,
            el('div', { className: 'bt-row', style: { gap: '6px' } }, this.tagChips(material.categories))
        ]);

        const actions = [
            link ? this.openButton(material, link) : null,
            isFile && link ? this.downloadButton(material) : null,
            this.addToSubjectsButton(material, () => render(subjectChips, this.chips(material.materias))),
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
            el('span', { className: 'bt-card__meta', text: LanguageManager.t('subjects.materialCount', { count: subject.totalMateriales ?? 0 }) }),
            el('div', { className: 'bt-row', style: { gap: 'var(--space-2)' } }, actions)
        ]);

        return el('div', { className: 'bt-card bt-card--interactive' }, [
            el('div', { className: 'bt-card__body bt-stack', style: { gap: 'var(--space-3)' } }, [
                el('div', { className: 'bt-row', style: { gap: 'var(--space-2)' } }, [
                    el('span', { className: 'bt-badge bt-badge--subject', text: LanguageManager.t('subjects.badge') })
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
        const children = [];
        if (typeof Icons !== 'undefined') children.push(el('span', { className: 'bt-empty__icon' }, [Icons.book()]));
        children.push(el('h3', { text: message }));
        return el('div', { className: 'bt-empty' }, children);
    }
};
