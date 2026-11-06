/**
* Project     : Bibliotech  |  Frontend - Componente
* icons.js: iconos SVG reutilizables, sin dependencias externas.
*/

const Icons = (() => {
    const NS = 'http://www.w3.org/2000/svg';

    function svg(paths, { size = 20, viewBox = '0 0 24 24', className = '' } = {}) {
        const node = document.createElementNS(NS, 'svg');
        node.setAttribute('viewBox', viewBox);
        node.setAttribute('width', String(size));
        node.setAttribute('height', String(size));
        node.setAttribute('fill', 'none');
        node.setAttribute('stroke', 'currentColor');
        node.setAttribute('stroke-width', '1.8');
        node.setAttribute('stroke-linecap', 'round');
        node.setAttribute('stroke-linejoin', 'round');
        node.setAttribute('aria-hidden', 'true');
        node.setAttribute('focusable', 'false');
        if (className) node.setAttribute('class', className);
        paths.forEach(({ d, fill = 'none', tag = 'path' }) => {
            const child = document.createElementNS(NS, tag);
            if (tag === 'path') child.setAttribute('d', d);
            if (tag === 'circle') {
                child.setAttribute('cx', d.cx);
                child.setAttribute('cy', d.cy);
                child.setAttribute('r', d.r);
            }
            child.setAttribute('fill', fill);
            node.appendChild(child);
        });
        return node;
    }

    const icon = (paths, options) => () => svg(paths, options);

    return {
        sun: icon([
            { tag: 'circle', d: { cx: 12, cy: 12, r: 4 } },
            { d: 'M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41' }
        ]),
        moon: icon([{ d: 'M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z' }]),
        eye: icon([
            { d: 'M2.2 12s3.4-6.4 9.8-6.4S21.8 12 21.8 12s-3.4 6.4-9.8 6.4S2.2 12 2.2 12Z' },
            { tag: 'circle', d: { cx: 12, cy: 12, r: 2.8 } }
        ]),
        eyeOff: icon([
            { d: 'M3 3l18 18' },
            { d: 'M10.6 6.1A9.9 9.9 0 0 1 12 6c6.4 0 9.8 6 9.8 6a17 17 0 0 1-3.1 3.8M6.2 6.3C3.6 8 2.2 12 2.2 12s3.4 6.4 9.8 6.4c1.3 0 2.5-.2 3.6-.6' },
            { d: 'M9.9 9.9a3 3 0 0 0 4.2 4.2' }
        ]),
        menu: icon([{ d: 'M4 7h16M4 12h16M4 17h16' }]),
        close: icon([{ d: 'M6 6l12 12M18 6L6 18' }]),
        star: icon([{ d: 'M12 3.4l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.4Z' }], { size: 18 }),
        starFilled: icon([{ d: 'M12 3.4l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.4Z', fill: 'currentColor' }], { size: 18 }),
        book: icon([
            { d: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H11v18H6.5A2.5 2.5 0 0 0 4 23V5.5Z' },
            { d: 'M20 5.5A2.5 2.5 0 0 0 17.5 3H13v18h4.5A2.5 2.5 0 0 1 20 23V5.5Z' }
        ]),
        search: icon([{ tag: 'circle', d: { cx: 11, cy: 11, r: 6.6 } }, { d: 'm16 16 4.2 4.2' }]),
        arrowRight: icon([{ d: 'M5 12h14M13 6l6 6-6 6' }]),
        check: icon([{ d: 'M4.5 12.5l4.5 4.5L19.5 6.5' }]),
        sparkle: icon([{ d: 'M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z' }]),
        clock: icon([{ tag: 'circle', d: { cx: 12, cy: 12, r: 8.2 } }, { d: 'M12 7.5V12l3 2' }]),
        bell: icon([
            { d: 'M18 8.4a6 6 0 0 0-12 0c0 6.6-2.5 7.4-2.5 8.6h17C20.5 15.8 18 15 18 8.4Z' },
            { d: 'M13.7 20.4a2 2 0 0 1-3.4 0' }
        ]),
        heart: icon([{ d: 'M20.8 5.8a5.1 5.1 0 0 0-7.2 0L12 7.4l-1.6-1.6a5.1 5.1 0 0 0-7.2 7.2L12 21l8.8-8a5.1 5.1 0 0 0 0-7.2Z' }]),
        download: icon([{ d: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14' }], { size: 18 }),
        trash: icon([
            { d: 'M4 7h16M9 7V5h6v2M6.5 7l.8 13h9.4l.8-13M10 11v5M14 11v5' }
        ], { size: 18 }),
        layers: icon([
            { d: 'M12 3 3 8l9 5 9-5-9-5Z' },
            { d: 'm3 12 9 5 9-5M3 16l9 5 9-5' }
        ], { size: 18 }),
        external: icon([{ d: 'M14 5h5v5M19 5l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4' }], { size: 18 }),
        play: icon([{ d: 'M8 5.5v13l10-6.5-10-6.5Z', fill: 'currentColor' }], { size: 18 })
    };
})();

export { Icons };
