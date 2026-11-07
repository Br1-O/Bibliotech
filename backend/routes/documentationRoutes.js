const express = require('express');
const fs = require('fs');
const path = require('path');
const { escapeHtml, renderMarkdown } = require('../utils/markdown');

const DOCS_DIR = path.join(__dirname, '..', '..', 'docs');
const DIAGRAMS_DIR = path.join(DOCS_DIR, 'diagrams');
const DIAGRAM_FILE = /^\d{2}_[a-z0-9_]+\.(?:mmd|pdf)$/;
const PDF_ASSETS = new Map([
    ['class_diagram.pdf', 'class_diagram.pdf'],
    ['database_diagram.pdf', 'database_diagram.pdf'],
    ['professor_sequence_diagrams.pdf', 'professor_sequence_diagrams.pdf']
]);
const cache = new Map();

const NAV = [
    { id: 'api', href: '/api/documentation', label: 'API' },
    { id: 'home', href: '/api/documentation/overview', label: 'Guía' },
    { id: 'architecture', href: '/api/documentation/architecture', label: 'Arquitectura' },
    { id: 'adr', href: '/api/documentation/adr', label: 'Decisiones' },
    { id: 'classes', href: '/api/documentation/classes', label: 'Clases' },
    { id: 'sequences', href: '/api/documentation/sequences', label: 'Secuencias' },
    { id: 'database', href: '/api/documentation/db', label: 'Base de datos' },
    { id: 'diagrams', href: '/api/documentation/diagrams', label: 'Diagramas' },
    { id: 'openapi', href: '/api/documentation/openapi', label: 'OpenAPI' }
];

