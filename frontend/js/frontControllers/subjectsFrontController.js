/**
* Project     : Bibliotech  |  Frontend - Controlador
* subjectsFrontController: pagina independiente de carreras y materias.
*/

document.addEventListener('bt:ready', () => {
    const subjectsGrid = document.getElementById('subjectsGrid');
    if (!subjectsGrid) return;

    const subjectsPagination = document.getElementById('subjectsPagination');
    const subscribedSection = document.getElementById('suscritas');
    const subscribedGrid = document.getElementById('subscribedGrid');
    const subscribedPagination = document.getElementById('subscribedPagination');
    const careersGrid = document.getElementById('careersGrid');
    const careerYears = document.getElementById('careerYears');
    const careerClear = document.getElementById('careerClear');
    const careerAllWrap = document.getElementById('careerAllSubjectsWrap');
    const careerAllBtn = document.getElementById('careerAllSubjectsBtn');
    const professorWrap = document.getElementById('professorFilterWrap');
    const professorBtn = document.getElementById('professorFilterBtn');
    const toggleSubscribedBtn = document.getElementById('toggleSubscribedBtn');
    const subscribedToggleWrap = document.getElementById('subscribedToggleWrap');

    const params = new URLSearchParams(window.location.search);
    const SUBJECT_PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;
    const me = authHelper.getUser() || {};
    const isAlumno = authHelper.isRole('Alumno');
    const isProfesor = authHelper.isRole('Profesor');

    let subscriptions = [];
    let allSubjectsCache = [];
    let allCareers = [];
    let subjectPage = 1;
    let subscribedPage = 1;
    let selectedCareerId = params.get('career') ? Number(params.get('career')) : null;
    let selectedYearId = params.get('year') ? Number(params.get('year')) : null;
    let showOnlySubscribed = false;
    let onlyMine = false;

    if (isProfesor) professorWrap?.classList.remove('bt-hidden');
    if (isAlumno) {
        subscribedToggleWrap?.classList.remove('bt-hidden');
        subscribedSection?.classList.remove('bt-hidden');
    }

    const subjectIdOf = subscription => String(subscription.materiaId ?? subscription.materia_id);
    const isSubscribed = id => subscriptions.some(subscription => subjectIdOf(subscription) === String(id));

    function subscribedSubjects() {
        return subscriptions.map(subscription => {
            const id = subjectIdOf(subscription);
            const cached = allSubjectsCache.find(subject => String(subject.id) === id);
            return cached || {
                id,
                nombre: subscription.materiaNombre || subscription.materia_nombre || '',
                descripcion: subscription.materiaDescripcion || subscription.materia_descripcion || '',
                profesorNombre: subscription.profesorNombre || subscription.profesor_nombre || '',
                totalMateriales: subscription.totalMateriales ?? subscription.total_materiales ?? 0
            };
        }).filter(subject => subject.nombre);
    }

    function updateToggleLabel() {
        if (toggleSubscribedBtn) {
            toggleSubscribedBtn.setAttribute('label-i18n', showOnlySubscribed ? 'subjects.showAll' : 'subjects.onlySubscribed');
            toggleSubscribedBtn.setAttribute('variant', showOnlySubscribed ? 'ghost' : 'secondary');
        }
        if (professorBtn) {
            professorBtn.setAttribute('label-i18n', onlyMine ? 'subjects.showAll' : 'subjects.onlyMine');
            professorBtn.setAttribute('variant', onlyMine ? 'ghost' : 'secondary');
        }
    }

    function syncUrl() {
        const next = new URLSearchParams();
        if (selectedCareerId) next.set('career', String(selectedCareerId));
        if (selectedYearId) next.set('year', String(selectedYearId));
        const query = next.toString();
        history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}#materias`);
    }

    function scrollCareerIntoView() {
        if (!careersGrid || !selectedCareerId) return;
        const selected = careersGrid.querySelector('.bt-career-card.is-selected');
        if (selected) setTimeout(() => selected.scrollIntoView({ block: 'nearest', inline: 'center' }), 0);
    }

    async function loadCareers() {
        try {
            const { careers } = await apiService.get('/careers');
            allCareers = careers || [];
            const validCareer = allCareers.find(career => Number(career.id) === Number(selectedCareerId));
            if (!validCareer) {
                selectedCareerId = null;
                selectedYearId = null;
            } else if (selectedYearId) {
                const validYear = (validCareer.years || []).some(year => Number(year.id) === Number(selectedYearId));
                if (!validYear) selectedYearId = null;
            }
            renderCareers();
        } catch (error) {
            console.error(error);
        }
    }

    function renderCareers() {
        if (careersGrid) {
            const cards = allCareers.map(career => Cards.career(career, {
                selected: Number(career.id) === Number(selectedCareerId),
                onSelect: () => selectCareer(career.id, null)
            }));
            render(careersGrid, cards.length ? cards : [Cards.empty(LanguageManager.t('careers.none'))]);
            scrollCareerIntoView();
        }

        if (careerYears) {
            const career = allCareers.find(item => Number(item.id) === Number(selectedCareerId));
            if (!career) {
                render(careerYears, []);
            } else {
                const allYears = el('button', {
                    className: `bt-chip bt-chip--year${!selectedYearId ? ' is-selected' : ''}`,
                    text: LanguageManager.t('careers.allYears'),
                    attrs: { type: 'button' }
                });
                allYears.addEventListener('click', () => selectYear(null));
                const nodes = [allYears];
                (career.years || []).forEach(year => {
                    nodes.push(Cards.year(year, {
                        selected: Number(year.id) === Number(selectedYearId),
                        onSelect: () => selectYear(year.id)
                    }));
                });
                render(careerYears, nodes);
            }
        }

        careerClear?.classList.toggle('bt-hidden', !selectedCareerId);
        careerAllWrap?.classList.toggle('bt-hidden', !selectedCareerId);
    }

    function selectCareer(careerId, yearId = null) {
        selectedCareerId = careerId ? Number(careerId) : null;
        selectedYearId = yearId ? Number(yearId) : null;
        subjectPage = 1;
        syncUrl();
        renderCareers();
        renderSubjects();
        document.getElementById('materias')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function selectYear(yearId) {
        selectedYearId = yearId ? Number(yearId) : null;
        subjectPage = 1;
        syncUrl();
        renderCareers();
        renderSubjects();
    }

    async function loadSubjects() {
        try {
            const { subjects } = await apiService.get('/subjects');
            allSubjectsCache = subjects || [];
            renderSubjects();
            renderSubscribed();
        } catch (error) {
            console.error(error);
        }
    }

    function filteredSubjects() {
        let subjects = [...allSubjectsCache];
        if (selectedCareerId) {
            subjects = subjects.filter(subject => Number(subject.carreraId) === Number(selectedCareerId));
        }
        if (selectedYearId) {
            subjects = subjects.filter(subject => Number(subject.anioId) === Number(selectedYearId));
        }
        if (isProfesor && onlyMine) {
            subjects = subjects.filter(subject => Cards.isSubjectProfessor(subject, me.id));
        }
        if (isAlumno && showOnlySubscribed) {
            subjects = subjects.filter(subject => isSubscribed(subject.id));
        }
        subjects.sort((a, b) => {
            if (isAlumno) {
                const as = isSubscribed(a.id);
                const bs = isSubscribed(b.id);
                if (as !== bs) return as ? -1 : 1;
            }
            return String(a.nombre).localeCompare(String(b.nombre));
        });
        return subjects;
    }

    function renderSubjects() {
        const subjects = filteredSubjects();
        if (!subjects.length) {
            const message = isAlumno && showOnlySubscribed
                ? LanguageManager.t('subjects.noSubscribed')
                : LanguageManager.t('subjects.noSubjects');
            render(subjectsGrid, Cards.empty(message));
            Pagination.render(subjectsPagination, { total: 0, pageSize: SUBJECT_PAGE_SIZE });
            return;
        }

        const totalPages = Pagination.totalPages(subjects.length, SUBJECT_PAGE_SIZE);
        if (subjectPage > totalPages) subjectPage = totalPages;
        const start = (subjectPage - 1) * SUBJECT_PAGE_SIZE;
        const pageItems = subjects.slice(start, start + SUBJECT_PAGE_SIZE);

        render(subjectsGrid, pageItems.map(subject => Cards.subject(subject, {
            subscribeButton: isAlumno ? buildSubscribeButton(subject) : null
        })));

        Pagination.render(subjectsPagination, {
            page: subjectPage,
            total: subjects.length,
            pageSize: SUBJECT_PAGE_SIZE,
            onChange: page => { subjectPage = page; renderSubjects(); }
        });
    }

    function buildSubscribeButton(subject) {
        const getSubscribed = () => isSubscribed(subject.id);
        const button = el('bt-button', {
            size: 'sm',
            variant: getSubscribed() ? 'secondary' : 'success',
            label: LanguageManager.t(getSubscribed() ? 'subject.subscribed' : 'subject.subscribe')
        });
        button.addEventListener('click', async () => {
            const subscribed = getSubscribed();
            try {
                button.setLoading(true);
                if (subscribed) {
                    await apiService.del(`/subscriptions/subscribe/${subject.id}`);
                    Toast.success(LanguageManager.t('messages.unsubscribed'));
                } else {
                    await apiService.post(`/subscriptions/subscribe/${subject.id}`, {});
                    Toast.success(LanguageManager.t('messages.subscribed'));
                }
                await loadSubscriptions();
                renderSubjects();
                renderSubscribed();
            } catch (error) {
                Toast.error(error.message);
                button.setLoading(false);
            }
        });
        return button;
    }

    async function loadSubscriptions() {
        if (!isAlumno) return;
        try {
            const result = await apiService.get('/subscriptions/mine');
            subscriptions = result.subscriptions || [];
        } catch (error) {
            subscriptions = [];
        }
    }

    function renderSubscribed() {
        if (!isAlumno || !subscribedGrid) return;
        const subjects = subscribedSubjects();
        if (!subjects.length) {
            render(subscribedGrid, Cards.empty(LanguageManager.t('subjects.noSubscribed')));
            Pagination.render(subscribedPagination, { total: 0, pageSize: SUBJECT_PAGE_SIZE });
            return;
        }

        const totalPages = Pagination.totalPages(subjects.length, SUBJECT_PAGE_SIZE);
        if (subscribedPage > totalPages) subscribedPage = totalPages;
        const start = (subscribedPage - 1) * SUBJECT_PAGE_SIZE;
        const pageItems = subjects.slice(start, start + SUBJECT_PAGE_SIZE);

        render(subscribedGrid, pageItems.map(subject => Cards.subject(subject, {
            subscribeButton: buildSubscribeButton(subject)
        })));
        Pagination.render(subscribedPagination, {
            page: subscribedPage,
            total: subjects.length,
            pageSize: SUBJECT_PAGE_SIZE,
            onChange: page => { subscribedPage = page; renderSubscribed(); }
        });
    }

    careerClear?.addEventListener('click', () => selectCareer(null, null));
    careerAllBtn?.addEventListener('click', () => selectYear(null));
    professorBtn?.addEventListener('click', () => {
        onlyMine = !onlyMine;
        updateToggleLabel();
        subjectPage = 1;
        renderSubjects();
    });
    toggleSubscribedBtn?.addEventListener('click', () => {
        showOnlySubscribed = !showOnlySubscribed;
        updateToggleLabel();
        subjectPage = 1;
        renderSubjects();
    });

    updateToggleLabel();
    LanguageManager.onChange(() => {
        updateToggleLabel();
        renderCareers();
        renderSubjects();
        renderSubscribed();
    });

    (async () => {
        await loadSubscriptions();
        await Promise.all([loadCareers(), loadSubjects()]);
        renderCareers();
        renderSubjects();
    })();
});
