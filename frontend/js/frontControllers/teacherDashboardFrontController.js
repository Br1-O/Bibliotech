/**
* Project     : Bibliotech  |  Frontend - Controlador
* teacherFrontController: panel del profesor. Publicar material, revisar
* sugerencias de alumnos y gestionar sus materias (RF-02, RF-04, RF-05).
*/

document.addEventListener('bt:ready', () => {
    const root = document.getElementById('teacherDashboard');
    if (!root) return;

    if (!authHelper.requireAuth()) return;
    if (!authHelper.isRole('Profesor', 'Superadmin')) { window.location.href = authHelper.panelRoute(); return; }

    const me = authHelper.getUser() || {};
    const form = document.getElementById('teacherMaterialForm');
    const subjectsSelect = document.getElementById('teacherMaterialSubjects');
    const mySubjectsNode = document.getElementById('mySubjects');
    const reviewNode = document.getElementById('pendingReview');
    const observerNode = document.getElementById('observerPanel');
    const existingNode = document.getElementById('existingMaterials');
    let mySubjects = [];

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

    async function loadSubjects() {
        try {
            const { subjects } = await apiService.get('/subjects');
            mySubjects = subjects.filter(s => s.profesorId === me.id || authHelper.isRole('Superadmin'));
            render(subjectsSelect, mySubjects.map(s => el('option', { value: String(s.id), text: s.nombre })));
            renderMySubjects();
        } catch (error) { Toast.error(error.message); }
    }

    function renderMySubjects() {
        if (!mySubjects.length) { render(mySubjectsNode, Cards.empty(LanguageManager.t('teacher.noSubjects'))); return; }
        render(mySubjectsNode, mySubjects.map(s => Cards.subject(s, {
            subscribeButton: el('bt-button', {
                size: 'sm', variant: 'secondary', label: LanguageManager.t('teacher.observers'),
                on: { click: () => loadObservers(s) }
            })
        })));
    }

    /** RF-05.1: lista de alumnos suscriptos con opcion de baneo. */
    async function loadObservers(subject) {
        if (!observerNode) return;
        Loader.skeletons(observerNode, 2);
        try {
            const { observers } = await apiService.get(`/subscriptions/subject/${subject.id}/observers`);
            const header = el('h3', { text: `${LanguageManager.t('teacher.observers')}: ${subject.nombre}` });
            if (!observers.length) {
                render(observerNode, [header, Cards.empty(LanguageManager.t('common.noResults'))]);
                return;
            }
            const rows = observers.map(o => el('div', { className: 'bt-panel bt-row bt-between' }, [
                el('div', {}, [
                    el('strong', { text: `${o.nombre} ${o.apellido}` }),
                    el('span', { className: 'bt-card__meta', text: ` ${o.email}` })
                ]),
                el('bt-button', {
                    size: 'sm', variant: 'danger', label: LanguageManager.t('teacher.ban'),
                    on: { click: () => banObserver(o, subject) }
                })
            ]));
            render(observerNode, [header, ...rows]);
        } catch (error) { Toast.error(error.message); }
    }

    async function banObserver(observer, subject) {
        try {
            const result = await apiService.post(`/subscriptions/ban/${observer.alumnoId}/${subject.id}`);
            Toast.success(result.message);
            loadObservers(subject);
        } catch (error) { Toast.error(error.message); }
    }

    /** RF-04.2: asociar material existente a una materia propia. */
    async function loadExisting() {
        if (!existingNode) return;
        Loader.skeletons(existingNode, 3);
        try {
            const { materials } = await apiService.get('/materials/global');
            if (!materials.length) { render(existingNode, Cards.empty(LanguageManager.t('common.noResults'))); return; }
            render(existingNode, materials.map(m => associateCard(m)));
        } catch (error) { Toast.error(error.message); }
    }

    function associateCard(material) {
        const select = el('select', { className: 'bt-select' }, mySubjects.map(s =>
            el('option', { value: String(s.id), text: s.nombre })));

        const btn = el('bt-button', {
            size: 'sm', variant: 'secondary', label: LanguageManager.t('material.associated'),
            on: {
                click: async () => {
                    if (!select.value) { Toast.error(LanguageManager.t('teacher.selectSubject')); return; }
                    try {
                        btn.setLoading(true);
                        const result = await apiService.post(`/materials/${material.id}/associate`, { subjectId: Number(select.value) });
                        Toast.success(result.message);
                    } catch (error) { Toast.error(error.message); } finally { btn.setLoading(false); }
                }
            }
        });

        return el('div', { className: 'bt-panel bt-stack' }, [
            el('div', { className: 'bt-row bt-between' }, [
                el('div', {}, [
                    el('h3', { className: 'bt-card__title', text: material.titulo }),
                    el('span', { className: 'bt-card__meta', text: (material.materias || []).join(', ') })
                ]),
                Cards.typeBadge(material.tipo)
            ]),
            el('div', { className: 'bt-row', style: { gap: 'var(--space-2)' } }, [select, btn])
        ]);
    }

    async function loadReview() {
        try {
            const { materials } = await apiService.get('/materials/pending-review');
            if (!materials.length) { render(reviewNode, Cards.empty(LanguageManager.t('common.noResults'))); return; }

            render(reviewNode, materials.map(m => {
                const actions = el('div', { className: 'bt-row', style: { gap: 'var(--space-2)' } }, [
                    el('bt-button', {
                        size: 'sm', variant: 'success', label: LanguageManager.t('material.approve'),
                        on: { click: () => review(m, 'approve') }
                    }),
                    el('bt-button', {
                        size: 'sm', variant: 'danger', label: LanguageManager.t('material.reject'),
                        on: { click: () => review(m, 'reject') }
                    })
                ]);
                return wrapReviewCard(m, actions);
            }));
        } catch (error) { Toast.error(error.message); }
    }

    function wrapReviewCard(material, actions) {
        return el('div', { className: 'bt-panel bt-stack' }, [
            el('div', { className: 'bt-row bt-between' }, [
                el('div', {}, [
                    el('h3', { className: 'bt-card__title', text: material.titulo }),
                    el('span', { className: 'bt-card__meta', text: `${material.autorNombre} · ${material.subjectNombre}` })
                ]),
                Cards.typeBadge(material.tipo)
            ]),
            el('div', { className: 'bt-row', style: { gap: '6px' } }, Cards.chips(material.categories)),
            actions
        ]);
    }

    async function review(material, action) {
        try {
            await apiService.post(`/materials/${material.id}/${action}`, { subjectId: material.subjectId });
            Toast.success(LanguageManager.t(action === 'approve' ? 'messages.materialApproved' : 'messages.associationRejected'));
            loadReview();
            loadSubjects();
            loadExisting();
        } catch (error) { Toast.error(error.message); }
    }

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const file = form.querySelector('[name="archivo"]').files[0];
        const urlOrPath = (data.get('urlOrPath') || '').trim();
        const selected = Array.from(subjectsSelect.selectedOptions).map(o => o.value);

        const errors = Validator.validate([
            { name: 'titulo', label: LanguageManager.t('material.title'), value: data.get('titulo'), checks: [{ type: 'required' }] },
            { name: 'subjects', label: LanguageManager.t('material.subjects'), value: selected.join(','), checks: [{ type: 'required' }] }
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
        payload.append('subjects', selected.join(','));
        if (file) payload.append('archivo', file);
        else payload.append('urlOrPath', urlOrPath);

        const btn = form.querySelector('bt-button');
        try {
            btn.setLoading(true);
            const result = await apiService.upload('/materials/upload', payload);
            Toast.success(result.message);
            form.reset();
            loadSubjects();
            loadExisting();
        } catch (error) {
            Toast.error(error.message);
        } finally {
            btn.setLoading(false);
        }
    });

    (async () => {
        await loadSubjects();
        await Promise.all([loadReview(), loadExisting()]);
    })();
    LanguageManager.onChange(() => { loadSubjects(); loadReview(); loadExisting(); });
});