const STYLES = `
:root {
    color-scheme: light dark;
    --bg: #f5f7fb;
    --surface: #ffffff;
    --text: #18202b;
    --muted: #5c6778;
    --line: #d8dee8;
    --accent: #2457d6;
    --accent-soft: #e8eefc;
    --code: #eef2f8;
}
@media (prefers-color-scheme: dark) {
    :root {
        --bg: #0e141d;
        --surface: #151d29;
        --text: #edf2f9;
        --muted: #a9b5c6;
        --line: #2a3648;
        --accent: #7ea6ff;
        --accent-soft: #1b2b4a;
        --code: #111a26;
    }
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.6;
}
a { color: var(--accent); }
.wrap { width: min(1120px, calc(100% - 32px)); margin: 0 auto; }
.hero {
    padding: 42px 0 26px;
    border-bottom: 1px solid var(--line);
    background:
        radial-gradient(circle at top right, var(--accent-soft), transparent 42%),
        var(--surface);
}
.brand {
    margin: 0 0 12px;
    font-size: .78rem;
    font-weight: 700;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--accent);
}
.hero h1 { margin: 0; font-size: clamp(2rem, 5vw, 3.2rem); line-height: 1.1; }
.hero .lead { margin: 14px 0 0; max-width: 76ch; color: var(--muted); font-size: 1.05rem; }
.tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 16px 0;
}
.tabs a {
    padding: 8px 14px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    font-size: .92rem;
    font-weight: 600;
}
.tabs a:hover { border-color: var(--accent); }
.tabs a.active { background: var(--accent); border-color: var(--accent); color: #fff; }
main { padding: 28px 0 56px; }
.cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin: 24px 0;
}
.card {
    display: block;
    padding: 20px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
    color: inherit;
    text-decoration: none;
    transition: transform .15s ease, border-color .15s ease;
}
.card:hover { transform: translateY(-2px); border-color: var(--accent); }
.card h2 { margin: 6px 0 8px; font-size: 1.12rem; }
.card p { margin: 0 0 14px; color: var(--muted); }
.card-kicker {
    color: var(--accent);
    font-size: .72rem;
    font-weight: 800;
    letter-spacing: .09em;
    text-transform: uppercase;
}
.card-link { font-weight: 700; font-size: .9rem; }
.button-row { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0; }
.button {
    display: inline-block;
    padding: 10px 16px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    font-weight: 700;
}
.button:hover { border-color: var(--accent); }
.button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.callout {
    margin: 20px 0;
    padding: 18px 20px;
    border: 1px solid var(--line);
    border-left: 4px solid var(--accent);
    border-radius: 12px;
    background: var(--surface);
}
.callout p { margin-top: 0; }
.summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin: 20px 0;
}
.summary div {
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
}
.summary strong { display: block; font-size: 1.35rem; }
.summary span { color: var(--muted); font-size: .85rem; }
.pdf-frame {
    width: 100%;
    height: min(72vh, 820px);
    margin: 16px 0 30px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: #fff;
}
.markdown h1, .markdown h2, .markdown h3, .markdown h4 { line-height: 1.25; }
.markdown h1 { font-size: 2rem; }
.markdown h2 {
    margin-top: 1.8em;
    padding-bottom: .3em;
    border-bottom: 1px solid var(--line);
    font-size: 1.45rem;
}
.markdown h3 { margin-top: 1.5em; font-size: 1.16rem; }
.markdown p { margin: .8em 0; }
.markdown code {
    padding: .15em .35em;
    border-radius: 5px;
    background: var(--code);
    font-size: .9em;
}
.markdown pre {
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--code);
    overflow: auto;
}
.markdown pre code { padding: 0; background: transparent; }
.table-wrap { margin: 16px 0; overflow-x: auto; }
.doc-table, .markdown table {
    width: 100%;
    border-collapse: collapse;
    font-size: .92rem;
}
.doc-table th, .doc-table td, .markdown th, .markdown td {
    padding: 8px 10px;
    border: 1px solid var(--line);
    vertical-align: top;
}
.doc-table th, .markdown th { background: var(--code); text-align: left; }
.markdown blockquote {
    margin: 16px 0;
    padding: 12px 16px;
    border-left: 4px solid var(--accent);
    border-radius: 8px;
    background: var(--surface);
    color: var(--muted);
}
.markdown hr { margin: 28px 0; border: 0; border-top: 1px solid var(--line); }
.markdown ul, .markdown ol { padding-left: 1.4em; }
footer { padding: 20px 0; border-top: 1px solid var(--line); color: var(--muted); font-size: .9rem; }
@media (max-width: 700px) {
    .hero { padding-top: 28px; }
    .pdf-frame { height: 60vh; }
}
`;

function readDoc(relativePath) {
    if (!cache.has(relativePath)) {
        cache.set(relativePath, fs.readFileSync(path.join(DOCS_DIR, relativePath), 'utf8'));
    }
    return cache.get(relativePath);
}

