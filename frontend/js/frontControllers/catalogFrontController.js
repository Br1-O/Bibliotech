/**
* Project     : Bibliotech  |  Frontend - Controlador
* catalogFrontController: vista global del catalogo, materias y seccion de
* suscripciones del alumno (RF-03, RF-04.1).
*/

document.addEventListener('bt:ready', () => {
    const grid = document.getElementById('materialsGrid');
    if (!grid) return;

    const subjectsGrid = document.getElementById('subjectsGrid');
    const subjectsPagination = document.getElementById('subjectsPagination');
    const subscribedSection = document.getElementById('suscritas');
    const subscribedGrid = document.getElementById('subscribedGrid');
    const subscribedPagination = document.getElementById('subscribedPagination');
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
    let allSubjectsCache = [];
    let materialPage = 1;
    let subjectPage = 1;
    let subscribedPage = 1;
    let debounce;
    let tagFilterControl = null;

    const isAlumno = authHelper.isRole('Alumno');
    const canFavorite = authHelper.isAuthenticated();
    const toggleSubscribedBtn = document.getElementById('toggleSubscribedBtn');
    const subscribedToggleWrap = document.getElementById('subscribedToggleWrap');
    let showOnlySubscribed = false;

    const subjectIdOf = (subscription) => String(subscription.materiaId ?? subscription.materia_id);
    const isSubscribed = (id) => subscriptions.some(s => subjectIdOf(s) === String(id));

    if (isAlumno) {
        subscribedToggleWrap?.classList.remove('bt-hidden');
        subscribedSection?.classList.remove('bt-hidden');
        toggleSubscribedBtn?.addEventListener('click', () => {
            showOnlySubscribed = !showOnlySubscribed;
            updateToggleLabel();
            subjectPage = 1;
            renderSubjects();
        });
        updateToggleLabel();
    }

    function updateToggleLabel() {
        if (!toggleSubscribedBtn) return;
        toggleSubscribedBtn.setAttribute('label-i18n', showOnlySubscribed ? 'subjects.showAll' : 'subjects.onlySubscribed');
        toggleSubscribedBtn.setAttribute('variant', showOnlySubscribed ? 'ghost' : 'secondary');
    }

    async function loadSubjects() {
        try {
            const { subjects } = await apiService.get('/subjects');
            allSubjectsCache = subjects || [];
            renderSubjectsList();
            renderSubscribed();
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
            subjects.sort((a, b) => {
                const as = isSubscribed(a.id);
                const bs = isSubscribed(b.id);
                if (as !== bs) return as ? -1 : 1;
                return String(a.nombre).localeCompare(String(b.nombre));
            });
            if (showOnlySubscribed) subjects = subjects.filter(s => isSubscribed(s.id));
        }
        renderSubjectsGrid(subjects);
    }

    function renderSubjectsGrid(subjects) {
        if (!subjectsGrid) return;
        if (!subjects.length) {
            const message = showOnlySubscribed && isAlumno
                ? LanguageManager.t('subjects.noSubscribed')
                : LanguageManager.t('subjects.noSubjects');
            render(subjectsGrid, Cards.empty(message));
            Pagination.render(subjectsPagination, { total: 0, pageSize: SUBJECT_PAGE_SIZE });
            updateSubjectFilter();
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

        updateSubjectFilter();
    }

    function updateSubjectFilter() {
        if (!subjectFilter) return;
        const current = subjectFilter.value;
        const options = [...allSubjectsCache]
            .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
        render(subjectFilter, [
            el('option', { value: '', text: LanguageManager.t('catalog.allSubjects') }),
            ...options.map(s => el('option', { value: String(s.id), text: s.nombre }))
        ]);
        if ([...subjectFilter.options].some(o => o.value === current)) subjectFilter.value = current;
    }

    function buildSubscribeButton(subject) {
        const subscribed = isSubscribed(subject.id);
        const btn = el('bt-button', {
            size: 'sm',
            variant: subscribed ? 'secondary' : 'success',
            label: LanguageManager.t(subscribed ? 'subject.subscribed' : 'subject.subscribe')
        });
        btn.addEventListener('click', async () => {
            try {
                btn.setLoading(true);
                if (subscribed) {
                    await apiService.del(`/subscriptions/subscribe/${subject.id}`);
                    Toast.success(LanguageManager.t('messages.unsubscribed'));
                } else {
                    await apiService.post(`/subscriptions/subscribe/${subject.id}`, {});
                    Toast.success(LanguageManager.t('messages.subscribed'));
                }
                await loadSubscriptions();
                renderSubjects();
                renderSubscribed();
            } catch (error) {
                Toast.error(error.message);
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
        } catch (error) {
            subscriptions = [];
        }
    }

    /** Materias del alumno: tarjetas de acceso rapido siempre visibles. */
    function renderSubscribed() {
        if (!isAlumno || !subscribedGrid) return;

        const subjects = subscriptions.map(subscription => {
            const id = subjectIdOf(subscription);
            const cached = allSubjectsCache.find(s => String(s.id) === id);
            return cached || {
                id,
                nombre: subscription.materiaNombre || subscription.materia_nombre || '',
                descripcion: subscription.materiaDescripcion || subscription.materia_descripcion || '',
                profesorNombre: subscription.profesorNombre || subscription.profesor_nombre || '',
                totalMateriales: subscription.totalMateriales ?? subscription.total_materiales ?? 0
            };
        }).filter(subject => subject.nombre);

        if (!subjects.length) {
            render(subscribedGrid, Cards.empty(LanguageManager.t('subjects.noSubscribed')));
            Pagination.render(subscribedPagination, { total: 0, pageSize: SUBJECT_PAGE_SIZE });
            return;
        }

        const totalPages = Pagination.totalPages(subjects.length, SUBJECT_PAGE_SIZE);
        if (subscribedPage > totalPages) subscribedPage = totalPages;
        const start = (subscribedPage - 1) * SUBJECT_PAGE_SIZE;
        const pageItems = subjects.slice(start, start + SUBJECT_PAGE_SIZE);

        render(subscribedGrid, pageItems.map(subject => Cards.subject(subject, {
            subscribeButton: buildSubscribeButton(subject)
        })));
        Pagination.render(subscribedPagination, {
            page: subscribedPage,
            total: subjects.length,
            pageSize: SUBJECT_PAGE_SIZE,
            onChange: (page) => { subscribedPage = page; renderSubscribed(); }
        });
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
            onChange: (page) => { materialPage = page; applyAndRender(); }
        });
    }

    function materialCard(material) {
        return Cards.material(material, {
            onToggleFavorite: canFavorite ? (m) => Cards.toggleFavorite(m) : null
        });
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
    tagFilter?.addEventListener('input', scheduleMaterialLoad);

    sortSelect?.addEventListener('change', () => { materialPage = 1; applyAndRender(); });

    clearButton?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (subjectFilter) subjectFilter.value = '';
        if (tagFilterControl) tagFilterControl.clear(false);
        else if (tagFilter) tagFilter.value = '';
        if (sortSelect) sortSelect.value = 'newest';
        clearTimeout(debounce);
        loadMaterials();
    });

    LanguageManager.onChange(() => {
        updateToggleLabel();
        renderSubjects();
        renderSubscribed();
        applyAndRender();
    });

    (async () => {
        await loadSubscriptions();
        await loadSubjects();
        await loadMaterials();
    })();
});
