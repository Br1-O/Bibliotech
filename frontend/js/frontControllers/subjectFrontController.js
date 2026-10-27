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
    const paginationNode = document.getElementById('subjectPagination');
    const resultsLabel = document.getElementById('subjectResults');
    const grid = document.getElementById('subjectMaterials');
    const editPanel = document.getElementById('materialEditPanel');
    const editForm = document.getElementById('materialEditForm');
    const editTitulo = document.getElementById('materialEditTitulo');
    const editDesc = document.getElementById('materialEditDesc');
    const editCancel = document.getElementById('materialEditCancel');

    const PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;
    let allMaterials = [];
    let currentPage = 1;
    let debounce;
    let canManage = false;
    let editingMaterial = null;
    const canFavorite = authHelper.isAuthenticated();
    const me = authHelper.getUser() || {};

    async function load() {
        Loader.skeletons(document.getElementById('subjectMaterials'), 3);
        try {
            const { subject } = await apiService.get(`/subjects/${subjectId}`);
            canManage = authHelper.isRole('Superadmin')
                || (authHelper.isRole('Profesor') && Number(subject.profesorId) === Number(me.id));
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
        const btn = el('bt-button', { variant: 'success', 'label-i18n': 'subject.subscribe' });
        apiService.get('/subscriptions/mine').then(({ subscriptions }) => {
            const subscribed = subscriptions.some(s => String(s.materiaId ?? s.materia_id) === String(subject.id));
            btn.setAttribute('variant', subscribed ? 'secondary' : 'success');
            btn.setAttribute('label-i18n', subscribed ? 'subject.subscribed' : 'subject.subscribe');
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

    /** Abre el panel de edicion con los datos del material seleccionado. */
    function openEditPanel(material) {
        if (!editPanel || !editForm) return;
        editingMaterial = material;
        if (editTitulo) editTitulo.value = material.titulo || '';
        if (editDesc) editDesc.value = material.descripcion || '';
        editPanel.classList.remove('bt-hidden');
        editPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        editTitulo?.focus();
    }

    function closeEditPanel() {
        editingMaterial = null;
        editPanel?.classList.add('bt-hidden');
    }

    editForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!editingMaterial) return;
        Validator.clear(editForm);
        const valid = Validator.on(editForm)
            .required('titulo', LanguageManager.t('material.title'))
            .minLength('titulo', 3, LanguageManager.t('material.title'))
            .validateThis()
            .show();
        if (!valid) return;

        const btn = editForm.querySelector('bt-button');
        try {
            btn?.setLoading(true);
            const result = await apiService.put(`/materials/${editingMaterial.id}`, {
                titulo: editTitulo?.value || '',
                descripcion: editDesc?.value || ''
            });
            Toast.success(LanguageManager.tr(result.message));
            closeEditPanel();
            await loadMaterials();
        } catch (error) {
            if (!Validator.applyServerErrors(editForm, error)) Toast.error(error.message);
        } finally {
            btn?.setLoading(false);
        }
    });

    editCancel?.addEventListener('click', closeEditPanel);

    /** Quita el material de esta materia (y lo elimina si queda huerfano). */
    async function removeFromSubject(material) {
        const confirmed = await Modal.confirm({
            title: LanguageManager.t('material.removeFromSubject'),
            message: LanguageManager.t('material.removeConfirm'),
            variant: 'danger'
        });
        if (!confirmed) return;
        try {
            const result = await apiService.del(`/materials/${material.id}/subjects/${subjectId}`);
            Toast.success(LanguageManager.tr(result.message));
            if (editingMaterial && editingMaterial.id === material.id) closeEditPanel();
            await loadMaterials();
        } catch (error) {
            Toast.error(error.message);
        }
    }

    async function loadMaterials() {
        Loader.skeletons(grid, 3);
        try {
            const result = await apiService.get(`/subjects/${subjectId}/materials`, { q: searchInput?.value || '' });
            allMaterials = result.materials || [];
            currentPage = 1;
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
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * PAGE_SIZE;
        const shown = sorted.slice(start, start + PAGE_SIZE);

        if (resultsLabel) {
            resultsLabel.textContent = total ? LanguageManager.t('filters.showing', { shown: shown.length, total }) : '';
        }

        if (!total) {
            render(grid, Cards.empty(LanguageManager.t('subject.noMaterials')));
        } else {
            render(grid, shown.map(m => Cards.material(m, {
                onToggleFavorite: canFavorite ? (material) => Cards.toggleFavorite(material) : null,
                onEdit: canManage ? openEditPanel : null,
                onDelete: canManage ? removeFromSubject : null,
                deleteLabel: 'material.removeFromSubject'
            })));
        }

        Pagination.render(paginationNode, {
            page: currentPage,
            total,
            pageSize: PAGE_SIZE,
            onChange: (page) => { currentPage = page; applyAndRender(); }
        });
    }

    searchInput?.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(loadMaterials, 300);
    });
    sortSelect?.addEventListener('change', () => { currentPage = 1; applyAndRender(); });
    clearButton?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (sortSelect) sortSelect.value = 'newest';
        loadMaterials();
    });

    load();
});
