/**
* Project     : Bibliotech  |  Frontend - Controlador
* catalogFrontController: vista global del catalogo y materias (RF-04.1, RF-03).
*/

document.addEventListener('bt:ready', () => {
    const grid = document.getElementById('materialsGrid');
    if (!grid) return;

    const subjectsGrid = document.getElementById('subjectsGrid');
    const searchInput = document.getElementById('catalogSearch');
    const subjectFilter = document.getElementById('catalogSubjectFilter');
    const tagFilter = document.getElementById('catalogTagFilter');
    const sortSelect = document.getElementById('catalogSort');
    const clearButton = document.getElementById('catalogClear');
    const loadMoreButton = document.getElementById('catalogLoadMore');
    const resultsLabel = document.getElementById('catalogResults');

    const PAGE_SIZE = 6;
    let subscriptions = [];
    let allMaterials = [];
    let visibleCount = PAGE_SIZE;
    let debounce;

    const isAlumno = authHelper.isRole('Alumno');

    async function loadSubjects() {
        try {
            const { subjects } = await apiService.get('/subjects');
            renderSubjects(subjects, subjectsGrid, subjectFilter);
        } catch (error) {
            console.error(error);
        }
    }

    function renderSubjects(subjects, gridNode, filterNode) {
        if (!gridNode) return;
        if (!subjects.length) { render(gridNode, Cards.empty(LanguageManager.t('subjects.noSubjects'))); return; }

        render(gridNode, subjects.map(subject => Cards.subject(subject, {
            subscribeButton: isAlumno ? buildSubscribeButton(subject) : null
        })));

        if (filterNode) {
            // Conserva la opcion "todas" y agrega las materias.
            render(filterNode, [
                el('option', { value: '', text: LanguageManager.t('catalog.allSubjects') }),
                ...subjects.map(s => el('option', { value: String(s.id), text: s.nombre }))
            ]);
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
                renderSubjects(await apiService.get('/subjects').then(r => r.subjects), subjectsGrid, subjectFilter);
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
            visibleCount = PAGE_SIZE;
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
        const total = allMaterials.length;
        const shown = Math.min(visibleCount, total);

        if (resultsLabel) {
            resultsLabel.textContent = total
                ? LanguageManager.t('filters.showing', { shown, total })
                : LanguageManager.t('common.noResults');
        }

        if (!total) {
            render(grid, Cards.empty(LanguageManager.t('common.noResults')));
        } else {
            render(grid, sortMaterials(allMaterials).slice(0, shown).map(m => Cards.material(m)));
        }

        if (loadMoreButton) loadMoreButton.classList.toggle('bt-hidden', shown >= total || total === 0);
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

    sortSelect?.addEventListener('change', applyAndRender);

    loadMoreButton?.addEventListener('click', () => {
        visibleCount += PAGE_SIZE;
        applyAndRender();
    });

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
