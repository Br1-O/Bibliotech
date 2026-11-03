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
    const categoryFilter = document.getElementById('catalogCategoryFilter');
    const uploadYearFilter = document.getElementById('catalogUploadYearFilter');
    const tagFilter = document.getElementById('catalogTagFilter');
    const sortSelect = document.getElementById('catalogSort');
    const clearButton = document.getElementById('catalogClear');
    const materialsPagination = document.getElementById('catalogPagination');
    const resultsLabel = document.getElementById('catalogResults');

    const params = new URLSearchParams(window.location.search);
    const PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;
    const MATERIAL_TYPES = ['PDF', 'EPUB', 'Word', 'Presentacion', 'Link_Drive', 'Youtube', 'Repositorio'];

    let allMaterials = [];
    let materialTotal = 0;
    let allSubjects = [];
    let allCareers = [];
    let materialPage = 1;
    let debounce;
    let tagFilterControl = null;
    let selectedCareerId = params.get('career') ? Number(params.get('career')) : null;
    let selectedYearId = params.get('yearId') ? Number(params.get('yearId')) : null;
    let selectedType = params.get('tipo') || '';
    let selectedCategory = params.get('category') || '';
    let selectedUploadYear = params.get('year') || '';
    let filterOptions = { years: [], categories: [] };
    const isAdmin = authHelper.isRole('Superadmin');
    const canFavorite = authHelper.isAuthenticated();

    if (tagFilter && params.get('tags')) tagFilter.value = params.get('tags');
    if (searchInput && (params.get('q') || params.get('author'))) {
        searchInput.value = params.get('q') || params.get('author');
    }

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
            const [careerResult, subjectResult, optionsResult] = await Promise.all([
                apiService.get('/careers'),
                apiService.get('/subjects'),
                apiService.get('/materials/filters')
            ]);
            allCareers = careerResult.careers || [];
            allSubjects = subjectResult.subjects || [];
            filterOptions = optionsResult || { years: [], categories: [] };
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

        if (categoryFilter) {
            const current = categoryFilter.value;
            render(categoryFilter, [
                el('option', { value: '', text: LanguageManager.t('filters.allCategories') }),
                ...(filterOptions.categories || []).map(category => el('option', {
                    value: category.slug,
                    text: LanguageManager.t(`material.categories.${category.slug}`)
                }))
            ]);
            if ([...categoryFilter.options].some(option => option.value === selectedCategory || option.value === current)) {
                categoryFilter.value = selectedCategory || current;
            }
        }

        if (uploadYearFilter) {
            render(uploadYearFilter, [
                el('option', { value: '', text: LanguageManager.t('filters.allYears') }),
                ...(filterOptions.years || []).map(year => el('option', { value: String(year), text: String(year) }))
            ]);
            uploadYearFilter.value = selectedUploadYear ? String(selectedUploadYear) : '';
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

    async function loadMaterials(resetPage = true) {
        if (resetPage) materialPage = 1;
        Loader.skeletons(grid, 6);
        try {
            const result = await apiService.get('/materials/global', {
                q: searchInput?.value || '',
                subjects: subjectFilter?.value || '',
                careerId: selectedCareerId || '',
                yearId: selectedYearId || '',
                tipo: selectedType,
                category: selectedCategory,
                year: selectedUploadYear,
                tags: currentTagQuery(),
                sort: sortSelect?.value || 'newest',
                page: materialPage,
                pageSize: PAGE_SIZE
            });
            allMaterials = result.materials || [];
            materialTotal = Number(result.pagination?.total ?? allMaterials.length);
            renderMaterials();
        } catch (error) {
            render(grid, Cards.empty(error.message));
        }
    }

    function renderMaterials() {
        const shown = allMaterials;
        const total = materialTotal;

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
            onChange: page => {
                materialPage = page;
                loadMaterials(false);
            }
        });
    }

    function canEditMaterial(material) {
        return Cards.canEdit(material);
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
    categoryFilter?.addEventListener('change', () => { selectedCategory = categoryFilter.value; loadMaterials(); });
    uploadYearFilter?.addEventListener('change', () => { selectedUploadYear = uploadYearFilter.value; loadMaterials(); });
    tagFilter?.addEventListener('input', scheduleMaterialLoad);
    sortSelect?.addEventListener('change', () => loadMaterials());

    clearButton?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (subjectFilter) subjectFilter.value = '';
        if (typeFilter) typeFilter.value = '';
        if (categoryFilter) categoryFilter.value = '';
        if (uploadYearFilter) uploadYearFilter.value = '';
        if (tagFilterControl) tagFilterControl.clear(false);
        else if (tagFilter) tagFilter.value = '';
        if (sortSelect) sortSelect.value = 'newest';
        selectedType = '';
        selectedCategory = '';
        selectedUploadYear = '';
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
        renderMaterials();
    });

    (async () => {
        await loadFilters();
        await loadMaterials();
    })();
});
