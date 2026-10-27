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
    let page = 1;

    function updateCounter() {
        if (!counter) return;
        counter.textContent = favorites.length
            ? LanguageManager.t('favorites.count', { count: favorites.length })
            : '';
        counter.classList.toggle('bt-hidden', !favorites.length);
    }

    async function load() {
        Loader.skeletons(grid, 6);
        try {
            const result = await apiService.get('/materials/favorites/mine');
            favorites = result.favorites || [];
            page = 1;
            renderPage();
        } catch (error) {
            render(grid, Cards.empty(error.message));
        }
    }

    function renderPage() {
        updateCounter();
        if (!favorites.length) {
            render(grid, Cards.empty(LanguageManager.t('favorites.empty')));
            Pagination.render(paginationNode, { total: 0, pageSize: PAGE_SIZE });
            return;
        }

        const totalPages = Pagination.totalPages(favorites.length, PAGE_SIZE);
        if (page > totalPages) page = totalPages;
        const start = (page - 1) * PAGE_SIZE;
        const items = favorites.slice(start, start + PAGE_SIZE);

        render(grid, items.map(material => Cards.material(material, {
            onToggleFavorite: (target) => Cards.toggleFavorite(target).then((res) => {
                if (!res.favorited) {
                    favorites = favorites.filter(f => Number(f.id) !== Number(target.id));
                    renderPage();
                }
                return res;
            })
        })));

        Pagination.render(paginationNode, {
            page,
            total: favorites.length,
            pageSize: PAGE_SIZE,
            onChange: (next) => { page = next; renderPage(); }
        });
    }

    LanguageManager.onChange(() => renderPage());
    load();
});
