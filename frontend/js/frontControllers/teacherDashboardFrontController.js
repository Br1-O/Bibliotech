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
    const mySubjectsPagination = document.getElementById('mySubjectsPagination');
    const reviewNode = document.getElementById('pendingReview');
    const observerNode = document.getElementById('observerPanel');
    const tTagsInput = document.getElementById('tTags');
    if (tTagsInput && window.BTTagInput) window.BTTagInput(tTagsInput);
    let mySubjects = [];
    let subjectPage = 1;
    let myUploadsControl = null;
    const SUBJECT_PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;
    const ACCEPT_BY_TYPE = {
        PDF: '.pdf,application/pdf',
        EPUB: '.epub,application/epub+zip',
        Word: '.doc,.docx',
        Presentacion: '.ppt,.pptx,.odp'
    };

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

    async function loadSubjects() {
        try {
            const { subjects } = await apiService.get('/subjects');
            mySubjects = subjects.filter(s => Cards.isSubjectProfessor(s, me.id) || authHelper.isRole('Superadmin'));
            render(subjectsSelect, mySubjects.map(s => el('option', { value: String(s.id), text: s.nombre })));
            renderMySubjects();
        } catch (error) { Toast.error(error.message); }
    }

    function renderMySubjects() {
        if (!mySubjectsNode) return;
        const total = mySubjects.length;
        if (!total) {
            render(mySubjectsNode, Cards.empty(LanguageManager.t('teacher.noSubjects')));
            Pagination.render(mySubjectsPagination, { total: 0, pageSize: SUBJECT_PAGE_SIZE });
            return;
        }
        const totalPages = Pagination.totalPages(total, SUBJECT_PAGE_SIZE);
        if (subjectPage > totalPages) subjectPage = totalPages;
        const start = (subjectPage - 1) * SUBJECT_PAGE_SIZE;
        const pageItems = mySubjects.slice(start, start + SUBJECT_PAGE_SIZE);

        render(mySubjectsNode, pageItems.map(s => Cards.subject(s, {
            subscribeButton: el('bt-button', {
                size: 'sm', variant: 'secondary', label: LanguageManager.t('teacher.observers'),
                on: { click: () => loadObservers(s) }
            })
        })));

        Pagination.render(mySubjectsPagination, {
            page: subjectPage,
            total,
            pageSize: SUBJECT_PAGE_SIZE,
            onChange: (page) => { subjectPage = page; renderMySubjects(); }
        });
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
            Toast.success(LanguageManager.tr(result.message));
            loadObservers(subject);
        } catch (error) { Toast.error(error.message); }
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
            el('div', { className: 'bt-row', style: { gap: '6px' } }, Cards.tagChips(material.categories)),
            actions
        ]);
    }

    async function review(material, action) {
        try {
            await apiService.post(`/materials/${material.id}/${action}`, { subjectId: material.subjectId });
            Toast.success(LanguageManager.t(action === 'approve' ? 'messages.materialApproved' : 'messages.associationRejected'));
            loadReview();
            loadSubjects();
        } catch (error) { Toast.error(error.message); }
    }

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const file = form.querySelector('[name="archivo"]').files[0];
        const cover = form.querySelector('[name="portada"]')?.files[0];
        const urlOrPath = (data.get('urlOrPath') || '').trim();
        const selected = Array.from(subjectsSelect.selectedOptions).map(o => o.value);

        Validator.clear(form);
        const valid = Validator.on(form)
            .required('titulo', LanguageManager.t('material.title'))
            .minLength('titulo', 3, LanguageManager.t('material.title'))
            .validateThis()
            .show();
        if (!valid) return;
        if (!selected.length) {
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
        payload.append('descripcion', data.get('descripcion') || '');
        payload.append('categories', data.get('categories') || '');
        payload.append('subjects', selected.join(','));
        if (file) payload.append('archivo', file);
        else payload.append('urlOrPath', urlOrPath);
        if (cover) payload.append('portada', cover);

        const btn = form.querySelector('bt-button');
        try {
            btn.setLoading(true);
            const result = await apiService.upload('/materials/upload', payload);
            Toast.success(LanguageManager.tr(result.message));
            form.reset();
            loadSubjects();
            if (myUploadsControl) myUploadsControl.reload();
        } catch (error) {
            if (!Validator.applyServerErrors(form, error)) Toast.error(error.message);
        } finally {
            btn.setLoading(false);
        }
    });

    myUploadsControl = MyUploads.mount({ container: document.getElementById('myUploads') });

    (async () => {
        await loadSubjects();
        await loadReview();
    })();
    LanguageManager.onChange(() => {
        loadSubjects();
        loadReview();
        myUploadsControl = MyUploads.mount({ container: document.getElementById('myUploads') });
    });
});
