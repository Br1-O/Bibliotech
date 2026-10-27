/**
* Project     : Bibliotech  |  Frontend - Componente
* MyUploads: seccion "Mis subidas" con busqueda, filtros y paginacion.
*/

const MyUploads = {
    mount({ container, pageSize = Pagination.DEFAULT_PAGE_SIZE } = {}) {
        if (!container) return null;

        const state = {
            materials: [],
            page: 1,
            debounce: null
        };

        const search = el('input', {
            className: 'bt-input',
            attrs: { type: 'search', placeholder: LanguageManager.t('catalog.searchPlaceholder') }
        });
        const type = el('select', { className: 'bt-select' });
        const status = el('select', { className: 'bt-select' });
        const clear = el('button', {
            className: 'bt-btn bt-btn--ghost',
            text: LanguageManager.t('filters.clear'),
            attrs: { type: 'button' }
        });
        const results = el('p', { className: 'bt-text-muted' });
        const grid = el('div', { className: 'bt-grid' });
        const pagination = el('div');

        render(type, [
            el('option', { value: '', text: LanguageManager.t('filters.allTypes') }),
            ...['PDF', 'EPUB', 'Word', 'Presentacion', 'Link_Drive', 'Youtube', 'Repositorio'].map(value =>
                el('option', { value, text: LanguageManager.t(`material.types.${value}`) }))
        ]);
        render(status, [
            el('option', { value: '', text: LanguageManager.t('filters.allStates') }),
            ...['Aprobado', 'Pendiente', 'Cancelado', 'Rechazado'].map(value =>
                el('option', { value, text: LanguageManager.t(`material.states.${value}`) }))
        ]);

        const toolbar = el('div', { className: 'bt-toolbar bt-row' }, [search, type, status, clear]);
        render(container, [toolbar, results, grid, pagination]);

        const canEdit = authHelper.isRole('Profesor', 'Superadmin');

        async function load() {
            Loader.skeletons(grid, 3);
            try {
                const result = await apiService.get('/materials/mine', {
                    q: search.value.trim(),
                    tipo: type.value,
                    estado: status.value
                });
                state.materials = result.materials || [];
                state.page = 1;
                apply();
            } catch (error) {
                render(grid, Cards.empty(error.message));
            }
        }

        function apply() {
            const total = state.materials.length;
            const totalPages = Pagination.totalPages(total, pageSize);
            if (state.page > totalPages) state.page = totalPages;
            const start = (state.page - 1) * pageSize;
            const items = state.materials.slice(start, start + pageSize);

            results.textContent = total
                ? LanguageManager.t('filters.showing', { shown: items.length, total })
                : LanguageManager.t('common.noResults');

            if (!total) {
                render(grid, Cards.empty(LanguageManager.t('myUploads.empty')));
            } else {
                render(grid, items.map(material => Cards.material(material, {
                    showState: true,
                    onEdit: canEdit && !Cards.isInactive(material) ? openEditor : null
                })));
            }

            Pagination.render(pagination, {
                page: state.page,
                total,
                pageSize,
                onChange: page => { state.page = page; apply(); }
            });
        }

        function openEditor(material) {
            MaterialEditor.open(material, () => load());
        }

        const debounced = () => {
            clearTimeout(state.debounce);
            state.debounce = setTimeout(load, 300);
        };

        search.addEventListener('input', debounced);
        type.addEventListener('change', load);
        status.addEventListener('change', load);
        clear.addEventListener('click', () => {
            search.value = '';
            type.value = '';
            status.value = '';
            load();
        });

        load();

        return { reload: load };
    }
};
