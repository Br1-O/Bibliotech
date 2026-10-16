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

    const pendingList = document.getElementById('pendingList');
    const subscriptionsList = document.getElementById('subscriptionsList');
    const form = document.getElementById('materialForm');
    const subjectsSelect = document.getElementById('materialSubjects');

    populateSubjects();
    setupTypeToggle(form);

    /** Muestra archivo o enlace segun el tipo elegido (solo se envia uno). */
    function setupTypeToggle(formNode) {
        const tipo = formNode?.querySelector('[name="tipo"]');
        const fileField = formNode?.querySelector('[data-mode="file"]');
        const linkField = formNode?.querySelector('[data-mode="link"]');
        if (!tipo || !fileField || !linkField) return;

        const sync = () => {
            const isLink = tipo.value === 'Link_Drive' || tipo.value === 'Youtube';
            fileField.classList.toggle('bt-hidden', isLink);
            linkField.classList.toggle('bt-hidden', !isLink);
            const fileInput = fileField.querySelector('input');
            const linkInput = linkField.querySelector('input');
            if (fileInput) { fileInput.disabled = isLink; if (isLink) fileInput.value = ''; }
            if (linkInput) { linkInput.disabled = !isLink; if (!isLink) linkInput.value = ''; }
        };
        tipo.addEventListener('change', sync);
        sync();
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
            const badge = document.getElementById('subscriptionCount');
            if (badge) badge.textContent = subscriptions.length;

            if (!subscriptions.length) {
                render(subscriptionsList, Cards.empty(LanguageManager.t('student.noSubscriptions')));
                return;
            }
            render(subscriptionsList, subscriptions.map(s => el('div', { className: 'bt-row bt-between bt-panel' }, [
                el('a', { text: s.materiaNombre || `Materia #${s.materia_id}`, attrs: { href: `/materia/${s.materia_id}` } }),
                el('span', { className: `bt-badge bt-badge--${s.estado === 'Baneado' ? 'danger' : 'success'}`, text: s.estado })
            ])));
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
        const urlOrPath = (data.get('urlOrPath') || '').trim();
        const selectedSubjects = Array.from(subjectsSelect.selectedOptions).map(o => o.value);

        const errors = Validator.validate([
            { name: 'titulo', label: LanguageManager.t('material.title'), value: data.get('titulo'), checks: [{ type: 'required' }] },
            { name: 'subjects', label: LanguageManager.t('material.subjects'), value: selectedSubjects.join(','), checks: [{ type: 'required' }] }
        ]);
        if (!Validator.renderErrors(form, errors)) return;

        if (!file && !urlOrPath) {
            Toast.error(LanguageManager.t('validation.required', { field: LanguageManager.t('material.file') }));
            return;
        }

        const payload = new FormData();
        payload.append('titulo', data.get('titulo'));
        payload.append('tipo', data.get('tipo'));
        payload.append('descripcion', data.get('descripcion') || '');
        payload.append('categories', data.get('categories') || '');
        payload.append('subjects', selectedSubjects.join(','));
        if (file) payload.append('archivo', file);
        else payload.append('urlOrPath', urlOrPath);

        const btn = form.querySelector('bt-button');
        try {
            btn.setLoading(true);
            const result = await apiService.upload('/materials/upload', payload);
            Toast.success(result.message);
            form.reset();
            loadPending();
        } catch (error) {
            Toast.error(error.message);
        } finally {
            btn.setLoading(false);
        }
    });

    loadPending();
    loadSubscriptions();
    // Refresca el panel cuando cambia el idioma.
    LanguageManager.onChange(() => { loadPending(); loadSubscriptions(); });
});
