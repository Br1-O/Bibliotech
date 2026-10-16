/**
* Project     : Bibliotech  |  Frontend - Componente
* TagInput: input de etiquetas tematicas con badges, creacion dinamica
* al pulsar Enter y autocompletado con etiquetas existentes.
*/
if (!window.BTTagInput) {
    window.BTTagInput = function attachTagInput(inputEl, options = {}) {
        if (!inputEl || inputEl.dataset.tagInputReady) return;
        inputEl.dataset.tagInputReady = '1';

        const tags = [];
        const wrap = document.createElement('div');
        wrap.className = 'bt-taginput';
        inputEl.parentNode.insertBefore(wrap, inputEl);
        wrap.appendChild(inputEl);

        const badges = document.createElement('div');
        badges.className = 'bt-taginput__badges bt-row';
        badges.style.gap = '6px';
        wrap.insertBefore(badges, inputEl);

        const suggestions = document.createElement('div');
        suggestions.className = 'bt-taginput__suggestions bt-row';
        suggestions.style.gap = '6px';
        wrap.appendChild(suggestions);

        let existingTags = [];
        if (options.fetchSuggestions !== false) {
            apiService.get('/thematic-tags').then(({ tags: t }) => {
                existingTags = (t || []).filter(x => !x.baneado).map(x => x.nombre);
            }).catch(() => { existingTags = []; });
        }

        function renderBadges() {
            badges.innerHTML = '';
            tags.forEach((tag, idx) => {
                const b = document.createElement('span');
                b.className = 'bt-chip';
                b.textContent = tag;
                const rm = document.createElement('button');
                rm.type = 'button';
                rm.textContent = '×';
                rm.style.cssText = 'background:none;border:none;cursor:pointer;margin-left:4px;';
                rm.addEventListener('click', () => { tags.splice(idx, 1); renderBadges(); syncValue(); });
                b.appendChild(rm);
                badges.appendChild(b);
            });
            syncValue();
        }

        function syncValue() {
            inputEl.value = tags.join(',');
            if (typeof options.onChange === 'function') options.onChange([...tags]);
        }

        function addTag(raw) {
            const tag = (raw || '').trim();
            if (!tag) return;
            if (!tags.includes(tag)) tags.push(tag);
            inputEl.value = '';
            renderBadges();
            renderSuggestions('');
        }

        function renderSuggestions(query) {
            suggestions.innerHTML = '';
            const q = (query || '').toLowerCase();
            if (!q) return;
            existingTags
                .filter(t => t.toLowerCase().includes(q) && !tags.includes(t))
                .slice(0, 8)
                .forEach(t => {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'bt-chip bt-chip--suggest';
                    b.textContent = t;
                    b.addEventListener('click', () => { addTag(t); });
                    suggestions.appendChild(b);
                });
        }

        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTag(inputEl.value);
            }
        });

        inputEl.addEventListener('input', () => renderSuggestions(inputEl.value));
        inputEl.addEventListener('blur', () => {
            if (inputEl.value.trim()) addTag(inputEl.value);
            setTimeout(() => { suggestions.innerHTML = ''; }, 150);
        });

        // Init from existing value if any
        if (inputEl.value) {
            String(inputEl.value).split(',').map(v => v.trim()).filter(Boolean).forEach(t => { if (!tags.includes(t)) tags.push(t); });
            inputEl.value = '';
            renderBadges();
        }

        return { getTags: () => [...tags], clear: () => { tags.length = 0; renderBadges(); } };
    };
}