function stripTitle(markdown) {
    return String(markdown).replace(/^#\s+.+\n+/, '');
}

function renderLayout({ active, title, subtitle, content }) {
    const tabs = NAV.map((item) => {
        const current = item.id === active;
        return `<a href="${item.href}"${current ? ' class="active" aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`;
    }).join('');

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Bibliotech</title>
<style>${STYLES}</style>
</head>
<body>
<header class="hero">
    <div class="wrap">
        <p class="brand">Bibliotech · Documentación</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="lead">${escapeHtml(subtitle)}</p>
    </div>
</header>
<nav class="tabs wrap" aria-label="Secciones de documentación">${tabs}</nav>
<main class="wrap">${content}</main>
<footer><div class="wrap">Documentación pública de Bibliotech. Sin autenticación.</div></footer>
</body>
</html>`;
}

function sendHtml(res, html) {
    res.set('Cache-Control', 'public, max-age=300');
    return res.type('html').send(html);
}

function notFound(req, res) {
    return res.status(404).json({ message: req.t ? req.t('errors.notFound') : 'Not found' });
}

function sendPdf(req, res, fileName, filePath) {
    return fs.readFile(filePath, (error, content) => {
        if (error) return notFound(req, res);
        res.set('Cache-Control', 'public, max-age=3600');
        res.set('Content-Disposition', `inline; filename="${fileName}"`);
        return res.type('application/pdf').send(content);
    });
}

function rewriteDocLinks(html) {
    return html
        .replace(/href="openapi\.yaml"/g, 'href="/api/docs/openapi.yaml"')
        .replace(/href="openapi\.json"/g, 'href="/api/docs/openapi.json"')
        .replace(/href="class_diagram\.(?:txt|pdf)"/g, 'href="/api/documentation/classes"')
        .replace(/href="database_diagram\.(?:txt|pdf)"/g, 'href="/api/documentation/db"')
        .replace(/href="professor_sequence_diagrams\.(?:txt|pdf)"/g, 'href="/api/documentation/sequences"')
        .replace(/href="adr\/README\.md"/g, 'href="/api/documentation/adr"')
        .replace(/href="adr\/([^"]+)"/g, 'href="/api/documentation/adr/$1"');
}

function rewriteAdrLinks(html) {
    return rewriteDocLinks(html)
        .replace(/href="(\d{4}-[a-z0-9-]+\.md)"/g, 'href="/api/documentation/adr/$1"')
        .replace(/href="README\.md"/g, 'href="/api/documentation/adr"');
}

function renderDocPage({ active, title, subtitle, markdown, pdf, description, linkRewriter = rewriteDocLinks }) {
    const parts = [];
    if (description) parts.push(`<p class="lead">${escapeHtml(description)}</p>`);
    if (pdf) {
        parts.push(
            `<div class="button-row"><a class="button primary" href="/api/documentation/assets/${pdf}" target="_blank" rel="noopener">Abrir PDF completo</a></div>`,
            `<iframe class="pdf-frame" src="/api/documentation/assets/${pdf}" title="${escapeHtml(title)}"></iframe>`
        );
    }
    parts.push(`<article class="markdown">${linkRewriter(renderMarkdown(stripTitle(markdown)))}</article>`);
    return renderLayout({ active, title, subtitle, content: parts.join('') });
}

function openApiSummary() {
    try {
        const spec = JSON.parse(fs.readFileSync(path.join(DOCS_DIR, 'openapi.json'), 'utf8'));
        return {
            title: spec.info?.title || 'Bibliotech API Documentation',
            version: spec.info?.version || '1.0.0',
            paths: Object.keys(spec.paths || {}).length,
            tags: (spec.tags || []).map((tag) => tag.name).filter(Boolean)
        };
    } catch (error) {
        return null;
    }
}

function renderApiReference() {
    const fallback = `<div class="api-fallback">
        <h1>Bibliotech API Documentation</h1>
        <p>No se pudo cargar el visor interactivo desde el CDN.</p>
        <p>
            Puedes consultar el contrato directamente en
            <a href="/api/docs/openapi.yaml">YAML</a> o
            <a href="/api/docs/openapi.json">JSON</a>, o abrir la
            <a href="/api/documentation/overview">guía técnica</a>.
        </p>
    </div>`;

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="description" content="Referencia interactiva de la API de Bibliotech">
<title>Bibliotech API Documentation</title>
<style>
html, body { margin: 0; padding: 0; min-height: 100%; background: #f5f7fb; }
body {
    color: #18202b;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
#redoc { min-height: 100vh; }
.api-fallback {
    max-width: 760px;
    margin: 0 auto;
    padding: 96px 24px;
}
.api-fallback h1 {
    margin: 0 0 16px;
    font-size: clamp(2rem, 5vw, 3rem);
    line-height: 1.1;
}
.api-fallback p { margin: 12px 0; color: #5c6778; font-size: 1.05rem; }
.api-fallback a { color: #2457d6; font-weight: 700; }
.api-fallback code {
    padding: 2px 6px;
    border-radius: 6px;
    background: #eef2f8;
    color: #18202b;
}
.api-guide {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 1000;
    padding: 8px 14px;
    border: 1px solid #d8dee8;
    border-radius: 999px;
    background: rgba(255, 255, 255, .94);
    color: #2457d6;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    box-shadow: 0 6px 20px rgba(24, 32, 43, .15);
    backdrop-filter: blur(8px);
}
.api-guide:hover { background: #e8eefc; }
@media (max-width: 640px) {
    .api-guide { right: 10px; bottom: 10px; }
}
</style>
</head>
<body>
<div id="redoc"></div>
<a class="api-guide" href="/api/documentation/overview">Guía técnica</a>
<noscript>${fallback}</noscript>
<script type="module">
const root = document.getElementById('redoc');
const fallback = ${JSON.stringify(fallback)};
import('https://cdn.redoc.ly/redoc/v3.1.0/bundles/redoc.standalone.js')
    .then(({ init }) => {
        if (typeof init !== 'function') throw new Error('Redoc no esta disponible');
        init(
            '/api/docs/openapi.json',
            {
                disableTelemetry: true,
                hideDownloadButton: false,
                theme: {
                    colors: { primary: { main: '#2457d6' } },
                    typography: {
                        fontSize: '15px',
                        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                    },
                    sidebar: {
                        backgroundColor: '#f5f7fb',
                        activeTextColor: '#2457d6'
                    }
                }
            },
            root
        );
    })
    .catch(() => {
        root.innerHTML = fallback;
    });
</script>
</body>
</html>`;
}

function renderHome() {
    const cards = [
        [
            'API',
            'Referencia interactiva',
            'Explora endpoints, esquemas y respuestas con búsqueda y navegación por etiquetas.',
            '/api/documentation'
        ],
        [
            'Arquitectura',
            'Arquitectura explicada',
            'Capas hexagonales, topología, flujo de una petición y decisiones de diseño.',
            '/api/documentation/architecture'
        ],
        [
            'Modelo',
            'Diagramas de clases',
            'Entidades, puertos, servicios, adaptadores y componentes del frontend.',
            '/api/documentation/classes'
        ],
        [
            'Flujos',
            'Diagramas de secuencia',
            'Login, publicación, moderación y resto de acciones principales del profesor.',
            '/api/documentation/sequences'
        ],
        [
            'Datos',
            'Base de datos',
            'Modelo entidad-relación, diccionario de tablas, estados e integridad.',
            '/api/documentation/db'
        ],
        [
            'Diagramas',
            'Diagramas del sistema',
            'Fuentes Mermaid y PDF de contexto, despliegue, seguridad y arquitectura objetivo.',
            '/api/documentation/diagrams'
        ],
        [
            'Contrato',
            'OpenAPI',
            'Especificación pública lista para importar en Postman, Insomnia o Swagger Editor.',
            '/api/documentation/openapi'
        ]
    ];

    const content = `
<p class="lead">Documentación técnica pública del sistema. Cada sección se sirve desde el backend, no requiere JWT y no expone configuración ni secretos.</p>
<div class="cards">
    ${cards
        .map(
            ([kicker, title, text, href]) => `<a class="card" href="${href}">
        <span class="card-kicker">${escapeHtml(kicker)}</span>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(text)}</p>
        <span class="card-link">Abrir sección</span>
    </a>`
        )
        .join('')}
</div>
<div class="callout">
    <p><strong>Especificación OpenAPI:</strong> <a href="/api/docs/openapi.yaml">YAML</a> · <a href="/api/docs/openapi.json">JSON</a></p>
    <p>Las rutas de documentación son públicas y de solo lectura.</p>
</div>`;

    return renderLayout({
        active: 'home',
        title: 'Guía técnica',
        subtitle: 'Arquitectura, diagramas y contrato HTTP de Bibliotech.',
        content
    });
}

