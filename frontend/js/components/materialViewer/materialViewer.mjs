
import { LanguageManager } from '../../i18n/LanguageManager.mjs';
import { apiService } from '../../services/apiService.mjs';
import { authHelper } from '../../utils/authHelper.mjs';
import { el } from '../../utils/dom.mjs';
import { Icons } from '../icons/icons.mjs';
import { Toast } from '../toast/toast.mjs';
const MaterialViewer = (() => {
    const STORED_FILE_TYPES = ['PDF', 'EPUB', 'Word', 'Presentacion'];
    const EXTENSIONS = { PDF: '.pdf', EPUB: '.epub', Word: '.docx', Presentacion: '.pptx' };
    let active = null;
    let sequence = 0;

    function label(key, params) {
        return typeof LanguageManager !== 'undefined' ? LanguageManager.t(key, params) : key;
    }

    function safeHref(value) {
        try {
            const url = new URL(String(value || ''), window.location.origin);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
            return url.href;
        } catch (error) {
            return '';
        }
    }

    function youtubeId(value) {
        const href = safeHref(value);
        if (!href) return null;
        try {
            const url = new URL(href);
            const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
            const parts = url.pathname.split('/').filter(Boolean);
            let id = null;
            if (host === 'youtu.be') id = parts[0];
            else if (['youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
                if (parts[0] === 'watch') id = url.searchParams.get('v');
                else if (['embed', 'shorts', 'live'].includes(parts[0])) id = parts[1];
            }
            return /^[A-Za-z0-9_-]{6,}$/.test(String(id || '')) ? String(id) : null;
        } catch (error) {
            return null;
        }
    }

    function isStoredFile(material) {
        if (!material || material.id === undefined || material.id === null) return false;
        if (STORED_FILE_TYPES.includes(material.tipo)) return true;
        const value = String(material.urlOrPath || '');
        return /^\/?uploads[\\/]/i.test(value) || /^https:\/\/res\.cloudinary\.com\//i.test(value);
    }

    function apiFileHref(material, action = 'file') {
        if (!isStoredFile(material)) return '';
        return `/api/materials/${encodeURIComponent(material.id)}/${action}`;
    }

    function fileHref(material) {
        const stored = apiFileHref(material, 'file');
        if (stored) return stored;
        return safeHref(material && material.urlOrPath);
    }

    function isPdf(material) {
        return Boolean(material && material.tipo === 'PDF' && fileHref(material));
    }

    function isYoutube(material) {
        return Boolean(material && (material.tipo === 'Youtube' || youtubeId(material.urlOrPath)));
    }

    function downloadName(material) {
        const path = String(material && material.urlOrPath || '').split(/[?#]/)[0];
        const match = path.match(/\.([a-z0-9]{2,5})$/i);
        let extension = match ? `.${match[1].toLowerCase()}` : '';
        if (!extension) extension = EXTENSIONS[material && material.tipo] || '';
        const base = String(material && material.titulo || 'material')
            .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 120) || 'material';
        return extension && !base.toLowerCase().endsWith(extension) ? base + extension : base;
    }

    function downloadHref(material) {
        const apiHref = apiFileHref(material, 'download');
        if (apiHref) return apiHref;
        return safeHref(material && material.urlOrPath);
    }

    function downloadButton(material, className = 'bt-btn bt-btn--secondary') {
        const href = downloadHref(material);
        if (!href) return null;
        const attrs = { href };
        const direct = safeHref(material && material.urlOrPath);
        const sameOriginApi = href !== direct;
        if (!sameOriginApi) {
            attrs.download = downloadName(material);
            try {
                if (new URL(href).origin !== window.location.origin) {
                    attrs.target = '_blank';
                    attrs.rel = 'noopener';
                }
            } catch (error) { attrs.download = ''; }
        }
        const children = [];
        if (typeof Icons !== 'undefined') children.push(Icons.download());
        children.push(label('common.download'));
        return el('a', { className, attrs }, children);
    }

    function closeActive() {
        if (active) active.close();
    }

    function open(material, options = {}) {
        if (!material) return;
        const href = fileHref(material);
        if (!href) return;
        const videoId = youtubeId(href);
        const video = Boolean(videoId);
        const pdf = !video && isPdf(material);
        if (!video && !pdf) {
            window.open(downloadHref(material) || href, '_blank', 'noopener');
            return;
        }

        closeActive();
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        let closed = false;
        const titleId = `btViewerTitle${++sequence}`;
        const dialog = el('div', {
            className: `bt-modal bt-viewer-modal${video ? ' bt-viewer-modal--video' : ''}`,
            attrs: {
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': titleId
            }
        });

        const closeBtn = el('button', {
            className: 'bt-modal__close',
            attrs: { type: 'button', 'aria-label': label('common.close') }
        });
        closeBtn.appendChild(typeof Icons !== 'undefined' ? Icons.close() : document.createTextNode('×'));

        const header = el('div', { className: 'bt-viewer__head' }, [
            el('div', { className: 'bt-viewer__heading' }, [
                el('span', {
                    className: 'bt-viewer__eyebrow',
                    text: label(video ? 'material.youtubeVideo' : 'material.pdfViewer')
                }),
                el('h3', { className: 'bt-modal__title', id: titleId, text: material.titulo })
            ]),
            closeBtn
        ]);

        let body;
        let frame;
        let footer;
        let trackingTimer = null;

        if (video) {
            const embed = `https://www.youtube.com/embed/${videoId}?rel=0&playsinline=1`;
            frame = el('iframe', {
                className: 'bt-viewer__frame',
                attrs: {
                    src: embed,
                    title: label('material.youtubeFrameTitle', { title: material.titulo }),
                    loading: 'eager',
                    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                    allowfullscreen: '',
                    referrerpolicy: 'strict-origin-when-cross-origin'
                }
            });
            body = el('div', { className: 'bt-viewer__body bt-viewer__body--video' }, [
                el('div', { className: 'bt-viewer__video' }, [frame])
            ]);

            const youtubeLink = el('a', {
                className: 'bt-btn bt-btn--youtube',
                attrs: { href, target: '_blank', rel: 'noopener noreferrer' }
            }, [
                typeof Icons !== 'undefined' ? Icons.play() : null,
                label('material.watchOnYoutube')
            ]);

            footer = el('div', { className: 'bt-viewer__footer bt-viewer__footer--video' }, [
                el('p', { className: 'bt-viewer__hint', text: label('material.youtubeHint') }),
                youtubeLink
            ]);
        } else {
            const initialPage = Math.max(0, Number(options.startPage) || 0);
            const frameSrc = page => page > 0 ? `${href}#page=${page}` : href;
            frame = el('iframe', {
                className: 'bt-viewer__frame',
                attrs: {
                    src: frameSrc(initialPage),
                    title: label('material.pdfFrameTitle', { title: material.titulo }),
                    loading: 'eager',
                    allowfullscreen: ''
                }
            });
            body = el('div', { className: 'bt-viewer__body' }, [frame]);

            const pageInput = el('input', {
                className: 'bt-input bt-input--page',
                attrs: { type: 'number', min: '1', step: '1', inputmode: 'numeric', 'aria-label': label('material.currentPage') },
                value: initialPage || ''
            });
            const totalInput = el('input', {
                className: 'bt-input bt-input--page',
                attrs: { type: 'number', min: '1', step: '1', inputmode: 'numeric', 'aria-label': label('material.totalPages') },
                value: Number(material.pages) > 0 ? String(material.pages) : ''
            });
            const saveProgress = el('button', {
                className: 'bt-btn bt-btn--sm bt-btn--secondary',
                attrs: { type: 'button' },
                text: label('material.saveProgress')
            });

            const applyPage = async (notify = false) => {
                const page = Math.max(1, Number(pageInput.value) || 1);
                let total = Math.max(0, Number(totalInput.value) || 0);
                if (!total && Number(material.pages) > 0) total = Number(material.pages);
                if (!total) {
                    Toast.error(label('material.pagesRequired'));
                    totalInput.focus();
                    return;
                }
                frame.setAttribute('src', `${href}#page=${page}`);
                if (typeof apiService === 'undefined' || !authHelper?.isAuthenticated()) return;
                try {
                    const result = await apiService.put(`/reads/${material.id}/progress`, {
                        currentPage: page,
                        totalPages: total || null
                    });
                    material.backlogCurrentPage = page;
                    material.backlogTotalPages = total;
                    const state = result.read || {};
                    material.inBacklog = !state.completed;
                    if (state.completed) {
                        material.isRead = true;
                        material.inBacklog = false;
                        Toast.success(label('messages.backlogCompletedRead'));
                        if (typeof options.onProgress === 'function') options.onProgress(state);
                    } else if (notify) {
                        Toast.success(label('messages.progressSaved'));
                    }
                } catch (error) {
                    if (notify) Toast.error(error.message);
                }
            };

            saveProgress.addEventListener('click', () => applyPage(true));
            pageInput.addEventListener('change', () => applyPage(false));
            totalInput.addEventListener('change', () => applyPage(false));
            pageInput.addEventListener('keydown', event => {
                if (event.key === 'Enter') { event.preventDefault(); applyPage(true); }
            });

            if (authHelper?.isAuthenticated() && typeof apiService !== 'undefined') {
                apiService.get(`/reads/${material.id}`).then(result => {
                    const progress = result.progress;
                    if (!progress) return;
                    if (Number(progress.currentPage) > 0) {
                        pageInput.value = String(progress.currentPage);
                        frame.setAttribute('src', `${href}#page=${progress.currentPage}`);
                    }
                    if (Number(progress.totalPages) > 0) totalInput.value = String(progress.totalPages);
                }).catch(() => {});
            }

            const newTab = el('a', {
                className: 'bt-btn bt-btn--ghost',
                attrs: { href, target: '_blank', rel: 'noopener' }
            }, [
                typeof Icons !== 'undefined' ? Icons.external() : null,
                label('material.openNewTab')
            ]);
            footer = el('div', { className: 'bt-viewer__footer bt-viewer__footer--progress' }, [
                el('p', { className: 'bt-viewer__hint', text: label('material.pdfHint') }),
                el('div', { className: 'bt-viewer__progress' }, [
                    el('label', { className: 'bt-label', text: label('material.currentPage') }, [pageInput]),
                    el('label', { className: 'bt-label', text: label('material.totalPages') }, [totalInput]),
                    saveProgress
                ]),
                el('div', { className: 'bt-viewer__actions' }, [newTab])
            ]);
        }

        const content = el('div', { className: 'bt-modal__content', attrs: { role: 'document' } }, [
            header,
            body,
            footer
        ]);
        dialog.appendChild(content);

        function focusable() {
            return [...dialog.querySelectorAll('button, a[href], iframe, [tabindex]:not([tabindex="-1"])')]
                .filter(node => !node.disabled);
        }

        function onKeydown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
                return;
            }
            if (event.key !== 'Tab') return;
            const nodes = focusable();
            if (!nodes.length) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        function close() {
            if (closed) return;
            closed = true;
            if (trackingTimer) clearInterval(trackingTimer);
            if (authHelper?.isAuthenticated() && typeof apiService !== 'undefined') {
                apiService.post('/streaks/reset', { materialId: material.id }).catch(() => {});
            }
            document.removeEventListener('keydown', onKeydown);
            if (frame) frame.setAttribute('src', 'about:blank');
            dialog.remove();
            if (active && active.dialog === dialog) active = null;
            document.body.style.overflow = previousOverflow;
            if (previousFocus && previousFocus.isConnected) previousFocus.focus();
            if (typeof options.onClose === 'function') options.onClose();
        }

        closeBtn.addEventListener('click', close);
        dialog.addEventListener('click', event => {
            if (event.target === dialog) close();
        });

        if (authHelper?.isAuthenticated() && typeof apiService !== 'undefined') {
            const record = () => {
                if (document.visibilityState !== 'visible') return;
                apiService.post('/streaks/heartbeat', {
                    materialId: material.id
                }).catch(() => {});
            };
            trackingTimer = setInterval(record, 60000);
        }

        document.body.appendChild(dialog);
        dialog.setAttribute('open', '');
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKeydown);
        active = { dialog, close };
        closeBtn.focus();
    }

    return {
        open,
        close: closeActive,
        isPdf,
        isYoutube,
        safeHref,
        youtubeId,
        fileHref,
        downloadHref,
        downloadName,
        downloadButton
    };
})();

export { MaterialViewer };
