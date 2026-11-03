/**
* Project     : Bibliotech  |  Frontend - Controlador
* authorFrontController: perfil publico del autor y sus materiales aprobados.
*/

document.addEventListener('bt:ready', () => {
    const header = document.getElementById('authorHeader');
    if (!header) return;

    const authorId = window.location.pathname.split('/').filter(Boolean).pop();
    const grid = document.getElementById('authorMaterials');
    const pagination = document.getElementById('authorPagination');
    const search = document.getElementById('authorSearch');
    const typeFilter = document.getElementById('authorTypeFilter');
    const clear = document.getElementById('authorClear');
    const results = document.getElementById('authorResults');

    const PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;
    const TYPES = ['PDF', 'EPUB', 'Word', 'Presentacion', 'Link_Drive', 'Youtube', 'Repositorio'];
    let materials = [];
    let total = 0;
    let page = 1;
    let debounce;
    const canFavorite = authHelper.isAuthenticated();

    render(typeFilter, [
        el('option', { value: '', text: LanguageManager.t('filters.allTypes') }),
        ...TYPES.map(value => el('option', { value, text: LanguageManager.t(`material.types.${value}`) }))
    ]);

    function renderAuthor(author) {
        render(header, [
            el('h1', { text: author.nombreCompleto || `${author.nombre || ''} ${author.apellido || ''}`.trim() }),
            el('p', { className: 'bt-text-muted', text: LanguageManager.t('author.email', { email: author.email || '' }) }),
            el('a', {
                className: 'bt-btn bt-btn--ghost bt-btn--sm',
                text: LanguageManager.t('author.backToCatalog'),
                attrs: { href: '/catalogo' }
            })
        ]);
    }

    async function load(resetPage = true) {
        if (resetPage) page = 1;
        Loader.skeletons(grid, 3);
        try {
            const result = await apiService.get(`/materials/author/${authorId}`, {
                q: search.value.trim(),
                tipo: typeFilter.value,
                page,
                pageSize: PAGE_SIZE
            });
            renderAuthor(result.author);
            materials = result.materials || [];
            total = Number(result.pagination?.total ?? materials.length);
            apply();
        } catch (error) {
            render(header, []);
            render(grid, Cards.empty(error.message));
        }
    }

    function apply() {
        const items = materials;

        results.textContent = total
            ? LanguageManager.t('filters.showing', { shown: items.length, total })
            : LanguageManager.t('common.noResults');

        if (!total) {
            render(grid, Cards.empty(LanguageManager.t('author.noMaterials')));
        } else {
            render(grid, items.map(material => Cards.material(material, {
                onToggleFavorite: canFavorite ? (m) => Cards.toggleFavorite(m) : null
            })));
        }

        Pagination.render(pagination, {
            page,
            total,
            pageSize: PAGE_SIZE,
            onChange: next => { page = next; load(false); }
        });
    }

    search.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(load, 300);
    });
    typeFilter.addEventListener('change', load);
    clear.addEventListener('click', () => {
        search.value = '';
        typeFilter.value = '';
        load();
    });
    LanguageManager.onChange(() => load(false));

    load();
});
