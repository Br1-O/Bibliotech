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
    const PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;
    let allMaterials = [];
    let currentPage = 1;
    let debounce;
    let canManage = false;
    const canFavorite = authHelper.isAuthenticated();
    const me = authHelper.getUser() || {};
    const isAdmin = authHelper.isRole('Superadmin');

    function canEditMaterial(material) {
        if (!authHelper.isRole('Profesor', 'Superadmin') || Cards.isInactive(material)) return false;
        if (Number(material.autorId) === Number(me.id)) return true;
        if (material.autorRol !== 'Alumno') return false;
        return isAdmin || canManage;
    }

    async function load() {
        Loader.skeletons(document.getElementById('subjectMaterials'), 3);
        try {
            const { subject } = await apiService.get(`/subjects/${subjectId}`);
            canManage = authHelper.isRole('Superadmin')
                || (authHelper.isRole('Profesor') && Cards.isSubjectProfessor(subject, me.id));
            container.dataset.profesorId = subject.profesorId || '';
            renderHeadline(subject);
            await loadMaterials();
        } catch (error) {
            render(container, Cards.empty(error.message));
        }
    }

    function renderHeadline(subject) {
        const professors = Array.isArray(subject.profesores) && subject.profesores.length
            ? subject.profesores
            : (subject.profesorNombre
                ? [{ id: subject.profesorId, nombreCompleto: subject.profesorNombre }]
                : []);
        const isAlumno = authHelper.isRole('Alumno');

        const actions = el('div', { className: 'bt-headline__actions' });
        if (isAlumno) actions.appendChild(buildSubscribeButton(subject));

        const teacherRow = professors.length
            ? el('div', { className: 'bt-headline__teachers' }, [
                el('span', { className: 'bt-badge bt-badge--teacher', text: LanguageManager.t('subjects.teachers') }),
                ...professors.map(professor => el('a', {
                    className: 'bt-teacher-link',
                    text: professor.nombreCompleto || `${professor.nombre || ''} ${professor.apellido || ''}`.trim(),
                    attrs: { href: `/autor/${professor.id}` }
                }))
            ])
            : el('span', { className: 'bt-badge bt-badge--info', text: LanguageManager.t('subject.noTeacher') });

        const headline = el('div', { className: 'bt-headline bt-stack' }, [
            el('h1', { text: subject.nombre }),
            el('p', { className: 'bt-text-muted', text: subject.descripcion || '' }),
            el('div', { className: 'bt-row bt-between bt-wrap', style: { gap: 'var(--space-3)' } }, [
                teacherRow,
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

    /** Abre el editor modal; evita el estado bloqueado del panel anterior. */
    function openEditPanel(material) {
        if (!material || typeof MaterialEditor === 'undefined') return;
        MaterialEditor.open(material, async () => {
            await loadMaterials();
        });
    }

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
                onEdit: canEditMaterial(m) ? openEditPanel : null,
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
