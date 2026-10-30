/**
* Project     : Bibliotech  |  Frontend - Controlador
* studentFrontController: panel del alumno. Sugerir material (limite 3),
* gestionar suscripciones (RF-03, RF-04).
*/

document.addEventListener('bt:ready', () => {
    const root = document.getElementById('studentDashboard');
    if (!root) return;

    if (!authHelper.requireAuth()) return;
    if (!authHelper.isRole('Alumno')) { window.location.href = authHelper.panelRoute(); return; }

    ProfileSummary.mount(document.getElementById('profileSummary'));

    const pendingList = document.getElementById('pendingList');
    const subscriptionsList = document.getElementById('subscriptionsList');
    const subscriptionsPagination = document.getElementById('subscriptionsPagination');
    const form = document.getElementById('materialForm');
    const subjectsSelect = document.getElementById('materialSubjects');
    const categorySelect = document.getElementById('matCategory');
    const tagsInput = document.getElementById('matTags');
    if (tagsInput && window.BTTagInput) window.BTTagInput(tagsInput);

    const SUBSCRIPTION_PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;
    const ACCEPT_BY_TYPE = {
        PDF: '.pdf,application/pdf',
        EPUB: '.epub,application/epub+zip',
        Word: '.doc,.docx',
        Presentacion: '.ppt,.pptx,.odp'
    };
    let allSubscriptions = [];
    let subscriptionPage = 1;

    populateSubjects();
    populateCategories();
    setupTypeToggle(form);

    /** Muestra archivo o enlace segun el tipo elegido (solo se envia uno). */
    function setupTypeToggle(formNode) {
        const tipo = formNode?.querySelector('[name="tipo"]');
        const fileField = formNode?.querySelector('[data-mode="file"]');
        const linkField = formNode?.querySelector('[data-mode="link"]');
        if (!tipo || !fileField || !linkField) return;

        const sync = () => {
            const isLink = ['Link_Drive', 'Youtube', 'Repositorio'].includes(tipo.value);
            fileField.classList.toggle('bt-hidden', isLink);
            linkField.classList.toggle('bt-hidden', !isLink);
            const fileInput = fileField.querySelector('input');
            const linkInput = linkField.querySelector('input');
            if (fileInput) {
                fileInput.disabled = isLink;
                fileInput.setAttribute('accept', ACCEPT_BY_TYPE[tipo.value] || '');
                if (isLink) fileInput.value = '';
            }
            if (linkInput) { linkInput.disabled = !isLink; if (!isLink) linkInput.value = ''; }
        };
        tipo.addEventListener('change', sync);
        sync();
    }

    async function populateCategories() {
        if (!categorySelect) return;
        try {
            const options = await apiService.get('/materials/filters');
            const current = categorySelect.value || 'technical';
            render(categorySelect, (options.categories || []).map(category => el('option', {
                value: category.slug,
                text: LanguageManager.t(`material.categories.${category.slug}`)
            })));
            categorySelect.value = current;
        } catch (error) { /* La categoria tecnica sigue disponible por defecto. */ }
    }

    async function populateSubjects() {
        try {
            const { subjects } = await apiService.get('/subjects');
            render(subjectsSelect, subjects.map(s =>
                el('option', { value: String(s.id), text: s.nombre })));
        } catch (error) { Toast.error(error.message); }
    }

    async function loadPending() {
        try {
            const { materials } = await apiService.get('/materials/pending');
            updateStats(materials.length);
            if (!materials.length) {
                render(pendingList, Cards.empty(LanguageManager.t('student.noPending')));
                return;
            }
            render(pendingList, materials.map(m => Cards.material(m, {
                showState: true,
                onCancel: () => cancelPending(m.id)
            })));
        } catch (error) { Toast.error(error.message); }
    }

    async function loadSubscriptions() {
        try {
            const { subscriptions } = await apiService.get('/subscriptions/mine');
            allSubscriptions = subscriptions || [];
            const badge = document.getElementById('subscriptionCount');
            if (badge) badge.textContent = allSubscriptions.length;
            renderSubscriptions();
        } catch (error) { Toast.error(error.message); }
    }

    function renderSubscriptions() {
        if (!subscriptionsList) return;
        const total = allSubscriptions.length;
        if (!total) {
            render(subscriptionsList, Cards.empty(LanguageManager.t('student.noSubscriptions')));
            Pagination.render(subscriptionsPagination, { total: 0, pageSize: SUBSCRIPTION_PAGE_SIZE });
            return;
        }
        const totalPages = Pagination.totalPages(total, SUBSCRIPTION_PAGE_SIZE);
        if (subscriptionPage > totalPages) subscriptionPage = totalPages;
        const start = (subscriptionPage - 1) * SUBSCRIPTION_PAGE_SIZE;
        const pageItems = allSubscriptions.slice(start, start + SUBSCRIPTION_PAGE_SIZE);

        render(subscriptionsList, pageItems.map(s => {
            const subjectId = s.materiaId ?? s.materia_id;
            const subjectName = s.materiaNombre || s.materia_nombre || `Materia #${subjectId}`;
            return el('div', { className: 'bt-row bt-between bt-panel' }, [
                el('div', { className: 'bt-stack', style: { gap: '2px' } }, [
                    el('a', { text: subjectName, attrs: { href: `/materia/${subjectId}` } }),
                    el('span', { className: 'bt-card__meta', text: s.profesorNombre || s.profesor_nombre || '' })
                ]),
                el('div', { className: 'bt-row', style: { gap: 'var(--space-2)' } }, [
                    el('span', { className: `bt-badge bt-badge--${s.estado === 'Baneado' ? 'danger' : 'success'}`, text: s.estado }),
                    el('bt-button', {
                        size: 'sm', variant: 'ghost', label: LanguageManager.t('subjects.unsubscribe'),
                        on: { click: () => unsubscribe(subjectId) }
                    })
                ])
            ]);
        }));

        Pagination.render(subscriptionsPagination, {
            page: subscriptionPage,
            total,
            pageSize: SUBSCRIPTION_PAGE_SIZE,
            onChange: (page) => { subscriptionPage = page; renderSubscriptions(); }
        });
    }

    async function unsubscribe(subjectId) {
        const confirmed = await Modal.confirm({
            title: LanguageManager.t('subjects.unsubscribe'),
            message: LanguageManager.t('messages.deleteConfirm'),
            variant: 'danger'
        });
        if (!confirmed) return;
        try {
            await apiService.del(`/subscriptions/subscribe/${subjectId}`);
            Toast.success(LanguageManager.t('messages.unsubscribed'));
            await loadSubscriptions();
        } catch (error) { Toast.error(error.message); }
    }

    function updateStats(pendingCount) {
        const pending = document.getElementById('pendingCount');
        if (pending) pending.textContent = pendingCount;
        const limit = document.getElementById('pendingLimit');
        if (limit) limit.textContent = LanguageManager.t('student.limit', { used: pendingCount, max: 3 });
    }

    async function cancelPending(id) {
        const confirmed = await Modal.confirm({
            title: LanguageManager.t('material.cancel'),
            message: LanguageManager.t('messages.deleteConfirm'),
            variant: 'danger'
        });
        if (!confirmed) return;
        try {
            await apiService.post(`/materials/${id}/cancel`);
            Toast.success(LanguageManager.t('messages.materialCancelled'));
            loadPending();
        } catch (error) { Toast.error(error.message); }
    }

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const file = form.querySelector('[name="archivo"]').files[0];
        const cover = form.querySelector('[name="portada"]')?.files[0];
        const urlOrPath = (data.get('urlOrPath') || '').trim();
        const selectedSubjects = Array.from(subjectsSelect.selectedOptions).map(o => o.value);

        Validator.clear(form);
        const valid = Validator.on(form)
            .required('titulo', LanguageManager.t('material.title'))
            .minLength('titulo', 3, LanguageManager.t('material.title'))
            .validateThis()
            .show();
        if (!valid) return;
        if (!selectedSubjects.length) {
            Toast.error(LanguageManager.t('validation.required', { field: LanguageManager.t('material.subjects') }));
            return;
        }

        if (!file && !urlOrPath) {
            Toast.error(LanguageManager.t('validation.required', { field: LanguageManager.t('material.file') }));
            return;
        }

        const payload = new FormData();
        payload.append('titulo', data.get('titulo'));
        payload.append('tipo', data.get('tipo'));
        payload.append('author', data.get('author') || '');
        payload.append('category', data.get('category') || 'technical');
        payload.append('pages', data.get('pages') || '');
        payload.append('descripcion', data.get('descripcion') || '');
        payload.append('categories', data.get('categories') || '');
        payload.append('subjects', selectedSubjects.join(','));
        if (file) payload.append('archivo', file);
        else payload.append('urlOrPath', urlOrPath);
        if (cover) payload.append('portada', cover);

        const btn = form.querySelector('bt-button');
        try {
            btn.setLoading(true);
            const result = await apiService.upload('/materials/upload', payload);
            Toast.success(LanguageManager.tr(result.message));
            form.reset();
            loadPending();
        } catch (error) {
            if (!Validator.applyServerErrors(form, error)) Toast.error(error.message);
        } finally {
            btn.setLoading(false);
        }
    });
    loadPending();
    loadSubscriptions();
    // Refresca el panel cuando cambia el idioma.
    LanguageManager.onChange(() => {
        loadPending();
        loadSubscriptions();
    });
});