function renderOpenApi() {
    const summary = openApiSummary();
    const summaryHtml = summary
        ? `<div class="summary">
    <div><strong>${escapeHtml(summary.title)}</strong><span>API</span></div>
    <div><strong>${escapeHtml(summary.version)}</strong><span>Versión</span></div>
    <div><strong>${summary.paths}</strong><span>Rutas</span></div>
    <div><strong>${summary.tags.length}</strong><span>Etiquetas</span></div>
</div>`
        : '';

    const content = `
<p class="lead">La especificación OpenAPI estática vive en <code>docs/openapi.yaml</code> y se publica tal cual. También hay una versión JSON generada para herramientas que la prefieren.</p>
<div class="button-row">
    <a class="button primary" href="/api/documentation">Abrir referencia interactiva</a>
    <a class="button" href="/api/docs/openapi.yaml">Descargar YAML</a>
    <a class="button" href="/api/docs/openapi.json">Descargar JSON</a>
    <a class="button" href="/api/documentation/architecture">Ver arquitectura</a>
</div>
${summaryHtml}
<div class="callout">
    <p><strong>Importar en Postman, Insomnia o Swagger Editor</strong></p>
    <ol>
        <li>Elegir importar desde URL o enlace.</li>
        <li>Usar una de las rutas públicas anteriores, por ejemplo <code>/api/docs/openapi.json</code>.</li>
        <li>No hace falta token JWT para descargar la especificación.</li>
    </ol>
    <p>Los endpoints de negocio conservan sus propios requisitos de autenticación, definidos dentro del contrato.</p>
</div>`;

    return renderLayout({
        active: 'openapi',
        title: 'OpenAPI',
        subtitle: 'Contrato HTTP público de Bibliotech.',
        content
    });
}

