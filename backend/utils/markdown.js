const HTML_ENTITIES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
}

function safeHref(value) {
    const url = String(value).trim();
    if (!url) return null;
    if (/^(?:javascript|data|vbscript):/i.test(url)) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^(?:https?|mailto):/i.test(url)) return null;
    return url;
}

function inline(raw) {
    const tokens = [];
    const stash = (html) => {
        tokens.push(html);
        return `\u0000${tokens.length - 1}\u0000`;
    };

    let text = String(raw);
    text = text.replace(/`([^`]+)`/g, (_, code) => stash(`<code>${escapeHtml(code)}</code>`));
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
        const href = safeHref(url);
        if (!href) return `[${label}](${url})`;
        return stash(`<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`);
    });
    text = escapeHtml(text);
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    text = text.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');

    let output = text;
    let previous;
    do {
        previous = output;
        output = output.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)] ?? '');
    } while (output !== previous);
    return output;
}

function splitTableRow(line) {
    let value = line.trim();
    if (value.startsWith('|')) value = value.slice(1);
    if (value.endsWith('|')) value = value.slice(0, -1);
    return value.split('|').map((cell) => cell.trim());
}

function isTableSeparator(line) {
    const cells = splitTableRow(line);
    return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isBlockStart(lines, index) {
    const line = lines[index];
    return (
        /^\s*(```|~~~)/.test(line) ||
        /^\s{0,3}#{1,6}\s+/.test(line) ||
        /^\s*(?:---|\*\*\*|___)\s*$/.test(line) ||
        /^\s*>\s?/.test(line) ||
        /^\s*(?:[-*+]|\d+\.)\s+/.test(line) ||
        (line.includes('|') && Boolean(lines[index + 1]) && isTableSeparator(lines[index + 1]))
    );
}

function renderTable(lines, start) {
    const headers = splitTableRow(lines[start]);
    const separators = splitTableRow(lines[start + 1]);
    const alignments = separators.map((cell) => {
        const left = cell.startsWith(':');
        const right = cell.endsWith(':');
        if (left && right) return 'center';
        if (right) return 'right';
        if (left) return 'left';
        return '';
    });

    let index = start + 2;
    const rows = [];
    while (index < lines.length && lines[index].trim() !== '' && lines[index].includes('|')) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
    }

    const cell = (tag, value, column) => {
        const alignment = alignments[column] ? ` style="text-align:${alignments[column]}"` : '';
        return `<${tag}${alignment}>${inline(value)}</${tag}>`;
    };

    const head = headers.map((header, column) => cell('th', header, column)).join('');
    const body = rows
        .map((row) => `<tr>${headers.map((_, column) => cell('td', row[column] || '', column)).join('')}</tr>`)
        .join('');

    return {
        html: `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`,
        next: index
    };
}

function renderList(lines, start) {
    const first = lines[start].match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    const ordered = /^\d+\./.test(first[2]);
    const tag = ordered ? 'ol' : 'ul';
    const items = [];
    let index = start;

    while (index < lines.length) {
        const match = lines[index].match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
        if (!match) break;
        let content = match[3];
        index += 1;
        while (
            index < lines.length &&
            lines[index].trim() !== '' &&
            /^\s{2,}\S/.test(lines[index]) &&
            !/^(\s*)([-*+]|\d+\.)\s+/.test(lines[index])
        ) {
            content += ` ${lines[index].trim()}`;
            index += 1;
        }
        items.push(`<li>${inline(content)}</li>`);
    }

    return { html: `<${tag}>${items.join('')}</${tag}>`, next: index };
}

function headingId(value, ids) {
    const base =
        String(value)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'section';
    const count = ids.get(base) || 0;
    ids.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
}

function renderMarkdown(source) {
    const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
    const ids = new Map();
    let html = '';
    let index = 0;

    while (index < lines.length) {
        const line = lines[index];
        if (line.trim() === '') {
            index += 1;
            continue;
        }

        const fence = line.match(/^\s*(```+|~~~+)\s*([\w-]*)\s*$/);
        if (fence) {
            const marker = fence[1][0];
            const markerPattern = new RegExp(`^\\s*${marker}{${fence[1].length},}\\s*$`);
            const code = [];
            index += 1;
            while (index < lines.length && !markerPattern.test(lines[index])) {
                code.push(lines[index]);
                index += 1;
            }
            if (index < lines.length) index += 1;
            const language = fence[2] ? ` language-${escapeHtml(fence[2])}` : '';
            html += `<pre class="doc-code${language}"><code>${escapeHtml(code.join('\n'))}</code></pre>`;
            continue;
        }

        const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
        if (heading) {
            const level = heading[1].length;
            html += `<h${level} id="${headingId(heading[2], ids)}">${inline(heading[2])}</h${level}>`;
            index += 1;
            continue;
        }

        if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
            html += '<hr>';
            index += 1;
            continue;
        }

        if (line.includes('|') && lines[index + 1] && isTableSeparator(lines[index + 1])) {
            const table = renderTable(lines, index);
            html += table.html;
            index = table.next;
            continue;
        }

        if (/^\s*>\s?/.test(line)) {
            const quote = [];
            while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
                quote.push(lines[index].replace(/^\s*>\s?/, ''));
                index += 1;
            }
            html += `<blockquote>${inline(quote.join(' '))}</blockquote>`;
            continue;
        }

        if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) {
            const list = renderList(lines, index);
            html += list.html;
            index = list.next;
            continue;
        }

        const paragraph = [];
        while (index < lines.length && lines[index].trim() !== '' && !isBlockStart(lines, index)) {
            paragraph.push(lines[index].trim());
            index += 1;
        }
        html += `<p>${inline(paragraph.join(' '))}</p>`;
    }

    return html;
}

module.exports = {
    escapeHtml,
    inline,
    renderMarkdown
};
