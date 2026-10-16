/**
* Favorites controller
*/

document.addEventListener('bt:ready', () => {
    const grid = document.getElementById('favoritesGrid');
    if (!grid) return;
    if (!authHelper.requireAuth()) return;
    
    async function load() {
        Loader.skeletons(grid, 6);
        try {
            const result = await apiService.get('/materials/favorites/mine');
            const favorites = result.favorites || [];
            if (!favorites.length) {
                render(grid, Cards.empty(LanguageManager.t('favorites.empty')));
                return;
            }
            render(grid, favorites.map(m => Cards.material(m, {
                onToggleFavorite: (material) => Cards.toggleFavorite(material).then((res) => {
                    if (!res.favorited) load();
                    return res;
                })
            })));
        } catch (error) {
            render(grid, Cards.empty(error.message));
        }
    }
    load();
});