function diagramGroups() {
    const groups = new Map();
    for (const file of fs
        .readdirSync(DIAGRAMS_DIR)
        .filter((name) => DIAGRAM_FILE.test(name))
        .sort()) {
        const base = file.replace(/\.(mmd|pdf)$/, '');
        if (!groups.has(base)) groups.set(base, {});
        groups.get(base)[file.endsWith('.pdf') ? 'pdf' : 'mmd'] = file;
    }
    return groups;
}

function renderDiagrams() {
    const rows = [...diagramGroups().entries()]
        .map(([base, files]) => {
            const label = base.replace(/^\d+_/, '').replace(/_/g, ' ');
            const source = files.mmd
                ? `<a href="/api/documentation/diagrams/${encodeURIComponent(files.mmd)}">Mermaid</a>`
                : '';
            const pdf = files.pdf
                ? `<a href="/api/documentation/diagrams/${encodeURIComponent(files.pdf)}">PDF</a>`
                : '';
            return `<tr><td>${escapeHtml(label)}</td><td>${source}</td><td>${pdf}</td></tr>`;
        })
        .join('');

    const content = `
<p class="lead">Diagramas de arquitectura, despliegue, seguridad, ciclos de vida y flujos de datos. Los PDF son la vista renderizada; los archivos Mermaid son la fuente editable.</p>
<div class="table-wrap">
    <table class="doc-table">
        <thead><tr><th>Diagrama</th><th>Fuente</th><th>PDF</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>
</div>`;

    return renderLayout({
        active: 'diagrams',
        title: 'Diagramas del sistema',
        subtitle: 'Vistas de contexto, capas, despliegue y flujos.',
        content
    });
}

function renderDiagramSource(req, res, fileName) {
    if (!DIAGRAM_FILE.test(fileName)) return notFound(req, res);
    const filePath = path.join(DIAGRAMS_DIR, fileName);
    if (!fs.existsSync(filePath)) return notFound(req, res);

    if (fileName.endsWith('.pdf')) return sendPdf(req, res, fileName, filePath);

    const base = fileName.replace(/\.mmd$/, '');
    const pdfFile = `${base}.pdf`;
    const source = fs.readFileSync(filePath, 'utf8');
    const pdfLink = fs.existsSync(path.join(DIAGRAMS_DIR, pdfFile))
        ? `<div class="button-row"><a class="button primary" href="/api/documentation/diagrams/${encodeURIComponent(pdfFile)}">Abrir PDF renderizado</a></div>`
        : '';

    return sendHtml(
        res,
        renderLayout({
            active: 'diagrams',
            title: base.replace(/^\d+_/, '').replace(/_/g, ' '),
            subtitle: 'Fuente Mermaid',
            content: `${pdfLink}<pre class="doc-code"><code>${escapeHtml(source)}</code></pre>`
        })
    );
}

