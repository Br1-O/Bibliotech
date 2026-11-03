/**
* Project     : Bibliotech  |  Frontend - Controlador
* favoritesFrontController: materiales guardados por el usuario autenticado.
*/

document.addEventListener('bt:ready', () => {
    const grid = document.getElementById('favoritesGrid');
    const paginationNode = document.getElementById('favoritesPagination');
    const counter = document.getElementById('favoritesCount');
    if (!grid) return;
    if (!authHelper.requireAuth()) return;

    const PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;
    let favorites = [];
    let total = 0;
    let page = 1;

    function updateCounter() {
        if (!counter) return;
        counter.textContent = total
            ? LanguageManager.t('favorites.count', { count: total })
            : '';
        counter.classList.toggle('bt-hidden', !total);
    }

    async function load(resetPage = true) {
        if (resetPage) page = 1;
        Loader.skeletons(grid, 6);
        try {
            const result = await apiService.get('/materials/favorites/mine', {
                page,
                pageSize: PAGE_SIZE
            });
            favorites = result.favorites || result.materials || [];
            total = Number(result.pagination?.total ?? favorites.length);
            const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
            if (page > totalPages) {
                page = totalPages;
                return load(false);
            }
            renderPage();
        } catch (error) {
            render(grid, Cards.empty(error.message));
        }
    }

    function renderPage() {
        updateCounter();
        if (!total) {
            render(grid, Cards.empty(LanguageManager.t('favorites.empty')));
            Pagination.render(paginationNode, { total: 0, pageSize: PAGE_SIZE });
            return;
        }

        render(grid, favorites.map(material => Cards.material(material, {
            onToggleFavorite: (target) => Cards.toggleFavorite(target).then((res) => {
                if (!res.favorited) {
                    load(false);
                }
                return res;
            })
        })));

        Pagination.render(paginationNode, {
            page,
            total,
            pageSize: PAGE_SIZE,
            onChange: (next) => { page = next; load(false); }
        });
    }

    LanguageManager.onChange(() => renderPage());
    load();
});
