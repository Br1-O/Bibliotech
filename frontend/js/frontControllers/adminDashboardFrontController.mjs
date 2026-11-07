/**
* Project     : Bibliotech  |  Frontend - Controlador
* adminFrontController: panel del superadministrador. Usuarios, carreras,
* materias, carga masiva, etiquetas y auditoria.
*/
import { Cards } from '../components/cards/cards.mjs';
import { Modal } from '../components/modal/modal.mjs';
import { Pagination } from '../components/pagination/pagination.mjs';
import { ProfileSummary } from '../components/profileSummary/profileSummary.mjs';
import { Toast } from '../components/toast/toast.mjs';
import { LanguageManager } from '../i18n/LanguageManager.mjs';
import { apiService } from '../services/apiService.mjs';
import { authHelper } from '../utils/authHelper.mjs';
import { el, render } from '../utils/dom.mjs';
import { Validator } from '../utils/validator.mjs';


document.addEventListener('bt:ready', () => {
    const root = document.getElementById('adminDashboard');
    if (!root) return;

    if (!authHelper.requireAuth()) return;
    if (!authHelper.isRole('Superadmin')) { window.location.href = authHelper.panelRoute(); return; }

    ProfileSummary.mount(document.getElementById('profileSummary'));

    const usersTable = document.getElementById('usersTable');
    const usersPagination = document.getElementById('usersPagination');
    const auditTable = document.getElementById('auditLog');
    const auditPagination = document.getElementById('auditPagination');
    const requestsNode = document.getElementById('associationRequests');
    const subjectProfessors = document.getElementById('subjectProfessors');
    const professorForm = document.getElementById('professorForm');
    const subjectForm = document.getElementById('adminSubjectForm');
    const subjectCareerYear = document.getElementById('subjectCareerYear');
    const subjectsGrid = document.getElementById('adminSubjectsGrid');
    const subjectsPagination = document.getElementById('adminSubjectsPagination');

    const subjectEditSelect = document.getElementById('subjectEditSelect');
    const editTitulo = document.getElementById('editTitulo');
    const editDesc = document.getElementById('editDesc');
    const editProfessors = document.getElementById('editProfessors');
    const editCareerYear = document.getElementById('editCareerYear');
    const editSubjectBtn = document.getElementById('editSubjectBtn');
    const tagsList = document.getElementById('thematicTagsList');
    const tagsPagination = document.getElementById('tagsPagination');
    const careersAdminList = document.getElementById('careersAdminList');
    const careerForm = document.getElementById('careerForm');
    const batchForm = document.getElementById('batchMaterialForm');
    const batchFilesInput = document.getElementById('batchFiles');
    const batchFilesMeta = document.getElementById('batchFilesMeta');
    const batchCategorySelect = document.getElementById('batchCategory');

    const userSearch = document.getElementById('adminUserSearch');
    const userRole = document.getElementById('adminUserRole');
    const userStatus = document.getElementById('adminUserStatus');
    const userClear = document.getElementById('adminUserClear');
    const tagSearch = document.getElementById('adminTagSearch');
    const tagStatus = document.getElementById('adminTagStatus');
    const tagClear = document.getElementById('adminTagClear');

    const cache = { users: [], subjects: [], careers: [], logs: [], tags: [] };
    const SUBJECT_PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;
    const AUDIT_PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;
    const ADMIN_PAGE_SIZE = 10;
    let subjectPage = 1;
    let auditPage = 1;
    let auditTotal = 0;
    let userPage = 1;
    let tagPage = 1;
    let userDebounce;
    let tagDebounce;
    let batchFileEntries = [];
    const CATEGORY_SLUGS = [
        'fiction', 'literature', 'poetry', 'drama', 'technical', 'science', 'business',
        'education', 'medicine', 'law', 'non-fiction', 'self-help', 'biography', 'history',
        'philosophy', 'religion', 'arts', 'hobbies', 'travel', 'sports', 'cooking', 'kids',
        'young-adult'
    ];

    const tr = (key, params = {}) => LanguageManager.tr(key, params);

    function categoryOptions(selected = 'technical') {
        return CATEGORY_SLUGS.map(slug => el('option', {
            value: slug,
            text: LanguageManager.t(`material.categories.${slug}`),
            attrs: slug === selected ? { selected: '' } : {}
        }));
    }

    function hydrateBatchCategory() {
        if (!batchCategorySelect) return;
        const current = batchCategorySelect.value || 'technical';
        render(batchCategorySelect, categoryOptions(current));
        batchCategorySelect.value = current;
    }

    function batchTitleFromFilename(filename) {
        const name = String(filename || 'Material');
        const dot = name.lastIndexOf('.');
        return (dot > 0 ? name.slice(0, dot) : name).slice(0, 150) || 'Material';
    }

    function renderBatchFilesMeta() {
        if (!batchFilesMeta) return;
        if (!batchFileEntries.length) {
            render(batchFilesMeta, []);
            return;
        }
        render(batchFilesMeta, batchFileEntries.map((entry, index) => {
            const titleInput = el('input', {
                className: 'bt-input',
                attrs: { type: 'text', maxlength: '150', 'aria-label': LanguageManager.t('material.title') },
                value: entry.titulo
            });
            titleInput.addEventListener('input', () => { entry.titulo = titleInput.value; });

            const coverInput = el('input', {
                className: 'bt-input',
                attrs: {
                    type: 'file',
                    accept: 'image/png,image/jpeg,image/webp,image/gif',
                    'aria-label': LanguageManager.t('material.cover')
                }
            });
            coverInput.addEventListener('change', () => { entry.cover = coverInput.files?.[0] || null; });

            const categorySelect = el('select', {
                className: 'bt-select',
                attrs: { 'aria-label': LanguageManager.t('material.category') }
            }, categoryOptions(entry.category || 'technical'));
            categorySelect.value = entry.category || 'technical';
            categorySelect.addEventListener('change', () => { entry.category = categorySelect.value; });

            const pagesInput = el('input', {
                className: 'bt-input',
                attrs: { type: 'number', min: '1', step: '1', 'aria-label': LanguageManager.t('material.pages') },
                value: entry.pages || ''
            });
            pagesInput.addEventListener('input', () => { entry.pages = pagesInput.value ? Number(pagesInput.value) : null; });

            return el('div', { className: 'bt-batch-file' }, [
                el('span', {
                    className: 'bt-batch-file__name',
                    text: `${index + 1}. ${entry.file.name}`
                }),
                el('div', { className: 'bt-field' }, [
                    el('label', { className: 'bt-label', text: LanguageManager.t('admin.batchTitle') }),
                    titleInput
                ]),
                el('div', { className: 'bt-field' }, [
                    el('label', { className: 'bt-label', text: LanguageManager.t('material.category') }),
                    categorySelect
                ]),
                el('div', { className: 'bt-field' }, [
                    el('label', { className: 'bt-label', text: LanguageManager.t('material.pages') }),
                    pagesInput
                ]),
                el('div', { className: 'bt-field' }, [
                    el('label', { className: 'bt-label', text: LanguageManager.t('admin.batchCover') }),
                    coverInput
                ])
            ]);
        }));
    }

    hydrateBatchCategory();
    renderBatchFilesMeta();

    batchFilesInput?.addEventListener('change', () => {
        batchFileEntries = Array.from(batchFilesInput.files || []).map(file => ({
            file,
            titulo: batchTitleFromFilename(file.name),
            category: batchCategorySelect?.value || 'technical',
            pages: null,
            cover: null
        }));
        renderBatchFilesMeta();
    });

    async function loadAll() {
        await Promise.all([loadUsers(), loadCareers(), loadAudit(), loadTags()]);
        await loadSubjects();
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
            renderProfessorOptions(subjectProfessors, selectedProfessorIds(subjectProfessors));
            renderProfessorOptions(editProfessors, selectedProfessorIds(editProfessors));
        } catch (error) { Toast.error(error.message); }
    }

    function filteredUsers() {
        const query = (userSearch?.value || '').trim().toLowerCase();
        return cache.users.filter(user => {
            if (userRole?.value && user.roleNombre !== userRole.value) return false;
            if (userStatus?.value && user.estado !== userStatus.value) return false;
            if (!query) return true;
            return [user.nombre, user.apellido, user.email]
                .some(value => String(value || '').toLowerCase().includes(query));
        });
    }

    function renderUsers() {
        if (!usersTable) return;
        const users = filteredUsers();
        const total = users.length;
        const totalPages = Pagination.totalPages(total, ADMIN_PAGE_SIZE);
        if (userPage > totalPages) userPage = totalPages;
        const start = (userPage - 1) * ADMIN_PAGE_SIZE;
        const pageItems = users.slice(start, start + ADMIN_PAGE_SIZE);

        render(usersTable, pageItems.map(u => {
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

        Pagination.render(usersPagination, {
            page: userPage,
            total,
            pageSize: ADMIN_PAGE_SIZE,
            onChange: (page) => { userPage = page; renderUsers(); }
        });
    }

    async function loadCareers() {
        try {
            const { careers } = await apiService.get('/careers');
            cache.careers = careers || [];
            renderCareerAdmin();
            renderCareerYearOptions();
        } catch (error) { Toast.error(error.message); }
    }

    function renderCareerYearOptions() {
        [subjectCareerYear, editCareerYear].forEach(select => {
            if (!select) return;
            const current = select.value;
            const options = [el('option', { value: '', text: LanguageManager.t('admin.noCareerYear') })];
            cache.careers.forEach(career => {
                (career.years || []).forEach(year => {
                    options.push(el('option', {
                        value: String(year.id),
                        text: `${career.nombre} · ${year.nombre}`
                    }));
                });
            });
            render(select, options);
            if ([...select.options].some(option => option.value === current)) select.value = current;
        });
    }

    function renderCareerAdmin() {
        if (!careersAdminList) return;
        if (!cache.careers.length) {
            render(careersAdminList, Cards.empty(LanguageManager.t('careers.none')));
            return;
        }

        render(careersAdminList, cache.careers.map(career => {
            const name = el('input', { className: 'bt-input', value: career.nombre || '' });
            const color = el('input', {
                className: 'bt-input bt-input--color',
                attrs: { type: 'color' },
                value: career.color || '#6f5bd3'
            });
            const save = el('bt-button', {
                size: 'sm', variant: 'secondary', label: LanguageManager.t('common.save')
            });
            save.addEventListener('click', async () => {
                try {
                    await apiService.put(`/careers/${career.id}`, {
                        nombre: name.value.trim(),
                        color: color.value
                    });
                    Toast.success(LanguageManager.t('messages.careerUpdated'));
                    await Promise.all([loadCareers(), loadSubjects()]);
                } catch (error) { Toast.error(error.message); }
            });

            const years = (career.years || []).map(year => {
                const yearName = el('input', { className: 'bt-input', value: year.nombre || '' });
                const yearOrder = el('input', {
                    className: 'bt-input bt-input--number',
                    attrs: { type: 'number', min: '0', step: '1' },
                    value: String(year.orden ?? 0)
                });
                const yearSave = el('bt-button', {
                    size: 'sm', variant: 'secondary', label: LanguageManager.t('common.save')
                });
                yearSave.addEventListener('click', async () => {
                    try {
                        await apiService.put(`/careers/years/${year.id}`, {
                            nombre: yearName.value.trim(),
                            orden: Number(yearOrder.value)
                        });
                        Toast.success(LanguageManager.t('messages.yearUpdated'));
                        await Promise.all([loadCareers(), loadSubjects()]);
                    } catch (error) { Toast.error(error.message); }
                });
                return el('div', { className: 'bt-row bt-wrap bt-admin-year' }, [
                    yearName,
                    yearOrder,
                    yearSave
                ]);
            });

            const newYearName = el('input', {
                className: 'bt-input',
                attrs: { placeholder: LanguageManager.t('admin.yearName') }
            });
            const newYearOrder = el('input', {
                className: 'bt-input bt-input--number',
                attrs: { type: 'number', min: '0', step: '1', value: String((career.years || []).length + 1) }
            });
            const addYear = el('bt-button', {
                size: 'sm', label: LanguageManager.t('admin.createYear')
            });
            addYear.addEventListener('click', async () => {
                if (!newYearName.value.trim()) {
                    Toast.error(LanguageManager.t('validation.required', { field: LanguageManager.t('admin.yearName') }));
                    return;
                }
                try {
                    await apiService.post(`/careers/${career.id}/years`, {
                        nombre: newYearName.value.trim(),
                        orden: Number(newYearOrder.value) || 0
                    });
                    Toast.success(LanguageManager.t('messages.yearCreated'));
                    newYearName.value = '';
                    await Promise.all([loadCareers(), loadSubjects()]);
                } catch (error) { Toast.error(error.message); }
            });

            return el('div', {
                className: 'bt-panel bt-stack bt-career-admin',
                attrs: { style: `--career-color:${career.color || '#6f5bd3'}` }
            }, [
                el('div', { className: 'bt-row bt-wrap' }, [
                    el('span', { className: 'bt-career-card__dot' }),
                    name,
                    color,
                    save
                ]),
                el('div', { className: 'bt-stack' }, years),
                el('div', { className: 'bt-row bt-wrap' }, [newYearName, newYearOrder, addYear])
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

    function selectedProfessorIds(container) {
        if (!container) return [];
        return [...container.querySelectorAll('input[type="checkbox"]:checked')]
            .map(input => Number(input.value)).filter(Boolean);
    }

    function renderProfessorOptions(container, selectedIds = []) {
        if (!container) return;
        const selected = new Set((selectedIds || []).map(Number));
        const professors = cache.users.filter(u => u.roleNombre === 'Profesor');
        if (!professors.length) {
            render(container, [el('p', { className: 'bt-card__meta', text: LanguageManager.t('subject.noTeacher') })]);
            return;
        }
        render(container, professors.map(professor => {
            const input = el('input', {
                attrs: { type: 'checkbox', value: String(professor.id) }
            });
            input.checked = selected.has(Number(professor.id));
            return el('label', { className: 'bt-check' }, [
                input,
                el('span', { text: `${professor.nombre} ${professor.apellido}` })
            ]);
        }));
    }

    function subjectProfessorLabel(subject) {
        const names = (subject.profesores || []).map(professor =>
            professor.nombreCompleto || `${professor.nombre || ''} ${professor.apellido || ''}`.trim());
        return names.length ? names.join(', ') : (subject.profesorNombre || '-');
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
        const assigned = (s.profesores || []).map(professor => professor.id);
        if (!assigned.length && s.profesorId) assigned.push(s.profesorId);
        renderProfessorOptions(editProfessors, assigned);
        if (editCareerYear) editCareerYear.value = s.careerYearId ? String(s.careerYearId) : '';
    }

    function renderRequests() {
        if (!requestsNode) return;
        const pending = cache.subjects.filter(s => s.estadoAsociacion === 'Pendiente');
        if (!pending.length) { render(requestsNode, Cards.empty(LanguageManager.t('admin.noRequests'))); return; }

        render(requestsNode, pending.map(s => el('div', { className: 'bt-panel bt-row bt-between' }, [
            el('div', {}, [
                el('strong', { text: s.nombre }),
                el('p', { className: 'bt-card__meta', text: `${LanguageManager.t('subjects.teachers')}: ${subjectProfessorLabel(s)}` })
            ]),
            el('div', { className: 'bt-row', style: { gap: 'var(--space-2)' } }, [
                el('bt-button', { size: 'sm', variant: 'success', label: LanguageManager.t('admin.approve'), on: { click: () => resolveRequest(s, 'confirm-association') } }),
                el('bt-button', { size: 'sm', variant: 'danger', label: LanguageManager.t('admin.reject'), on: { click: () => resolveRequest(s, 'reject-association') } })
            ])
        ])));
    }

    async function loadAudit(page = 1) {
        try {
            auditPage = page;
            const result = await apiService.get('/audit', {
                page: auditPage,
                pageSize: AUDIT_PAGE_SIZE
            });
            cache.logs = result.logs || [];
            auditTotal = Number(result.pagination?.total ?? cache.logs.length);
            renderAuditLogs();
        } catch (error) { Toast.error(error.message); }
    }

    function operationLabel(operation) {
        return tr(`audit.operations.${operation}`);
    }

    function renderAuditLogs() {
        if (!auditTable) return;
        const logs = cache.logs || [];
        if (!auditTotal) {
            render(auditTable, [el('tr', {}, [
                el('td', { attrs: { colspan: '4' }, text: LanguageManager.t('common.noResults') })
            ])]);
            Pagination.render(auditPagination, { total: 0, pageSize: AUDIT_PAGE_SIZE });
            return;
        }

        render(auditTable, logs.map(l => {
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
            total: auditTotal,
            pageSize: AUDIT_PAGE_SIZE,
            onChange: (page) => loadAudit(page)
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
            renderTags();
        } catch (error) { Toast.error(error.message); }
    }

    function filteredTags() {
        const query = (tagSearch?.value || '').trim().toLowerCase();
        return cache.tags.filter(tag => {
            if (tagStatus?.value === 'banned' && !Number(tag.baneado)) return false;
            if (tagStatus?.value === 'active' && Number(tag.baneado)) return false;
            if (!query) return true;
            return String(tag.nombre || '').toLowerCase().includes(query)
                || String(tag.categoria || '').toLowerCase().includes(query);
        });
    }

    function renderTags() {
        const tags = filteredTags();
        const total = tags.length;
        const totalPages = Pagination.totalPages(total, ADMIN_PAGE_SIZE);
        if (tagPage > totalPages) tagPage = totalPages;
        const start = (tagPage - 1) * ADMIN_PAGE_SIZE;
        const pageItems = tags.slice(start, start + ADMIN_PAGE_SIZE);

        if (!total) {
            render(tagsList, [el('p', { text: LanguageManager.t('admin.noTags') })]);
        } else {
            render(tagsList, pageItems.map(t => el('div', { className: 'bt-row bt-between bt-panel' }, [
                el('span', { text: `${t.nombre} (${t.categoria})` }),
                el('div', { className: 'bt-row', style: { gap: 'var(--space-2)' } }, [
                    el('bt-button', { size: 'sm', variant: 'danger', label: LanguageManager.t('common.delete'), on: { click: () => removeTag(t.id) } }),
                    t.baneado
                        ? el('span', { className: 'bt-badge bt-badge--danger', text: LanguageManager.t('teacher.ban') })
                        : el('bt-button', { size: 'sm', variant: 'warning', label: LanguageManager.t('teacher.ban'), on: { click: () => banTag(t.id) } })
                ])
            ])));
        }

        Pagination.render(tagsPagination, {
            page: tagPage,
            total,
            pageSize: ADMIN_PAGE_SIZE,
            onChange: (page) => { tagPage = page; renderTags(); }
        });
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
                profesorIds: selectedProfessorIds(subjectProfessors),
                careerYearId: data.careerYearId ? Number(data.careerYearId) : null
            });
            Toast.success(tr(result.message));
            subjectForm.reset();
            renderProfessorOptions(subjectProfessors, []);
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
                profesorIds: selectedProfessorIds(editProfessors),
                careerYearId: editCareerYear?.value ? Number(editCareerYear.value) : null
            });
            Toast.success(LanguageManager.t('messages.subjectUpdated'));
            await Promise.all([loadSubjects(), loadAudit()]);
        } catch (error) {
            if (!Validator.applyServerErrors(panel, error)) Toast.error(error.message);
        } finally { editSubjectBtn.setLoading(false); }
    });

    careerForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const name = document.getElementById('careerNombre');
        const color = document.getElementById('careerColor');
        if (!name?.value.trim()) {
            Toast.error(LanguageManager.t('validation.required', { field: LanguageManager.t('admin.careerName') }));
            return;
        }
        const btn = careerForm.querySelector('bt-button');
        try {
            btn?.setLoading(true);
            const result = await apiService.post('/careers', {
                nombre: name.value.trim(),
                color: color?.value || '#6f5bd3'
            });
            Toast.success(tr(result.message));
            name.value = '';
            await loadCareers();
        } catch (error) {
            Toast.error(error.message);
        } finally { btn?.setLoading(false); }
    });

    batchForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const linksInput = document.getElementById('batchLinks');
        const tagsInput = document.getElementById('batchTags');
        const fileCount = batchFileEntries.length;
        const links = (linksInput?.value || '').split(/\r?\n/).filter(line => line.trim());
        if (!fileCount && !links.length) {
            Toast.error(LanguageManager.t('validation.required', { field: LanguageManager.t('admin.batchFiles') }));
            return;
        }
        if (fileCount + links.length > 100) {
            Toast.error(LanguageManager.t('admin.batchLimit'));
            return;
        }

        const payload = new FormData();
        const metadata = [];
        batchFileEntries.forEach((entry, index) => {
            payload.append(`archivo_${index}`, entry.file);
            if (entry.cover) payload.append(`portada_${index}`, entry.cover);
            metadata.push({
                titulo: entry.titulo.trim() || batchTitleFromFilename(entry.file.name),
                category: entry.category || 'technical',
                pages: entry.pages || null
            });
        });
        payload.append('metadata', JSON.stringify(metadata));
        payload.append('links', linksInput?.value || '');
        payload.append('category', batchCategorySelect?.value || 'technical');
        payload.append('categories', tagsInput?.value || '');

        const btn = batchForm.querySelector('bt-button');
        try {
            btn?.setLoading(true);
            const result = await apiService.upload('/materials/batch', payload);
            const createdNames = (result.materials || [])
                .map((material) => material.titulo)
                .filter(Boolean)
                .join(', ');
            const skippedNames = (result.skippedMaterials || [])
                .map((material) => (material.titulo ? `${material.titulo}${material.id ? ` (ID ${material.id})` : ''}` : ''))
                .filter(Boolean)
                .join(', ');
            Toast.success(tr('admin.batchResult', {
                created: result.created,
                skipped: result.skipped,
                createdNames: createdNames || tr('admin.batchNone'),
                skippedNames: skippedNames || tr('admin.batchNone')
            }));
            batchForm.reset();
            batchFileEntries = [];
            renderBatchFilesMeta();
            await Promise.all([loadSubjects(), loadAudit()]);
        } catch (error) {
            Toast.error(error.message);
        } finally { btn?.setLoading(false); }
    });

    userSearch?.addEventListener('input', () => {
        clearTimeout(userDebounce);
        userDebounce = setTimeout(() => { userPage = 1; renderUsers(); }, 250);
    });
    userRole?.addEventListener('change', () => { userPage = 1; renderUsers(); });
    userStatus?.addEventListener('change', () => { userPage = 1; renderUsers(); });
    userClear?.addEventListener('click', () => {
        if (userSearch) userSearch.value = '';
        if (userRole) userRole.value = '';
        if (userStatus) userStatus.value = '';
        userPage = 1;
        renderUsers();
    });

    tagSearch?.addEventListener('input', () => {
        clearTimeout(tagDebounce);
        tagDebounce = setTimeout(() => { tagPage = 1; renderTags(); }, 250);
    });
    tagStatus?.addEventListener('change', () => { tagPage = 1; renderTags(); });
    tagClear?.addEventListener('click', () => {
        if (tagSearch) tagSearch.value = '';
        if (tagStatus) tagStatus.value = '';
        tagPage = 1;
        renderTags();
    });

    loadAll();
    LanguageManager.onChange(loadAll);
});