module.exports = () => {
    const router = express.Router();

    router.get('/', (req, res) => sendHtml(res, renderApiReference()));
    router.get('/overview', (req, res) => sendHtml(res, renderHome()));

    router.get('/architecture', (req, res) =>
        sendHtml(
            res,
            renderDocPage({
                active: 'architecture',
                title: 'Arquitectura explicada',
                subtitle: 'Capas, topología, flujo de peticiones y decisiones de diseño.',
                markdown: readDoc('architecture.md'),
                description: 'Vista completa de la arquitectura hexagonal implementada, sus límites y sus brechas.'
            })
        )
    );

    router.get('/adr', (req, res) =>
        sendHtml(
            res,
            renderDocPage({
                active: 'adr',
                title: 'Decisiones de arquitectura',
                subtitle: 'Architecture Decision Records y justificación de las decisiones.',
                markdown: readDoc('adr/README.md'),
                description: 'Registro de decisiones que explican por qué el sistema está construido de esta forma.',
                linkRewriter: rewriteAdrLinks
            })
        )
    );

    router.get('/adr/:file', (req, res) => {
        const fileName = req.params.file;
        if (!/^\d{4}-[a-z0-9-]+\.md$/.test(fileName)) return notFound(req, res);
        const filePath = path.join(DOCS_DIR, 'adr', fileName);
        if (!fs.existsSync(filePath)) return notFound(req, res);
        const markdown = fs.readFileSync(filePath, 'utf8');
        const title = (markdown.match(/^#\s+(.+)$/m) || [])[1] || 'Decision de arquitectura';
        return sendHtml(
            res,
            renderDocPage({
                active: 'adr',
                title,
                subtitle: 'Architecture Decision Record',
                markdown,
                linkRewriter: rewriteAdrLinks
            })
        );
    });

    router.get('/classes', (req, res) =>
        sendHtml(
            res,
            renderDocPage({
                active: 'classes',
                title: 'Diagramas de clases',
                subtitle: 'Modelo de dominio, puertos, servicios, adaptadores y frontend.',
                markdown: readDoc('class_diagram.txt'),
                pdf: 'class_diagram.pdf',
                description: 'Diagramas de clases y modelo de componentes, con las dependencias entre capas.'
            })
        )
    );

    router.get('/sequences', (req, res) =>
        sendHtml(
            res,
            renderDocPage({
                active: 'sequences',
                title: 'Diagramas de secuencia',
                subtitle: 'Flujos de los casos de uso principales del profesor.',
                markdown: readDoc('professor_sequence_diagrams.txt'),
                pdf: 'professor_sequence_diagrams.pdf',
                description: 'Secuencias de login, publicación, moderación, edición y gestión de observadores.'
            })
        )
    );

    router.get('/db', (req, res) =>
        sendHtml(
            res,
            renderDocPage({
                active: 'database',
                title: 'Base de datos',
                subtitle: 'Modelo entidad-relación, diccionario de tablas e integridad.',
                markdown: readDoc('database_diagram.txt'),
                pdf: 'database_diagram.pdf',
                description: 'Diagrama entidad-relación y explicación de las tablas, relaciones y estados.'
            })
        )
    );

    router.get('/openapi', (req, res) => sendHtml(res, renderOpenApi()));
    router.get('/diagrams', (req, res) => sendHtml(res, renderDiagrams()));

    router.get('/diagrams/:file', (req, res) => renderDiagramSource(req, res, req.params.file));

    router.get('/assets/:file', (req, res) => {
        const fileName = PDF_ASSETS.get(req.params.file);
        if (!fileName) return notFound(req, res);
        const filePath = path.join(DOCS_DIR, fileName);
        if (!fs.existsSync(filePath)) return notFound(req, res);
        return sendPdf(req, res, fileName, filePath);
    });

    return router;
};
