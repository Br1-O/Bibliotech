/**
* Project     : Bibliotech  |  Frontend - Componentes
* Tarjetas y tablas reutilizables: material, materia y listas.
*/

const Cards = {
    TYPE_TONES: {
        PDF: 'danger', EPUB: 'info', Word: 'info', Presentacion: 'warning',
        Link_Drive: 'success', Youtube: 'danger', Repositorio: 'subject'
    },

    typeBadge(tipo) {
        return el('a', {
            className: `bt-badge bt-badge--${this.TYPE_TONES[tipo] || 'info'}`,
            text: LanguageManager.t(`material.types.${tipo}`),
            attrs: { href: `/catalogo?tipo=${encodeURIComponent(tipo)}#catalogo`, title: LanguageManager.t('catalog.filterByType') }
        });
    },

    isInactive(material) {
        return ['Cancelado', 'Rechazado'].includes(String(material?.estado || ''));
    },

    stateBadge(estado) {
        const map = { Aprobado: 'success', Pendiente: 'warning', Cancelado: 'danger', Rechazado: 'danger' };
        return el('span', { className: `bt-badge bt-badge--${map[estado] || 'info'}`, text: LanguageManager.t(`material.states.${estado}`) });
    },

    chips(items) {
        return (items || []).map(c => el('span', { className: 'bt-chip', text: c }));
    },

    tagChips(items) {
        return (items || []).map(c => el('a', {
            className: 'bt-chip bt-chip--tag',
            text: c,
            attrs: { href: `/catalogo?tags=${encodeURIComponent(c)}#catalogo` }
        }));
    },

    subjectChips(material) {
        const details = material.materiasDetalle?.length
            ? material.materiasDetalle
            : (material.materias || []).map((name, index) => ({
                id: (material.materiasIds || [])[index],
                nombre: name,
                carreraColor: null
            }));
        return details.map(subject => subject.id
            ? el('a', {
                className: 'bt-chip bt-chip--subject',
                text: subject.nombre,
                attrs: {
                    href: `/materia/${subject.id}`,
                    ...(subject.carreraColor ? { style: `--career-color:${subject.carreraColor}` } : {})
                }
            })
            : el('span', { className: 'bt-chip bt-chip--subject', text: subject.nombre }));
    },

    careerChips(material) {
        return (material.carreras || []).map(career => el('a', {
            className: 'bt-chip bt-chip--career',
            text: career.anioNombre ? `${career.nombre} · ${career.anioNombre}` : career.nombre,
            attrs: {
                href: career.anioId
                    ? `/materias?career=${career.id}&year=${career.anioId}#materias`
                    : `/materias?career=${career.id}#materias`,
                style: `--career-color:${career.color || '#6f5bd3'}`
            }
        }));
    },

    /** Contenido enriquecido del modal +info: materias, carreras y etiquetas. */
    materialInfoContent(material) {
        const careers = this.careerChips(material);
        const subjects = this.subjectChips(material);
        const tags = this.tagChips(material.categories);
        const section = (labelKey, nodes) => nodes.length
            ? el('div', { className: 'bt-material-info__group' }, [
                el('h4', { className: 'bt-material-info__label', text: LanguageManager.t(labelKey) }),
                el('div', { className: 'bt-material-info__tags' }, nodes)
            ])
            : null;

        const hasAssociations = careers.length || subjects.length;
        return el('div', { className: 'bt-material-info' }, [
            el('section', { className: 'bt-material-info__associations' }, [
                el('h4', { className: 'bt-material-info__title', text: LanguageManager.t('material.associations') }),
                hasAssociations
                    ? el('div', { className: 'bt-material-info__groups' }, [
                        section('material.associatedCareers', careers),
                        section('material.associatedSubjects', subjects)
                    ].filter(Boolean))
                    : el('p', {
                        className: 'bt-material-info__empty',
                        text: LanguageManager.t('material.noAssociations')
                    })
            ]),
            section('material.tags', tags)
        ]);
    },

    coverFile(tipo) {
        const names = {
            PDF: 'pdf-cover.png',
            EPUB: 'epub-cover.png',
            Word: 'word-cover.png',
            Presentacion: 'presentacion-cover.png',
            Link_Drive: 'drive-cover.png',
            Youtube: 'youtube-cover.png',
            Repositorio: 'repositorio-cover.png'
        };
        return `/img/${names[tipo] || 'material-cover.png'}`;
    },

    cover(material) {
        const wrap = el('div', { className: 'bt-card__cover' });
        const fallback = el('div', { className: 'bt-card__cover-fallback' }, [
            el('span', { className: 'bt-card__cover-type', text: LanguageManager.t(`material.types.${material.tipo}`) }),
            el('span', { className: 'bt-card__cover-title', text: material.titulo })
        ]);
        const img = el('img', {
            className: 'bt-card__cover-img',
            attrs: {
                src: material.portada || this.coverFile(material.tipo),
                alt: '',
                loading: 'lazy'
            }
        });
        img.addEventListener('error', () => {
            if (!img.isConnected) return;
            img.remove();
            wrap.classList.add('is-fallback');
            wrap.appendChild(fallback);
        }, { once: true });
        wrap.appendChild(img);
        return wrap;
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

    /** Boton "+ info" con descripcion y todas las asociaciones del material. */
    infoButton(material) {
        const btn = el('button', {
            className: 'bt-btn bt-btn--ghost bt-btn--sm',
            text: `+ ${LanguageManager.t('material.info')}`,
            attrs: { type: 'button', 'aria-haspopup': 'dialog' }
        });
        btn.addEventListener('click', () => {
            Modal.info({
                title: material.titulo,
                description: material.descripcion || LanguageManager.t('material.noDescription'),
                content: this.materialInfoContent(material)
            });
        });
        return btn;
    },

    addToSubjectsButton(material, onSuccess) {
        if (this.isInactive(material)) return null;
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
                    this.isSubjectProfessor(subject, me.id));
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
        return !['Link_Drive', 'Youtube', 'Repositorio'].includes(tipo)
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
        const inactive = this.isInactive(material);
        const link = inactive ? '' : (typeof MaterialViewer !== 'undefined'
            ? MaterialViewer.safeHref(material.urlOrPath)
            : String(material.urlOrPath || ''));
        const isFile = !inactive && this.isFileMaterial(material);
        const upload = this.uploadInfo(material.createdAt);

        const author = material.autorNombre
            ? el('a', {
                className: 'bt-card__author',
                text: `· ${material.autorNombre}`,
                attrs: { href: `/autor/${material.autorId}` }
            })
            : null;
        const meta = el('div', { className: 'bt-card__meta bt-row', style: { gap: 'var(--space-2)' } }, [
            upload.isNew
                ? el('span', { className: 'bt-badge bt-badge--new', text: LanguageManager.t('material.new') })
                : null,
            this.typeBadge(material.tipo),
            author
        ]);
        const favorite = options.onToggleFavorite ? this.favoriteButton(material, options.onToggleFavorite) : null;

        const body = el('div', { className: 'bt-card__body bt-stack', style: { gap: 'var(--space-3)' } }, [
            el('div', { className: 'bt-card__top' }, [meta, favorite || el('span')]),
            el('h3', { className: 'bt-card__title', text: material.titulo }),
            upload.node
        ]);

        const actions = [
            link ? this.openButton(material, link) : null,
            isFile && link ? this.downloadButton(material) : null,
            this.addToSubjectsButton(material, null),
            this.infoButton(material),
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
                : null,
            options.onAdminDelete
                ? this.trashButton(material, options.onAdminDelete)
                : null
        ];

        const footer = el('div', { className: 'bt-card__footer bt-between bt-row' }, [
            options.showState ? this.stateBadge(material.estado) : el('span'),
            el('div', { className: 'bt-row', style: { gap: 'var(--space-2)' } }, actions.filter(Boolean))
        ]);

        return el('article', {
            className: `bt-card bt-card--interactive bt-card--material${inactive ? ' bt-card--disabled' : ''}`,
            attrs: { 'data-type': material.tipo, ...(inactive ? { 'aria-disabled': 'true' } : {}) }
        }, [
            this.cover(material),
            body,
            footer
        ]);
    },

    trashButton(material, onDelete) {
        const btn = el('button', {
            className: 'bt-icon-btn bt-icon-btn--danger',
            attrs: {
                type: 'button',
                title: LanguageManager.t('material.deleteGlobal'),
                'aria-label': LanguageManager.t('material.deleteGlobal')
            }
        });
        btn.appendChild(typeof Icons !== 'undefined' ? Icons.trash() : document.createTextNode('×'));
        btn.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            onDelete(material);
        });
        return btn;
    },

    isSubjectProfessor(subject, userId) {
        if (!subject || !userId) return false;
        if (Array.isArray(subject.profesores) && subject.profesores.length) {
            return subject.profesores.some(professor => String(professor.id) === String(userId));
        }
        return String(subject.profesorId) === String(userId);
    },

    /** Tarjeta de materia (categoria de agrupacion). */
    subject(subject, options = {}) {
        const professors = Array.isArray(subject.profesores) && subject.profesores.length
            ? subject.profesores
            : (subject.profesorNombre
                ? [{ id: subject.profesorId, nombreCompleto: subject.profesorNombre }]
                : []);

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

        const group = [];
        if (subject.carreraNombre) {
            group.push(el('a', {
                className: 'bt-chip bt-chip--career',
                text: subject.carreraNombre,
                attrs: {
                    href: `/materias?career=${subject.carreraId}#materias`,
                    style: `--career-color:${subject.carreraColor || '#6f5bd3'}`
                }
            }));
        }
        if (subject.anioNombre) {
            group.push(el('a', {
                className: 'bt-chip bt-chip--year',
                text: subject.anioNombre,
                attrs: { href: `/materias?career=${subject.carreraId}&year=${subject.anioId}#materias` }
            }));
        }

        const teacherRow = professors.length
            ? el('div', { className: 'bt-card__teachers' }, [
                el('span', { className: 'bt-card__meta', text: LanguageManager.t('subjects.teachers') + ':' }),
                ...professors.map(professor => el('a', {
                    className: 'bt-teacher-link',
                    text: professor.nombreCompleto || `${professor.nombre || ''} ${professor.apellido || ''}`.trim(),
                    attrs: { href: `/autor/${professor.id}` }
                }))
            ])
            : el('span', {
                className: 'bt-badge bt-badge--info',
                text: LanguageManager.t('subject.noTeacher')
            });

        return el('div', {
            className: 'bt-card bt-card--interactive bt-card--subject',
            attrs: subject.carreraColor ? { style: `--career-color:${subject.carreraColor}` } : {}
        }, [
            el('div', { className: 'bt-card__body bt-stack', style: { gap: 'var(--space-3)' } }, [
                el('div', { className: 'bt-row', style: { gap: 'var(--space-2)' } }, [
                    el('span', { className: 'bt-badge bt-badge--subject', text: LanguageManager.t('subjects.badge') }),
                    ...group
                ]),
                el('h3', { className: 'bt-card__title', text: subject.nombre }),
                el('p', { className: 'bt-card__meta', text: subject.descripcion || '' }),
                teacherRow
            ]),
            footer
        ]);
    },

    career(career, options = {}) {
        const selected = options.selected ? ' is-selected' : '';
        const btn = el('button', {
            className: `bt-career-card${selected}`,
            attrs: {
                type: 'button',
                style: `--career-color:${career.color || '#6f5bd3'}`,
                'aria-pressed': options.selected ? 'true' : 'false'
            }
        }, [
            el('span', { className: 'bt-career-card__dot' }),
            el('span', { className: 'bt-career-card__body' }, [
                el('strong', { text: career.nombre }),
                el('span', {
                    text: LanguageManager.t('careers.summary', {
                        subjects: Number(career.totalMaterias || 0),
                        years: (career.years || []).length
                    })
                })
            ])
        ]);
        btn.addEventListener('click', () => options.onSelect && options.onSelect(career));
        return btn;
    },

    year(year, options = {}) {
        const btn = el('button', {
            className: `bt-chip bt-chip--year${options.selected ? ' is-selected' : ''}`,
            text: year.nombre,
            attrs: { type: 'button', 'aria-pressed': options.selected ? 'true' : 'false' }
        });
        btn.addEventListener('click', () => options.onSelect && options.onSelect(year));
        return btn;
    },

    empty(message) {
        const children = [];
        if (typeof Icons !== 'undefined') children.push(el('span', { className: 'bt-empty__icon' }, [Icons.book()]));
        children.push(el('h3', { text: message }));
        return el('div', { className: 'bt-empty' }, children);
    }
};
