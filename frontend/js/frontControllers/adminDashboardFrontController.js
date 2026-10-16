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
    const requestsNode = document.getElementById('associationRequests');
    const professorSelect = document.getElementById('subjectProfessor');
    const professorForm = document.getElementById('professorForm');
    const subjectForm = document.getElementById('adminSubjectForm');

    let cache = { users: [], subjects: [], logs: [] };

    async function loadAll() {
        await Promise.all([loadUsers(), loadSubjects(), loadAudit()]);
        updateStats();
    }

    async function loadUsers() {
        try {
            const { users } = await apiService.get('/auth/users');
            cache.users = users;
            render(usersTable, users.map(u => el('tr', {}, [
                el('td', { text: u.nombre }),
                el('td', { text: u.apellido }),
                el('td', { text: u.email }),
                el('td', {}, [el('span', { className: 'bt-badge bt-badge--info', text: LanguageManager.t(`roles.${u.roleNombre}`) })])
            ])));
            const professors = users.filter(u => u.roleNombre === 'Profesor');
            render(professorSelect, [
                el('option', { value: '', text: LanguageManager.t('common.optional') }),
                ...professors.map(p => el('option', { value: String(p.id), text: `${p.nombre} ${p.apellido}` }))
            ]);
        } catch (error) { Toast.error(error.message); }
    }

    async function loadSubjects() {
        try {
            const { subjects } = await apiService.get('/subjects');
            cache.subjects = subjects;
            const pending = subjects.filter(s => s.estadoAsociacion === 'Pendiente');
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
        } catch (error) { Toast.error(error.message); }
    }

    async function loadAudit() {
        try {
            const { logs } = await apiService.get('/audit');
            cache.logs = logs;
            render(auditTable, logs.slice(0, 25).map(l => el('tr', {}, [
                el('td', { text: l.tipoOperacion }),
                el('td', { text: l.usuarioId != null ? String(l.usuarioId) : '-' }),
                el('td', { text: l.registroId != null ? String(l.registroId) : '-' }),
                el('td', { text: l.timestamp ? new Date(l.timestamp).toLocaleString() : '' })
            ])));
        } catch (error) { Toast.error(error.message); }
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
            loadSubjects().then(updateStats);
        } catch (error) { Toast.error(error.message); }
    }

    professorForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(professorForm);
        const errors = Validator.validate([
            { name: 'nombre', label: LanguageManager.t('auth.firstName'), value: data.get('nombre'), checks: [{ type: 'required' }] },
            { name: 'apellido', label: LanguageManager.t('auth.lastName'), value: data.get('apellido'), checks: [{ type: 'required' }] },
            { name: 'email', label: LanguageManager.t('auth.email'), value: data.get('email'), checks: [{ type: 'required' }, { type: 'email' }] },
            { name: 'password', label: LanguageManager.t('auth.password'), value: data.get('password'), checks: [{ type: 'required' }, { type: 'password' }] }
        ]);
        if (!Validator.renderErrors(professorForm, errors)) return;

        const btn = professorForm.querySelector('bt-button');
        try {
            btn.setLoading(true);
            const result = await apiService.post('/auth/professors', Object.fromEntries(data.entries()));
            Toast.success(LanguageManager.t(result.message));
            professorForm.reset();
            loadUsers();
        } catch (error) { Toast.error(error.message); } finally { btn.setLoading(false); }
    });

    subjectForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(subjectForm).entries());
        const errors = Validator.validate([
            { name: 'nombre', label: LanguageManager.t('subjects.name'), value: data.nombre, checks: [{ type: 'required' }] }
        ]);
        if (!Validator.renderErrors(subjectForm, errors)) return;

        const btn = subjectForm.querySelector('bt-button');
        try {
            btn.setLoading(true);
            const result = await apiService.post('/subjects', {
                nombre: data.nombre,
                descripcion: data.descripcion || null,
                profesorId: data.profesorId ? Number(data.profesorId) : null
            });
            Toast.success(LanguageManager.t(result.message));
            subjectForm.reset();
            loadSubjects().then(updateStats);
        } catch (error) { Toast.error(error.message); } finally { btn.setLoading(false); }
    });

    loadAll();
    LanguageManager.onChange(loadAll);
});
