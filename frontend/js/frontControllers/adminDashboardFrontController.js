/**
* Project     : Bibliotech  |  Frontend - Controlador
* adminFrontController: panel del superadministrador. Usuarios, profesores,
* materias, solicitudes de asociacion y auditoria (RF-02, RF-06, RD-06).
*/

document.addEventListener('bt:ready', () => {
    const root = document.getElementById('adminDashboard');
    if (!root) return;

    if (!authHelper.requireAuth()) return;
    if (!authHelper.isRole('Superadmin')) { window.location.href = authHelper.panelRoute(); return; }

    const usersTable = document.getElementById('usersTable');
    const auditTable = document.getElementById('auditLog');
    const auditPagination = document.getElementById('auditPagination');
    const requestsNode = document.getElementById('associationRequests');
    const professorSelect = document.getElementById('subjectProfessor');
    const professorForm = document.getElementById('professorForm');
    const subjectForm = document.getElementById('adminSubjectForm');
    const subjectsGrid = document.getElementById('adminSubjectsGrid');
    const subjectsPagination = document.getElementById('adminSubjectsPagination');

    const subjectEditSelect = document.getElementById('subjectEditSelect');
    const editTitulo = document.getElementById('editTitulo');
    const editDesc = document.getElementById('editDesc');
    const editProfesor = document.getElementById('editProfesor');
    const editSubjectBtn = document.getElementById('editSubjectBtn');
    const tagsList = document.getElementById('thematicTagsList');

    const cache = { users: [], subjects: [], logs: [], tags: [] };
    const SUBJECT_PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;
    const AUDIT_PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;
    let subjectPage = 1;
    let auditPage = 1;

    const tr = (key) => LanguageManager.tr(key);

    async function loadAll() {
        await Promise.all([loadUsers(), loadSubjects(), loadAudit(), loadTags()]);
        updateStats();
    }

    function statusBadge(estado) {
        const map = {
            Activo: 'success',
            Baneado: 'danger',
            Inactivo: 'warning',
            PendienteVerificacion: 'warning'
        };
        return el('span', {
            className: `bt-badge bt-badge--${map[estado] || 'info'}`,
            text: tr(`userStates.${estado}`)
        });
    }

    async function loadUsers() {
        try {
            const { users } = await apiService.get('/auth/users');
            cache.users = users;
            renderUsers();
            const professors = users.filter(u => u.roleNombre === 'Profesor');
            render(professorSelect, [
                el('option', { value: '', text: LanguageManager.t('common.optional') }),
                ...professors.map(p => el('option', { value: String(p.id), text: `${p.nombre} ${p.apellido}` }))
            ]);
            renderEditProfessorOptions();
        } catch (error) { Toast.error(error.message); }
    }

    function renderUsers() {
        if (!usersTable) return;
        render(usersTable, cache.users.map(u => {
            const actions = [];
            if (u.estado === 'Baneado') {
                actions.push(el('bt-button', {
                    size: 'sm', variant: 'success', label: LanguageManager.t('auth.unban'),
                    on: { click: () => unbanUser(u.id) }
                }));
            } else if (u.estado !== 'Inactivo') {
                actions.push(el('bt-button', {
                    size: 'sm', variant: 'danger', label: LanguageManager.t('auth.ban'),
                    on: { click: () => banUser(u.id) }
                }));
            }
            if (u.estado !== 'Inactivo' && u.roleNombre === 'Profesor') {
                actions.push(el('bt-button', {
                    size: 'sm', variant: 'secondary', label: LanguageManager.t('common.delete'),
                    on: { click: () => softDeleteUser(u.id) }
                }));
            }
            return el('tr', {}, [
                el('td', { text: u.nombre }),
                el('td', { text: u.apellido }),
                el('td', { text: u.email }),
                el('td', {}, [el('span', {
                    className: `bt-badge ${u.roleNombre === 'Profesor' ? 'bt-badge--teacher' : 'bt-badge--subject'}`,
                    text: LanguageManager.t(`roles.${u.roleNombre}`)
                })]),
                el('td', {}, [statusBadge(u.estado || 'Activo')]),
                el('td', {}, actions)
            ]);
        }));
    }

    async function loadSubjects() {
        try {
            const { subjects } = await apiService.get('/subjects');
            cache.subjects = subjects;
            renderSubjectCards();
            renderSubjectEditOptions();
            renderRequests();
            updateStats();
        } catch (error) { Toast.error(error.message); }
    }

    function renderSubjectCards() {
        if (!subjectsGrid) return;
        const total = cache.subjects.length;
        if (!total) {
            render(subjectsGrid, Cards.empty(LanguageManager.t('subjects.noSubjects')));
            Pagination.render(subjectsPagination, { total: 0, pageSize: SUBJECT_PAGE_SIZE });
            return;
        }
        const totalPages = Pagination.totalPages(total, SUBJECT_PAGE_SIZE);
        if (subjectPage > totalPages) subjectPage = totalPages;
        const start = (subjectPage - 1) * SUBJECT_PAGE_SIZE;
        const pageItems = cache.subjects.slice(start, start + SUBJECT_PAGE_SIZE);

        render(subjectsGrid, pageItems.map(s => Cards.subject(s, {
            hideViewMaterials: true,
            editButton: el('bt-button', {
                size: 'sm', variant: 'accent', label: LanguageManager.t('common.edit'),
                on: { click: () => selectSubjectForEdit(s.id) }
            })
        })));

        Pagination.render(subjectsPagination, {
            page: subjectPage,
            total,
            pageSize: SUBJECT_PAGE_SIZE,
            onChange: (page) => { subjectPage = page; renderSubjectCards(); }
        });
    }

    function renderSubjectEditOptions() {
        if (!subjectEditSelect) return;
        const current = subjectEditSelect.value;
        render(subjectEditSelect, cache.subjects.map(s =>
            el('option', { value: String(s.id), text: s.nombre })));
        const next = current && cache.subjects.some(s => String(s.id) === current)
            ? current
            : (cache.subjects[0] ? String(cache.subjects[0].id) : '');
        subjectEditSelect.value = next;
        if (next) loadSubjectEditFields(next);
    }

    function renderEditProfessorOptions() {
        if (!editProfesor) return;
        const current = editProfesor.value;
        render(editProfesor, [
            el('option', { value: '', text: LanguageManager.t('subject.noTeacher') }),
            ...cache.users.filter(u => u.roleNombre === 'Profesor').map(p =>
                el('option', { value: String(p.id), text: `${p.nombre} ${p.apellido}` }))
        ]);
        editProfesor.value = current;
    }

    function selectSubjectForEdit(id) {
        if (subjectEditSelect) subjectEditSelect.value = String(id);
        loadSubjectEditFields(id);
        document.getElementById('subjectEditPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function loadSubjectEditFields(id) {
        const s = cache.subjects.find(x => String(x.id) === String(id));
        if (!s) return;
        Validator.clear(document.getElementById('subjectEditPanel'));
        if (editTitulo) editTitulo.value = s.nombre || '';
        if (editDesc) editDesc.value = s.descripcion || '';
        renderEditProfessorOptions();
        if (editProfesor) editProfesor.value = s.profesorId ? String(s.profesorId) : '';
    }

    function renderRequests() {
        if (!requestsNode) return;
        const pending = cache.subjects.filter(s => s.estadoAsociacion === 'Pendiente');
        if (!pending.length) { render(requestsNode, Cards.empty(LanguageManager.t('admin.noRequests'))); return; }

        render(requestsNode, pending.map(s => el('div', { className: 'bt-panel bt-row bt-between' }, [
            el('div', {}, [
                el('strong', { text: s.nombre }),
                el('p', { className: 'bt-card__meta', text: `${LanguageManager.t('subjects.teacher')}: ${s.profesorNombre || '-'}` })
            ]),
            el('div', { className: 'bt-row', style: { gap: 'var(--space-2)' } }, [
                el('bt-button', { size: 'sm', variant: 'success', label: LanguageManager.t('admin.approve'), on: { click: () => resolveRequest(s, 'confirm-association') } }),
                el('bt-button', { size: 'sm', variant: 'danger', label: LanguageManager.t('admin.reject'), on: { click: () => resolveRequest(s, 'reject-association') } })
            ])
        ])));
    }

    async function loadAudit() {
        try {
            const { logs } = await apiService.get('/audit');
            cache.logs = logs;
            renderAuditLogs();
        } catch (error) { Toast.error(error.message); }
    }

    function operationLabel(operation) {
        return tr(`audit.operations.${operation}`);
    }

    function renderAuditLogs() {
        if (!auditTable) return;
        const logs = cache.logs || [];
        if (!logs.length) {
            render(auditTable, [el('tr', {}, [
                el('td', { attrs: { colspan: '4' }, text: LanguageManager.t('common.noResults') })
            ])]);
            Pagination.render(auditPagination, { total: 0, pageSize: AUDIT_PAGE_SIZE });
            return;
        }
        const totalPages = Pagination.totalPages(logs.length, AUDIT_PAGE_SIZE);
        if (auditPage > totalPages) auditPage = totalPages;
        const start = (auditPage - 1) * AUDIT_PAGE_SIZE;
        const pageItems = logs.slice(start, start + AUDIT_PAGE_SIZE);

        render(auditTable, pageItems.map(l => {
            const targetName = l.registroNombre || (l.registroId != null ? `#${l.registroId}` : '-');
            const target = el('div', { className: 'bt-audit__target' }, [
                l.registroTipo && el('span', {
                    className: 'bt-badge bt-badge--subject',
                    text: tr(`audit.types.${l.registroTipo}`)
                }),
                el('span', { className: 'bt-audit__target-name', text: targetName })
            ].filter(Boolean));

            const userCell = el('div', { className: 'bt-stack', style: { gap: '2px' } }, [
                el('span', { text: l.usuarioNombre || (l.usuarioId != null ? `#${l.usuarioId}` : '-') }),
                l.usuarioEmail && el('span', { className: 'bt-card__meta', text: l.usuarioEmail })
            ].filter(Boolean));

            return el('tr', {}, [
                el('td', {}, [el('span', { className: 'bt-audit__operation', text: operationLabel(l.tipoOperacion) })]),
                el('td', {}, [userCell]),
                el('td', {}, [target]),
                el('td', {}, [el('span', {
                    className: 'bt-audit__date',
                    text: l.timestamp ? new Date(l.timestamp).toLocaleString(LanguageManager.language) : ''
                })])
            ]);
        }));

        Pagination.render(auditPagination, {
            page: auditPage,
            total: logs.length,
            pageSize: AUDIT_PAGE_SIZE,
            onChange: (page) => { auditPage = page; renderAuditLogs(); }
        });
    }

    function updateStats() {
        const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
        set('adminStatUsers', cache.users.length);
        set('adminStatSubjects', cache.subjects.length);
        set('adminStatRequests', cache.subjects.filter(s => s.estadoAsociacion === 'Pendiente').length);
    }

    async function resolveRequest(subject, action) {
        try {
            await apiService.post(`/subjects/${subject.id}/${action}`, action === 'confirm-association' ? { profesorId: subject.profesorId } : {});
            Toast.success(LanguageManager.t(action === 'confirm-association' ? 'messages.associationConfirmed' : 'messages.associationRejected'));
            await Promise.all([loadSubjects(), loadAudit()]);
        } catch (error) { Toast.error(error.message); }
    }

    async function banUser(id) {
        try {
            await apiService.put(`/auth/users/${id}/ban`, {});
            await Promise.all([loadUsers(), loadAudit()]);
        } catch (error) { Toast.error(error.message); }
    }

    async function unbanUser(id) {
        try {
            await apiService.put(`/auth/users/${id}/unban`, {});
            await Promise.all([loadUsers(), loadAudit()]);
        } catch (error) { Toast.error(error.message); }
    }

    async function softDeleteUser(id) {
        const confirmed = await Modal.confirm({
            title: LanguageManager.t('common.delete'),
            message: LanguageManager.t('messages.deleteConfirm'),
            variant: 'danger'
        });
        if (!confirmed) return;
        try {
            await apiService.del(`/auth/users/${id}`);
            await Promise.all([loadUsers(), loadAudit()]);
        } catch (error) { Toast.error(error.message); }
    }

    async function loadTags() {
        if (!tagsList) return;
        try {
            const { tags } = await apiService.get('/thematic-tags');
            cache.tags = tags;
            if (!tags.length) { render(tagsList, [el('p', { text: LanguageManager.t('admin.noTags') })]); return; }
            render(tagsList, tags.map(t => el('div', { className: 'bt-row bt-between bt-panel' }, [
                el('span', { text: `${t.nombre} (${t.categoria})` }),
                el('div', { className: 'bt-row', style: { gap: 'var(--space-2)' } }, [
                    el('bt-button', { size: 'sm', variant: 'danger', label: LanguageManager.t('common.delete'), on: { click: () => removeTag(t.id) } }),
                    t.baneado
                        ? el('span', { className: 'bt-badge bt-badge--danger', text: LanguageManager.t('teacher.ban') })
                        : el('bt-button', { size: 'sm', variant: 'warning', label: LanguageManager.t('teacher.ban'), on: { click: () => banTag(t.id) } })
                ])
            ])));
        } catch (error) { Toast.error(error.message); }
    }

    async function removeTag(id) {
        try {
            await apiService.del(`/thematic-tags/${id}`);
            await loadTags();
        } catch (error) { Toast.error(error.message); }
    }

    async function banTag(id) {
        try {
            await apiService.put(`/thematic-tags/${id}/ban`, {});
            await loadTags();
        } catch (error) { Toast.error(error.message); }
    }

    professorForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        Validator.clear(professorForm);

        const data = Object.fromEntries(new FormData(professorForm).entries());
        const valid = Validator.on(professorForm)
            .required('nombre', LanguageManager.t('auth.firstName'))
            .minLength('nombre', 2, LanguageManager.t('auth.firstName'))
            .required('apellido', LanguageManager.t('auth.lastName'))
            .minLength('apellido', 2, LanguageManager.t('auth.lastName'))
            .required('email', LanguageManager.t('auth.email'))
            .email('email', LanguageManager.t('auth.email'))
            .required('password', LanguageManager.t('auth.password'))
            .password('password', LanguageManager.t('auth.password'))
            .validateThis()
            .show();
        if (!valid) return;

        const btn = professorForm.querySelector('bt-button');
        try {
            btn.setLoading(true);
            const result = await apiService.post('/auth/professors', data);
            Toast.success(tr(result.message));
            professorForm.reset();
            await Promise.all([loadUsers(), loadAudit()]);
        } catch (error) {
            if (!Validator.applyServerErrors(professorForm, error)) Toast.error(error.message);
        } finally { btn.setLoading(false); }
    });

    subjectForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        Validator.clear(subjectForm);

        const data = Object.fromEntries(new FormData(subjectForm).entries());
        const valid = Validator.on(subjectForm)
            .required('nombre', LanguageManager.t('subjects.name'))
            .minLength('nombre', 2, LanguageManager.t('subjects.name'))
            .maxLength('nombre', 100, LanguageManager.t('subjects.name'))
            .validateThis()
            .show();
        if (!valid) return;

        const btn = subjectForm.querySelector('bt-button');
        try {
            btn.setLoading(true);
            const result = await apiService.post('/subjects', {
                nombre: data.nombre,
                descripcion: data.descripcion || null,
                profesorId: data.profesorId ? Number(data.profesorId) : null
            });
            Toast.success(tr(result.message));
            subjectForm.reset();
            await Promise.all([loadSubjects(), loadAudit()]);
        } catch (error) {
            if (!Validator.applyServerErrors(subjectForm, error)) Toast.error(error.message);
        } finally { btn.setLoading(false); }
    });

    subjectEditSelect?.addEventListener('change', () => loadSubjectEditFields(subjectEditSelect.value));

    editSubjectBtn?.addEventListener('click', async () => {
        const id = subjectEditSelect?.value;
        if (!id) return;
        const panel = document.getElementById('subjectEditPanel');
        Validator.clear(panel);

        const valid = Validator.on(panel)
            .required('nombre', LanguageManager.t('subjects.name'))
            .minLength('nombre', 2, LanguageManager.t('subjects.name'))
            .validateThis()
            .render();
        if (!valid) return;

        editSubjectBtn.setLoading(true);
        try {
            await apiService.put(`/subjects/${id}`, {
                nombre: editTitulo.value,
                descripcion: editDesc.value,
                profesorId: editProfesor.value ? Number(editProfesor.value) : null
            });
            Toast.success(LanguageManager.t('messages.subjectUpdated'));
            await Promise.all([loadSubjects(), loadAudit()]);
        } catch (error) {
            if (!Validator.applyServerErrors(panel, error)) Toast.error(error.message);
        } finally { editSubjectBtn.setLoading(false); }
    });

    loadAll();
    LanguageManager.onChange(loadAll);
});
