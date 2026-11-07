/**
* Project     : Bibliotech  |  Frontend - Controlador
* myContentFrontController: compendio personal de subidas, favoritos, lecturas y backlog.
*/
import { Cards } from '../components/cards/cards.mjs';
import { ContentTabs } from '../components/contentTabs/contentTabs.mjs';
import { Loader } from '../components/loader/loader.mjs';
import { MaterialEditor } from '../components/materialEditor/materialEditor.mjs';
import { MaterialViewer } from '../components/materialViewer/materialViewer.mjs';
import { Pagination } from '../components/pagination/pagination.mjs';
import { Toast } from '../components/toast/toast.mjs';
import { LanguageManager } from '../i18n/LanguageManager.mjs';
import { apiService } from '../services/apiService.mjs';
import { authHelper } from '../utils/authHelper.mjs';
import { el, render } from '../utils/dom.mjs';


document.addEventListener('bt:ready', () => {
    const root = document.getElementById('myContent');
    if (!root) return;

    const viewer = authHelper.getUser() || {};
    const userId = authHelper.isAuthenticated() ? Number(viewer.id) : null;
    if (!userId) {
        window.location.href = '/login?redirect=/mi-contenido';
        return;
    }

    const PAGE_SIZE = Pagination.DEFAULT_PAGE_SIZE;
    const state = { tab: 'uploads', materials: [], page: 1, total: 0 };
    const tr = (key, params) => LanguageManager.t(key, params);

    function shell() {
        const tabs = el('div', { attrs: { role: 'tablist' } });
        const grid = el('div', { className: 'bt-grid', attrs: { id: 'myContentGrid' } });
        const pagination = el('div', { attrs: { id: 'myContentPagination' } });
        render(root, [
            el('section', { className: 'bt-panel bt-my-content bt-stack' }, [
                el('h2', { text: tr('myContent.title') }),
                tabs,
                grid,
                pagination
            ])
        ]);
        return { tabs, grid, pagination };
    }

    function renderTabs(parts) {
        const buttons = ContentTabs.definitions.map(([key, label]) => {
            const btn = el('button', {
                className: `bt-profile__tab${state.tab === key ? ' is-active' : ''}`,
                attrs: { type: 'button', role: 'tab', 'aria-selected': state.tab === key ? 'true' : 'false' },
                text: tr(label)
            });
            btn.addEventListener('click', async () => {
                state.tab = key;
                state.page = 1;
                renderTabs(parts);
                await loadTab(parts);
            });
            return btn;
        });
        render(parts.tabs, el('div', { className: 'bt-profile__tabs' }, buttons));
    }

    async function loadTab(parts) {
        Loader.skeletons(parts.grid, 3);
        parts.pagination.replaceChildren();
        try {
            const pagination = { page: state.page, pageSize: PAGE_SIZE };
            if (state.tab === 'backlog') {
                const result = await apiService.get(`/users/${userId}/backlog`, pagination);
                state.total = Number(result.pagination?.total ?? (result.items || []).length);
                renderBacklog(parts, result.items || []);
                return;
            }
            const endpoint = {
                uploads: `/users/${userId}/uploads`,
                favorites: `/users/${userId}/favorites`,
                reads: `/users/${userId}/reads`
            }[state.tab];
            const result = await apiService.get(endpoint, pagination);
            state.materials = result.materials || [];
            state.total = Number(result.pagination?.total ?? state.materials.length);
            const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
            if (state.page > totalPages) {
                state.page = totalPages;
                return loadTab(parts);
            }
            renderMaterials(parts);
        } catch (error) {
            render(parts.grid, Cards.empty(error.message));
        }
    }

    function renderMaterials(parts) {
        const total = state.total;
        if (!total) {
            render(parts.grid, Cards.empty(tr(`profile.empty.${state.tab}`)));
            parts.pagination.replaceChildren();
            return;
        }
        render(parts.grid, state.materials.map(material => Cards.material(material, {
            onToggleFavorite: () => Cards.toggleFavorite(material),
            onEdit: Cards.canEdit(material) ? editMaterial : null
        })));
        Pagination.render(parts.pagination, {
            page: state.page,
            total,
            pageSize: PAGE_SIZE,
            onChange: page => { state.page = page; loadTab(parts); }
        });
    }

    function renderBacklog(parts, items) {
        if (!state.total) {
            render(parts.grid, Cards.empty(tr('profile.empty.backlog')));
            parts.pagination.replaceChildren();
            return;
        }
        render(parts.grid, items.map(item => Cards.backlogCard(item, {
            onOpen: (material, page) => openInViewer(material, page),
            onRead: async () => {
                const fresh = shell();
                renderTabs(fresh);
                await loadTab(fresh);
            },
            onRemove: async material => {
                try {
                    await apiService.del(`/backlog/${material.id}`);
                    const fresh = shell();
                    renderTabs(fresh);
                    await loadTab(fresh);
                } catch (error) { Toast.error(error.message); }
            }
        })).filter(Boolean));
        Pagination.render(parts.pagination, {
            page: state.page,
            total: state.total,
            pageSize: PAGE_SIZE,
            onChange: page => { state.page = page; loadTab(parts); }
        });
    }

    function editMaterial(material) {
        if (typeof MaterialEditor === 'undefined') return;
        MaterialEditor.open(material, async () => {
            const parts = shell();
            renderTabs(parts);
            await loadTab(parts);
        });
    }

    function openInViewer(material, page = 1) {
        if (typeof MaterialViewer !== 'undefined' && (MaterialViewer.isPdf(material) || MaterialViewer.isYoutube(material))) {
            MaterialViewer.open(material, {
                startPage: page,
                onClose: () => {
                    const parts = shell();
                    renderTabs(parts);
                    loadTab(parts);
                }
            });
        } else {
            const fallback = typeof MaterialViewer !== 'undefined'
                ? (MaterialViewer.downloadHref(material) || material.urlOrPath)
                : material.urlOrPath;
            window.open(fallback, '_blank', 'noopener');
        }
    }

    const parts = shell();
    renderTabs(parts);
    loadTab(parts);
    LanguageManager.onChange(() => {
        const fresh = shell();
        renderTabs(fresh);
        loadTab(fresh);
    });
});
