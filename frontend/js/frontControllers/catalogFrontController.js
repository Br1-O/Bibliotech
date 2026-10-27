/**
* Project     : Bibliotech  |  Frontend - Controlador
* catalogFrontController: vista global de materiales.
*/

document.addEventListener('bt:ready', () => {
    const grid = document.getElementById('materialsGrid');
    if (!grid) return;

    const searchInput = document.getElementById('catalogSearch');
    const subjectFilter = document.getElementById('catalogSubjectFilter');
    const careerFilter = document.getElementById('catalogCareerFilter');
    const yearFilter = document.getElementById('catalogYearFilter');
    const typeFilter = document.getElementById('catalogTypeFilter');
    const tagFilter = document.getElementById('catalogTagFilter');
    const sortSelect = document.getElementById('catalogSort');
    const clearButton = document.getElementById('catalogClear');
    const materialsPagination = document.getElementById('catalogPagination');
    const resultsLabel = document.getElementById('catalogResults');

    const params = new URLSearchParams(window.location.search);
    const PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;
    const MATERIAL_TYPES = ['PDF', 'EPUB', 'Word', 'Presentacion', 'Link_Drive', 'Youtube', 'Repositorio'];

    let allMaterials = [];
    let allSubjects = [];
    let allCareers = [];
    let materialPage = 1;
    let debounce;
    let tagFilterControl = null;
    let selectedCareerId = params.get('career') ? Number(params.get('career')) : null;
    let selectedYearId = params.get('year') ? Number(params.get('year')) : null;
    let selectedType = params.get('tipo') || '';
    const isAdmin = authHelper.isRole('Superadmin');
    const currentUser = authHelper.getUser() || {};
    const canFavorite = authHelper.isAuthenticated();

    if (tagFilter && params.get('tags')) tagFilter.value = params.get('tags');

    function populateTypeFilter() {
        if (!typeFilter) return;
        render(typeFilter, [
            el('option', { value: '', text: LanguageManager.t('filters.allTypes') }),
            ...MATERIAL_TYPES.map(value =>
                el('option', { value, text: LanguageManager.t(`material.types.${value}`) }))
        ]);
        typeFilter.value = selectedType;
    }

    async function loadFilters() {
        try {
            const [careerResult, subjectResult] = await Promise.all([
                apiService.get('/careers'),
                apiService.get('/subjects')
            ]);
            allCareers = careerResult.careers || [];
            allSubjects = subjectResult.subjects || [];
            const validCareer = allCareers.find(career => Number(career.id) === Number(selectedCareerId));
            if (!validCareer) {
                selectedCareerId = null;
                selectedYearId = null;
            } else if (selectedYearId && !(validCareer.years || []).some(year => Number(year.id) === Number(selectedYearId))) {
                selectedYearId = null;
            }
            renderFilterOptions();
        } catch (error) {
            console.error(error);
        }
    }

    function renderFilterOptions() {
        if (careerFilter) {
            render(careerFilter, [
                el('option', { value: '', text: LanguageManager.t('careers.allCareers') }),
                ...allCareers.map(career => el('option', { value: String(career.id), text: career.nombre }))
            ]);
            careerFilter.value = selectedCareerId ? String(selectedCareerId) : '';
        }

        const currentCareer = allCareers.find(career => Number(career.id) === Number(selectedCareerId));
        if (yearFilter) {
            render(yearFilter, [
                el('option', { value: '', text: LanguageManager.t('careers.allYears') }),
                ...((currentCareer && currentCareer.years) || []).map(year =>
                    el('option', { value: String(year.id), text: year.nombre }))
            ]);
            yearFilter.value = selectedYearId ? String(selectedYearId) : '';
            yearFilter.disabled = !currentCareer;
        }

        if (subjectFilter) {
            const options = [...allSubjects]
                .filter(subject => !selectedCareerId || Number(subject.carreraId) === Number(selectedCareerId))
                .filter(subject => !selectedYearId || Number(subject.anioId) === Number(selectedYearId))
                .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
            const current = subjectFilter.value;
            render(subjectFilter, [
                el('option', { value: '', text: LanguageManager.t('catalog.allSubjects') }),
                ...options.map(subject => el('option', { value: String(subject.id), text: subject.nombre }))
            ]);
            if ([...subjectFilter.options].some(option => option.value === current)) subjectFilter.value = current;
        }
    }

    function currentTagQuery() {
        const values = tagFilterControl ? tagFilterControl.getTags() : [];
        const draft = (tagFilter?.value || '').split(',').map(value => value.trim()).filter(Boolean);
        const unique = [];
        [...values, ...draft].forEach(value => {
            if (!unique.some(tag => tag.toLowerCase() === value.toLowerCase())) unique.push(value);
        });
        return unique.join(',');
    }

    async function loadMaterials() {
        Loader.skeletons(grid, 6);
        try {
            const result = await apiService.get('/materials/global', {
                q: searchInput?.value || '',
                subjects: subjectFilter?.value || '',
                careerId: selectedCareerId || '',
                yearId: selectedYearId || '',
                tipo: selectedType,
                tags: currentTagQuery()
            });
            allMaterials = result.materials || [];
            materialPage = 1;
            applyAndRender();
        } catch (error) {
            render(grid, Cards.empty(error.message));
        }
    }

    function sortMaterials(items) {
        const mode = sortSelect?.value || 'newest';
        const copy = [...items];
        if (mode === 'oldest') {
            copy.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } else if (mode === 'title') {
            copy.sort((a, b) => String(a.titulo).localeCompare(String(b.titulo)));
        } else {
            copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        return copy;
    }

    function applyAndRender() {
        const sorted = sortMaterials(allMaterials);
        const total = sorted.length;
        const totalPages = Pagination.totalPages(total, PAGE_SIZE);
        if (materialPage > totalPages) materialPage = totalPages;
        const start = (materialPage - 1) * PAGE_SIZE;
        const shown = sorted.slice(start, start + PAGE_SIZE);

        if (resultsLabel) {
            resultsLabel.textContent = total
                ? LanguageManager.t('filters.showing', { shown: shown.length, total })
                : LanguageManager.t('common.noResults');
        }

        if (!total) {
            render(grid, Cards.empty(LanguageManager.t('common.noResults')));
        } else {
            render(grid, shown.map(materialCard));
        }

        Pagination.render(materialsPagination, {
            page: materialPage,
            total,
            pageSize: PAGE_SIZE,
            onChange: page => { materialPage = page; applyAndRender(); }
        });
    }

    function canEditMaterial(material) {
        if (!isAdmin || Cards.isInactive(material)) return false;
        if (Number(material.autorId) === Number(currentUser.id)) return true;
        return material.autorRol === 'Alumno';
    }

    function materialCard(material) {
        return Cards.material(material, {
            onToggleFavorite: canFavorite ? value => Cards.toggleFavorite(value) : null,
            onEdit: canEditMaterial(material) ? editMaterial : null,
            onAdminDelete: isAdmin ? deleteMaterial : null
        });
    }

    function editMaterial(material) {
        if (typeof MaterialEditor === 'undefined') return;
        MaterialEditor.open(material, async () => {
            await Promise.all([loadFilters(), loadMaterials()]);
        });
    }

    async function deleteMaterial(material) {
        const confirmed = await Modal.confirm({
            title: LanguageManager.t('material.deleteGlobal'),
            message: LanguageManager.t('material.deleteGlobalConfirm', { title: material.titulo }),
            variant: 'danger'
        });
        if (!confirmed) return;
        try {
            const result = await apiService.del(`/materials/${material.id}`);
            Toast.success(LanguageManager.tr(result.message));
            await Promise.all([loadFilters(), loadMaterials()]);
        } catch (error) {
            Toast.error(error.message);
        }
    }

    function scheduleMaterialLoad() {
        clearTimeout(debounce);
        debounce = setTimeout(loadMaterials, 300);
    }

    if (tagFilter && window.BTTagInput) {
        tagFilterControl = window.BTTagInput(tagFilter, { onChange: scheduleMaterialLoad });
    }

    searchInput?.addEventListener('input', scheduleMaterialLoad);
    subjectFilter?.addEventListener('change', loadMaterials);
    careerFilter?.addEventListener('change', () => {
        selectedCareerId = careerFilter.value ? Number(careerFilter.value) : null;
        selectedYearId = null;
        renderFilterOptions();
        loadMaterials();
    });
    yearFilter?.addEventListener('change', () => {
        selectedYearId = yearFilter.value ? Number(yearFilter.value) : null;
        renderFilterOptions();
        loadMaterials();
    });
    typeFilter?.addEventListener('change', () => { selectedType = typeFilter.value; loadMaterials(); });
    tagFilter?.addEventListener('input', scheduleMaterialLoad);
    sortSelect?.addEventListener('change', () => { materialPage = 1; applyAndRender(); });

    clearButton?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (subjectFilter) subjectFilter.value = '';
        if (typeFilter) typeFilter.value = '';
        if (tagFilterControl) tagFilterControl.clear(false);
        else if (tagFilter) tagFilter.value = '';
        if (sortSelect) sortSelect.value = 'newest';
        selectedType = '';
        selectedCareerId = null;
        selectedYearId = null;
        clearTimeout(debounce);
        renderFilterOptions();
        loadMaterials();
    });

    populateTypeFilter();
    LanguageManager.onChange(() => {
        populateTypeFilter();
        renderFilterOptions();
        applyAndRender();
    });

    (async () => {
        await loadFilters();
        await loadMaterials();
    })();
});
