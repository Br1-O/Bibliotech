/**
* Project     : Bibliotech  |  Frontend - Controlador
* subjectFrontController: detalle de una materia y su material (RF-04).
*/

document.addEventListener('bt:ready', () => {
    const container = document.getElementById('subjectDetail');
    if (!container) return;

    const subjectId = Number(window.location.pathname.split('/').filter(Boolean).pop());
    const searchInput = document.getElementById('subjectSearch');
    const sortSelect = document.getElementById('subjectSort');
    const clearButton = document.getElementById('subjectClear');
    const loadMoreButton = document.getElementById('subjectLoadMore');
    const resultsLabel = document.getElementById('subjectResults');
    const grid = document.getElementById('subjectMaterials');

    const PAGE_SIZE = 6;
    let allMaterials = [];
    let visibleCount = PAGE_SIZE;
    let debounce;

    async function load() {
        Loader.skeletons(document.getElementById('subjectMaterials'), 3);
        try {
            const { subject } = await apiService.get(`/subjects/${subjectId}`);
            renderHeadline(subject);
            await loadMaterials();
        } catch (error) {
            render(container, Cards.empty(error.message));
        }
    }

    function renderHeadline(subject) {
        const teacher = subject.profesorNombre || LanguageManager.t('subject.noTeacher');
        const isAlumno = authHelper.isRole('Alumno');

        const actions = el('div', { className: 'bt-headline__actions' });
        if (isAlumno) actions.appendChild(buildSubscribeButton(subject));

        const headline = el('div', { className: 'bt-headline bt-stack' }, [
            el('h1', { text: subject.nombre }),
            el('p', { className: 'bt-text-muted', text: subject.descripcion || '' }),
            el('div', { className: 'bt-row bt-between' }, [
                el('span', {
                    className: `bt-badge ${subject.profesorNombre ? 'bt-badge--teacher' : 'bt-badge--subject'}`,
                    text: `${LanguageManager.t('subject.teacher')}: ${teacher}`
                }),
                actions
            ])
        ]);
        render(container, headline);
    }

    function buildSubscribeButton(subject) {
        const btn = el('bt-button', { variant: 'success', label: LanguageManager.t('subject.subscribe') });
        apiService.get('/subscriptions/mine').then(({ subscriptions }) => {
            const subscribed = subscriptions.some(s => String(s.materia_id) === String(subject.id));
            btn.setAttribute('variant', subscribed ? 'secondary' : 'success');
            btn.setAttribute('label', LanguageManager.t(subscribed ? 'subject.subscribed' : 'subject.subscribe'));
        });
        btn.addEventListener('click', async () => {
            const subscribed = btn.getAttribute('variant') === 'secondary';
            try {
                btn.setLoading(true);
                if (subscribed) {
                    await apiService.del(`/subscriptions/subscribe/${subject.id}`);
                    Toast.success(LanguageManager.t('messages.unsubscribed'));
                } else {
                    await apiService.post(`/subscriptions/subscribe/${subject.id}`, {});
                    Toast.success(LanguageManager.t('messages.subscribed'));
                }
                await load();
            } catch (error) {
                Toast.error(error.message);
            } finally {
                btn.setLoading(false);
            }
        });
        return btn;
    }

    async function loadMaterials() {
        Loader.skeletons(grid, 3);
        try {
            const result = await apiService.get(`/subjects/${subjectId}/materials`, { q: searchInput?.value || '' });
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
            resultsLabel.textContent = total ? LanguageManager.t('filters.showing', { shown, total }) : '';
        }

        if (!total) {
            render(grid, Cards.empty(LanguageManager.t('subject.noMaterials')));
        } else {
            render(grid, sortMaterials(allMaterials).slice(0, shown).map(m => Cards.material(m)));
        }
        if (loadMoreButton) loadMoreButton.classList.toggle('bt-hidden', shown >= total || total === 0);
    }

    searchInput?.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(loadMaterials, 300);
    });
    sortSelect?.addEventListener('change', applyAndRender);
    loadMoreButton?.addEventListener('click', () => { visibleCount += PAGE_SIZE; applyAndRender(); });
    clearButton?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (sortSelect) sortSelect.value = 'newest';
        loadMaterials();
    });

    load();
});
