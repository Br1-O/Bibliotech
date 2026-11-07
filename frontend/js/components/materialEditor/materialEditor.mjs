/**
* Project     : Bibliotech  |  Frontend - Componente
* MaterialEditor: dialogo seguro para editar todos los datos del material.
*/
import { attachTagInput } from '../tagInput/tagInput.mjs';
import { LanguageManager } from '../../i18n/LanguageManager.mjs';
import { apiService } from '../../services/apiService.mjs';
import { el } from '../../utils/dom.mjs';
import { Icons } from '../icons/icons.mjs';
import { MaterialViewer } from '../materialViewer/materialViewer.mjs';
import { Toast } from '../toast/toast.mjs';


const MaterialEditor = {
    open(material, onSaved, options = {}) {
        if (!material) return;
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        const materialTypes = ['PDF', 'EPUB', 'Word', 'Presentacion', 'Link_Drive', 'Youtube', 'Repositorio'];
        const linkTypes = ['Link_Drive', 'Youtube', 'Repositorio'];
        const categorySlugs = [
            'fiction', 'literature', 'poetry', 'drama', 'technical', 'science', 'business',
            'education', 'medicine', 'law', 'non-fiction', 'self-help', 'biography', 'history',
            'philosophy', 'religion', 'arts', 'hobbies', 'travel', 'sports', 'cooking', 'kids',
            'young-adult'
        ];
        const acceptByType = {
            PDF: '.pdf,application/pdf',
            EPUB: '.epub,application/epub+zip',
            Word: '.doc,.docx',
            Presentacion: '.ppt,.pptx,.odp'
        };
        const currentIsFile = !linkTypes.includes(material.tipo);
        const categories = Array.isArray(material.categories)
            ? material.categories
            : String(material.categories || '').split(',').map(value => value.trim()).filter(Boolean);
        let saving = false;
        let closed = false;
        let tagsControl = null;

        const safeHref = value => {
            try {
                const url = new URL(String(value || ''), window.location.origin);
                return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
            } catch (error) {
                return '';
            }
        };
        const fileName = value => {
            const raw = String(value || '').split(/[?#]/)[0].split('/').pop() || '';
            try { return decodeURIComponent(raw); } catch (error) { return raw; }
        };

        const titleId = 'btMaterialEditTitle';
        const dialog = el('div', {
            className: 'bt-modal bt-modal--rich',
            attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId }
        });
        const closeBtn = el('button', {
            className: 'bt-modal__close',
            attrs: { type: 'button', 'aria-label': LanguageManager.t('common.close') }
        });
        closeBtn.appendChild(typeof Icons !== 'undefined' ? Icons.close() : document.createTextNode('×'));

        const titleInput = el('input', {
            className: 'bt-input',
            attrs: { type: 'text', id: 'btMaterialTitleInput', maxlength: '150' },
            value: material.titulo || ''
        });
        const descInput = el('textarea', {
            className: 'bt-textarea',
            attrs: { id: 'btMaterialDescInput', rows: '4', placeholder: LanguageManager.t('material.descriptionPlaceholder') },
            value: material.descripcion || ''
        });
        const typeSelect = el('select', {
            className: 'bt-select',
            attrs: { id: 'btMaterialTypeInput' }
        }, materialTypes.map(value => el('option', {
            value,
            text: LanguageManager.t(`material.types.${value}`)
        })));
        typeSelect.value = material.tipo || 'PDF';

        const authorInput = el('input', {
            className: 'bt-input',
            attrs: { type: 'text', id: 'btMaterialAuthorInput', maxlength: '150', placeholder: LanguageManager.t('material.authorPlaceholder') },
            value: material.author || ''
        });
        const categorySelect = el('select', {
            className: 'bt-select',
            attrs: { id: 'btMaterialCategoryInput' }
        }, categorySlugs.map(slug => el('option', {
            value: slug,
            text: LanguageManager.t(`material.categories.${slug}`)
        })));
        categorySelect.value = material.categorySlug || 'technical';
        const pagesInput = el('input', {
            className: 'bt-input',
            attrs: { type: 'number', min: '1', step: '1', id: 'btMaterialPagesInput', placeholder: LanguageManager.t('material.pagesPlaceholder') },
            value: material.pages || ''
        });
        const mandatoryInput = el('input', {
            attrs: { type: 'checkbox', id: 'btMaterialMandatoryInput' }
        });
        mandatoryInput.checked = Boolean(material.isMandatory);
        const mandatoryLabel = el('label', { className: 'bt-check', attrs: { for: 'btMaterialMandatoryInput' } }, [
            mandatoryInput,
            el('span', { text: LanguageManager.t('material.mandatory') })
        ]);

        const fileInput = el('input', {
            className: 'bt-input',
            attrs: { type: 'file', id: 'btMaterialFileInput' }
        });
        const urlInput = el('input', {
            className: 'bt-input',
            attrs: {
                type: 'url',
                id: 'btMaterialUrlInput',
                placeholder: LanguageManager.t('material.linkPlaceholder'),
                inputmode: 'url'
            },
            value: linkTypes.includes(material.tipo) ? (material.urlOrPath || '') : ''
        });
        const coverInput = el('input', {
            className: 'bt-input',
            attrs: { type: 'file', id: 'btMaterialCoverInput', accept: 'image/jpeg,image/png,image/webp,image/gif' }
        });
        const tagsInput = el('input', {
            className: 'bt-input',
            attrs: {
                type: 'text',
                id: 'btMaterialTagsInput',
                placeholder: LanguageManager.t('material.tagsPlaceholder')
            },
            value: categories.join(', ')
        });
        const removeCoverInput = el('input', { attrs: { type: 'checkbox', id: 'btMaterialRemoveCover' } });
        const removeCoverLabel = el('label', { className: 'bt-check', attrs: { for: 'btMaterialRemoveCover' } }, [
            removeCoverInput,
            el('span', { text: LanguageManager.t('material.editRemoveCover') })
        ]);

        const sourceText = linkTypes.includes(material.tipo)
            ? String(material.urlOrPath || '')
            : (fileName(material.urlOrPath) || material.titulo || material.tipo || '');
        const sourceHref = typeof MaterialViewer !== 'undefined'
            ? MaterialViewer.fileHref(material)
            : safeHref(material.urlOrPath);
        const currentSource = el('div', { className: 'bt-edit-source bt-stack' }, [
            el('span', { className: 'bt-label', text: LanguageManager.t('material.editCurrentSource') }),
            (material.urlOrPath || sourceHref)
                ? (sourceHref
                    ? el('a', {
                        className: 'bt-text-muted',
                        text: sourceText,
                        attrs: { href: sourceHref, target: '_blank', rel: 'noopener' }
                    })
                    : el('span', { className: 'bt-text-muted', text: sourceText }))
                : el('span', { className: 'bt-text-muted', text: LanguageManager.t('material.editNoSource') })
        ]);

        const coverPreview = material.portada
            ? el('img', {
                className: 'bt-edit-cover',
                attrs: { src: material.portada, alt: '' }
            })
            : el('div', {
                className: 'bt-edit-cover bt-edit-cover--empty',
                text: LanguageManager.t('material.editNoCover')
            });

        const meta = el('p', { className: 'bt-text-muted' }, [
            el('span', { text: `${LanguageManager.t('material.editAuthor')}: ${material.autorNombre || '-'}` }),
            el('span', { text: ` · ${LanguageManager.t('material.editState')}: ${LanguageManager.t(`material.states.${material.estado}`)}` })
        ]);

        const fileField = el('div', { className: 'bt-field' }, [
            el('label', { className: 'bt-label', attrs: { for: 'btMaterialFileInput' }, text: LanguageManager.t('material.editReplaceFile') }),
            fileInput
        ]);
        const linkField = el('div', { className: 'bt-field' }, [
            el('label', { className: 'bt-label', attrs: { for: 'btMaterialUrlInput' }, text: LanguageManager.t('material.link') }),
            urlInput
        ]);
        const coverField = el('div', { className: 'bt-field' }, [
            el('label', { className: 'bt-label', attrs: { for: 'btMaterialCoverInput' }, text: LanguageManager.t('material.editReplaceCover') }),
            el('div', { className: 'bt-edit-cover-row' }, [
                coverPreview,
                el('div', { className: 'bt-stack' }, [
                    coverInput,
                    material.portada ? removeCoverLabel : null
                ].filter(Boolean))
            ])
        ]);

        const body = el('div', { className: 'bt-modal__body bt-modal__body--rich bt-stack' }, [
            meta,
            currentSource,
            el('div', { className: 'bt-field' }, [
                el('label', { className: 'bt-label', attrs: { for: 'btMaterialTitleInput' }, text: LanguageManager.t('material.title') }),
                titleInput
            ]),
            el('div', { className: 'bt-field' }, [
                el('label', { className: 'bt-label', attrs: { for: 'btMaterialDescInput' }, text: LanguageManager.t('material.description') }),
                descInput
            ]),
            el('div', { className: 'bt-field' }, [
                el('label', { className: 'bt-label', attrs: { for: 'btMaterialAuthorInput' }, text: LanguageManager.t('material.author') }),
                authorInput
            ]),
            el('div', { className: 'bt-field' }, [
                el('label', { className: 'bt-label', attrs: { for: 'btMaterialCategoryInput' }, text: LanguageManager.t('material.category') }),
                categorySelect
            ]),
            el('div', { className: 'bt-field' }, [
                el('label', { className: 'bt-label', attrs: { for: 'btMaterialPagesInput' }, text: LanguageManager.t('material.pages') }),
                pagesInput
            ]),
            el('div', { className: 'bt-field' }, [
                el('label', { className: 'bt-label', attrs: { for: 'btMaterialTypeInput' }, text: LanguageManager.t('material.type') }),
                typeSelect
            ]),
            el('div', { className: 'bt-field' }, [mandatoryLabel]),
            fileField,
            linkField,
            coverField,
            el('div', { className: 'bt-field' }, [
                el('label', { className: 'bt-label', attrs: { for: 'btMaterialTagsInput' }, text: LanguageManager.t('material.tags') }),
                tagsInput
            ])
        ]);

        const cancelBtn = el('button', {
            className: 'bt-btn bt-btn--ghost',
            attrs: { type: 'button' },
            text: LanguageManager.t('common.cancel')
        });
        const saveBtn = el('button', {
            className: 'bt-btn',
            attrs: { type: 'submit' },
            text: LanguageManager.t('common.save')
        });
        const footer = el('div', { className: 'bt-modal__footer' }, [cancelBtn, saveBtn]);
        const form = el('form', { className: 'bt-edit-form', attrs: { novalidate: 'novalidate' } }, [body, footer]);

        const header = el('div', {
            className: 'bt-modal__header bt-row bt-between',
            style: { alignItems: 'flex-start', gap: 'var(--space-3)' }
        }, [
            el('div', {}, [
                el('h3', { className: 'bt-modal__title', id: titleId, text: LanguageManager.t('material.edit') }),
                el('p', { className: 'bt-text-muted', text: LanguageManager.t('material.editHint') })
            ]),
            closeBtn
        ]);

        dialog.appendChild(el('div', { className: 'bt-modal__content' }, [header, form]));

        function close(force = false) {
            if (closed || (saving && !force)) return;
            closed = true;
            document.removeEventListener('keydown', onKeydown);
            dialog.remove();
            document.body.style.overflow = previousOverflow;
            if (previousFocus && previousFocus.isConnected) previousFocus.focus();
        }

        function onKeydown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
            }
        }

        function syncSourceFields() {
            const isLink = linkTypes.includes(typeSelect.value);
            const mustReplaceFile = !isLink && (!currentIsFile || typeSelect.value !== material.tipo);
            fileField.classList.toggle('bt-hidden', isLink);
            linkField.classList.toggle('bt-hidden', !isLink);
            fileInput.disabled = isLink;
            fileInput.required = mustReplaceFile;
            fileInput.setAttribute('accept', acceptByType[typeSelect.value] || '');
            urlInput.disabled = !isLink;
            urlInput.required = isLink;
            if (isLink) fileInput.value = '';
        }

        function selectedTags() {
            if (tagsControl) return tagsControl.getTags();
            return tagsInput.value.split(',').map(value => value.trim()).filter(Boolean);
        }

        closeBtn.addEventListener('click', () => close());
        cancelBtn.addEventListener('click', () => close());
        dialog.addEventListener('click', event => {
            if (event.target === dialog) close();
        });
        typeSelect.addEventListener('change', syncSourceFields);
        coverInput.addEventListener('change', () => {
            const hasNewCover = Boolean(coverInput.files && coverInput.files[0]);
            removeCoverInput.disabled = hasNewCover;
            if (hasNewCover) removeCoverInput.checked = false;
        });

        form.addEventListener('submit', async event => {
            event.preventDefault();
            const titulo = titleInput.value.trim();
            if (titulo.length < 2) {
                Toast.error(LanguageManager.t('validation.minLength', { field: LanguageManager.t('material.title') }));
                titleInput.focus();
                return;
            }
            const isLink = linkTypes.includes(typeSelect.value);
            const mustReplaceFile = !isLink && (!currentIsFile || typeSelect.value !== material.tipo);
            const file = fileInput.files && fileInput.files[0];
            if (mustReplaceFile && !file) {
                Toast.error(LanguageManager.t('material.editFileRequired'));
                fileInput.focus();
                return;
            }
            if (isLink && !urlInput.value.trim()) {
                Toast.error(LanguageManager.t('material.editLinkRequired'));
                urlInput.focus();
                return;
            }
            if (saving) return;

            saving = true;
            saveBtn.disabled = true;
            saveBtn.classList.add('bt-btn--loading');
            try {
                const data = new FormData();
                data.append('titulo', titulo);
                data.append('descripcion', descInput.value.trim());
                data.append('tipo', typeSelect.value);
                data.append('author', authorInput.value.trim());
                data.append('category', categorySelect.value || 'technical');
                data.append('pages', pagesInput.value || '');
                data.append('isMandatory', mandatoryInput.checked ? 'true' : 'false');
                if (options.subjectId) data.append('subjectId', String(options.subjectId));
                data.append('categories', selectedTags().join(','));
                if (isLink) data.append('urlOrPath', urlInput.value.trim());
                if (file) data.append('archivo', file);
                if (coverInput.files && coverInput.files[0]) data.append('portada', coverInput.files[0]);
                if (removeCoverInput.checked && !(coverInput.files && coverInput.files[0])) {
                    data.append('removePortada', 'true');
                }

                const result = await apiService.putForm(`/materials/${material.id}`, data);
                Toast.success(LanguageManager.tr(result.message));
                if (typeof onSaved === 'function') onSaved(result.material);
                close(true);
            } catch (error) {
                Toast.error(error.message);
            } finally {
                saving = false;
                saveBtn.disabled = false;
                saveBtn.classList.remove('bt-btn--loading');
            }
        });

        document.body.style.overflow = 'hidden';
        document.body.appendChild(dialog);
        {
            tagsControl = attachTagInput(tagsInput, { fetchSuggestions: true });
        }
        syncSourceFields();
        dialog.setAttribute('open', '');
        document.addEventListener('keydown', onKeydown);
        titleInput.focus();
        titleInput.select();
    }
};

export { MaterialEditor };
