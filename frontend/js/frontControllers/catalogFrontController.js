/**
* Project     : Bibliotech  |  Frontend - Controlador
* catalogFrontController: vista global del catalogo y materias (RF-04.1, RF-03).
*/

document.addEventListener('bt:ready', () => {
    const grid = document.getElementById('materialsGrid');
    if (!grid) return;

    const subjectsGrid = document.getElementById('subjectsGrid');
    const subjectsPagination = document.getElementById('subjectsPagination');
    const searchInput = document.getElementById('catalogSearch');
    const subjectFilter = document.getElementById('catalogSubjectFilter');
    const tagFilter = document.getElementById('catalogTagFilter');
    const sortSelect = document.getElementById('catalogSort');
    const clearButton = document.getElementById('catalogClear');
    const materialsPagination = document.getElementById('catalogPagination');
    const resultsLabel = document.getElementById('catalogResults');

    const PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;
    const SUBJECT_PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;
    let subscriptions = [];
    let allMaterials = [];
    let materialPage = 1;
    let subjectPage = 1;
    let debounce;

    const isAlumno = authHelper.isRole('Alumno');
    const canFavorite = authHelper.isAuthenticated();
    const subscribedToggle = document.getElementById('subscribedToggle');
    const subscribedToggleWrap = document.getElementById('subscribedToggleWrap');
    let allSubjectsCache = [];

    if (isAlumno && subscribedToggleWrap) {
        subscribedToggleWrap.classList.remove('bt-hidden');
        subscribedToggle?.addEventListener('change', () => renderSubjectsList());
    }

    async function loadSubjects() {
        try {
            const { subjects } = await apiService.get('/subjects');
            allSubjectsCache = subjects;
            renderSubjectsList();
        } catch (error) {
            console.error(error);
        }
    }

    function renderSubjectsList() {
        subjectPage = 1;
        renderSubjects();
    }

    function renderSubjects() {
        let subjects = [...allSubjectsCache];
        if (isAlumno) {
            // subscribed first
            subjects.sort((a, b) => {
                const as = subscriptions.some(s => String(s.materia_id) === String(a.id));
                const bs = subscriptions.some(s => String(s.materia_id) === String(b.id));
                if (as !== bs) return as ? -1 : 1;
                return 0;
            });
            if (subscribedToggle?.checked) {
                subjects = subjects.filter(s => subscriptions.some(sub => String(sub.materia_id) === String(s.id)));
            }
        }
        renderSubjectsGrid(subjects);
    }

    function renderSubjectsGrid(subjects) {
        if (!subjectsGrid) return;
        if (!subjects.length) {
            render(subjectsGrid, Cards.empty(LanguageManager.t('subjects.noSubjects')));
            Pagination.render(subjectsPagination, { total: 0, pageSize: SUBJECT_PAGE_SIZE });
            return;
        }

        const totalPages = Pagination.totalPages(subjects.length, SUBJECT_PAGE_SIZE);
        if (subjectPage > totalPages) subjectPage = totalPages;
        const start = (subjectPage - 1) * SUBJECT_PAGE_SIZE;
        const pageItems = subjects.slice(start, start + SUBJECT_PAGE_SIZE);

        render(subjectsGrid, pageItems.map(subject => Cards.subject(subject, {
            subscribeButton: isAlumno ? buildSubscribeButton(subject) : null
        })));

        Pagination.render(subjectsPagination, {
            page: subjectPage,
            total: subjects.length,
            pageSize: SUBJECT_PAGE_SIZE,
            onChange: (page) => { subjectPage = page; renderSubjects(); }
        });

        if (subjectFilter) {
            // Conserva la opcion "todas" y agrega todas las materias.
            const current = subjectFilter.value;
            render(subjectFilter, [
                el('option', { value: '', text: LanguageManager.t('catalog.allSubjects') }),
                ...subjects.map(s => el('option', { value: String(s.id), text: s.nombre }))
            ]);
            subjectFilter.value = current;
        }
    }

    function buildSubscribeButton(subject) {
        const subscribed = subscriptions.some(s => String(s.materia_id) === String(subject.id));
        const btn = el('bt-button', {
            size: 'sm',
            variant: subscribed ? 'secondary' : 'success',
            label: LanguageManager.t(subscribed ? 'subject.subscribed' : 'subject.subscribe')
        });
        btn.addEventListener('click', async () => {
            try {
                if (subscribed) {
                    await apiService.del(`/subscriptions/subscribe/${subject.id}`);
                    Toast.success(LanguageManager.t('messages.unsubscribed'));
                } else {
                    await apiService.post(`/subscriptions/subscribe/${subject.id}`, {});
                    Toast.success(LanguageManager.t('messages.subscribed'));
                }
                await loadSubscriptions();
                renderSubjects();
            } catch (error) {
                Toast.error(error.message);
            } finally {
                btn.setLoading(false);
            }
        });
        return btn;
    }

    async function loadSubscriptions() {
        if (!isAlumno) return;
        try {
            const result = await apiService.get('/subscriptions/mine');
            subscriptions = result.subscriptions || [];
        } catch (error) { subscriptions = []; }
    }

    async function loadMaterials() {
        Loader.skeletons(grid, 6);
        try {
            const result = await apiService.get('/materials/global', {
                q: searchInput?.value || '',
                subjects: subjectFilter?.value || '',
                tags: tagFilter?.value || ''
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
            onChange: (page) => { materialPage = page; applyAndRender(); }
        });
    }

    function materialCard(material) {
        return Cards.material(material, {
            onToggleFavorite: canFavorite ? (m) => Cards.toggleFavorite(m) : null
        });
    }

    // Filtros con debounce sobre el texto libre.
    searchInput?.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(loadMaterials, 300);
    });
    subjectFilter?.addEventListener('change', loadMaterials);
    tagFilter?.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(loadMaterials, 300);
    });

    sortSelect?.addEventListener('change', () => { materialPage = 1; applyAndRender(); });

    clearButton?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (subjectFilter) subjectFilter.value = '';
        if (tagFilter) tagFilter.value = '';
        if (sortSelect) sortSelect.value = 'newest';
        loadMaterials();
    });

    // Estado inicial.
    (async () => {
        if (isAlumno) {
            try {
                const mine = await apiService.get('/subscriptions/mine');
                subscriptions = mine.subscriptions || [];
            } catch (error) { /* visitante */ }
        }
        await loadSubjects();
        await loadMaterials();
    })();
});
