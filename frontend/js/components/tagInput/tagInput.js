/**
* Project     : Bibliotech  |  Frontend - Componente
* TagInput: input de etiquetas tematicas con badges, creacion dinamica
* al pulsar Enter y autocompletado con etiquetas existentes.
*/
import { LanguageManager } from '../../i18n/LanguageManager.js';
import { apiService } from '../../services/apiService.js';

function attachTagInput(inputEl, options = {}) {
        if (!inputEl) return null;
        if (inputEl.dataset.tagInputReady) return inputEl._btTagInput || null;
        inputEl.dataset.tagInputReady = '1';

        const tags = [];
        const wrap = document.createElement('div');
        wrap.className = 'bt-taginput';
        inputEl.parentNode.insertBefore(wrap, inputEl);
        wrap.appendChild(inputEl);

        const badges = document.createElement('div');
        badges.className = 'bt-taginput__badges bt-row';
        badges.style.gap = '6px';
        badges.setAttribute('aria-live', 'polite');
        wrap.insertBefore(badges, inputEl);

        const suggestions = document.createElement('div');
        suggestions.className = 'bt-taginput__suggestions bt-row';
        suggestions.style.gap = '6px';
        suggestions.hidden = true;
        wrap.appendChild(suggestions);

        inputEl.setAttribute('autocomplete', 'off');
        inputEl.setAttribute('aria-autocomplete', 'list');
        inputEl.setAttribute('aria-expanded', 'false');

        let hiddenInput = null;
        const originalName = inputEl.getAttribute('name');
        if (originalName) {
            hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = originalName;
            hiddenInput.value = '';
            inputEl.removeAttribute('name');
            wrap.appendChild(hiddenInput);
        }

        let existingTags = [];
        let suggestionItems = [];
        let activeSuggestion = -1;
        let resetTimer = null;

        if (options.fetchSuggestions !== false) {
            apiService.get('/thematic-tags').then(({ tags: t }) => {
                existingTags = (t || []).filter(x => !x.baneado).map(x => x.nombre);
            }).catch(() => { existingTags = []; });
        }

        function syncValue(notify = true) {
            if (hiddenInput) hiddenInput.value = tags.join(',');
            if (notify && typeof options.onChange === 'function') options.onChange([...tags]);
        }

        function renderBadges(notify = true) {
            badges.replaceChildren();
            tags.forEach((tag, idx) => {
                const badge = document.createElement('span');
                badge.className = 'bt-chip bt-chip--tag';
                badge.appendChild(document.createTextNode(tag));

                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'bt-taginput__remove';
                remove.textContent = '×';
                remove.dataset.tag = tag;
                remove.setAttribute('aria-label', typeof LanguageManager !== 'undefined'
                    ? LanguageManager.t('material.removeTag', { tag })
                    : `Quitar ${tag}`);
                remove.addEventListener('click', () => {
                    tags.splice(idx, 1);
                    renderBadges();
                    renderSuggestions(inputEl.value);
                    inputEl.focus();
                });

                badge.appendChild(remove);
                badges.appendChild(badge);
            });
            syncValue(notify);
        }

        function addTag(raw) {
            const values = String(raw || '').split(',').map(value => value.trim()).filter(Boolean);
            if (!values.length) {
                renderSuggestions('');
                return;
            }

            values.forEach(value => {
                const canonical = existingTags.find(tag => tag.toLowerCase() === value.toLowerCase()) || value;
                if (!tags.some(tag => tag.toLowerCase() === canonical.toLowerCase())) tags.push(canonical);
            });

            inputEl.value = '';
            activeSuggestion = -1;
            renderSuggestions('');
            renderBadges();
        }

        function updateActiveSuggestion() {
            suggestionItems.forEach((item, idx) => {
                item.node.classList.toggle('is-active', idx === activeSuggestion);
            });
        }

        function renderSuggestions(query) {
            suggestions.replaceChildren();
            suggestionItems = [];
            activeSuggestion = -1;

            const q = (query || '').trim().toLowerCase();
            if (!q) {
                suggestions.hidden = true;
                inputEl.setAttribute('aria-expanded', 'false');
                return;
            }

            existingTags
                .filter(tag => tag.toLowerCase().includes(q)
                    && !tags.some(selected => selected.toLowerCase() === tag.toLowerCase()))
                .slice(0, 8)
                .forEach(tag => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'bt-chip bt-chip--tag bt-chip--suggest';
                    btn.textContent = tag;
                    btn.addEventListener('click', () => {
                        addTag(tag);
                        inputEl.focus();
                    });
                    suggestionItems.push({ tag, node: btn });
                    suggestions.appendChild(btn);
                });

            suggestions.hidden = suggestionItems.length === 0;
            inputEl.setAttribute('aria-expanded', String(!suggestions.hidden));
        }

        function clear(notify = true) {
            tags.length = 0;
            inputEl.value = '';
            renderSuggestions('');
            renderBadges(notify);
        }

        inputEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const selected = activeSuggestion >= 0 ? suggestionItems[activeSuggestion] : null;
                addTag(selected ? selected.tag : inputEl.value);
                return;
            }

            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                if (!suggestionItems.length) return;
                event.preventDefault();
                const direction = event.key === 'ArrowDown' ? 1 : -1;
                if (activeSuggestion < 0) {
                    activeSuggestion = direction > 0 ? 0 : suggestionItems.length - 1;
                } else {
                    activeSuggestion = (activeSuggestion + direction + suggestionItems.length) % suggestionItems.length;
                }
                updateActiveSuggestion();
                return;
            }

            if (event.key === 'Escape' && suggestionItems.length) {
                event.preventDefault();
                renderSuggestions('');
            }
        });

        inputEl.addEventListener('input', () => renderSuggestions(inputEl.value));
        inputEl.addEventListener('focus', () => {
            if (inputEl.value.trim()) renderSuggestions(inputEl.value);
        });
        inputEl.addEventListener('blur', () => {
            if (inputEl.value.trim()) addTag(inputEl.value);
            setTimeout(() => {
                if (document.activeElement !== inputEl) renderSuggestions('');
            }, 150);
        });

        suggestions.addEventListener('mousedown', (event) => {
            if (event.target.closest('button')) event.preventDefault();
        });

        inputEl.form?.addEventListener('reset', () => {
            clearTimeout(resetTimer);
            resetTimer = setTimeout(() => clear(), 0);
        });

        if (typeof LanguageManager !== 'undefined' && typeof LanguageManager.onChange === 'function') {
            LanguageManager.onChange(() => {
                badges.querySelectorAll('.bt-taginput__remove').forEach(button => {
                    const tag = button.dataset.tag || '';
                    button.setAttribute('aria-label', LanguageManager.t('material.removeTag', { tag }));
                });
            });
        }

        if (inputEl.value) {
            String(inputEl.value).split(',').map(value => value.trim()).filter(Boolean).forEach(tag => {
                if (!tags.some(selected => selected.toLowerCase() === tag.toLowerCase())) tags.push(tag);
            });
            inputEl.value = '';
            renderBadges();
        } else {
            syncValue(false);
        }

        function setTags(raw, notify = true) {
            const values = Array.isArray(raw) ? raw : String(raw || '').split(',');
            tags.length = 0;
            values.map(value => String(value).trim()).filter(Boolean).forEach(value => {
                const canonical = existingTags.find(tag => tag.toLowerCase() === value.toLowerCase()) || value;
                if (!tags.some(tag => tag.toLowerCase() === canonical.toLowerCase())) tags.push(canonical);
            });
            inputEl.value = '';
            renderSuggestions('');
            renderBadges(notify);
        }

        const control = {
            getTags: () => [...tags],
            setTags,
            clear,
            focus: () => inputEl.focus()
        };
        inputEl._btTagInput = control;
        return control;
}

export { attachTagInput };
