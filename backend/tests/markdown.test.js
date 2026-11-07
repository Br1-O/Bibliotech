const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeHtml, inline, renderMarkdown } = require('../utils/markdown');

test('escapeHtml neutralizes markup characters', () => {
    assert.equal(
        escapeHtml('<script>"x" & \'y\'</script>'),
        '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;'
    );
});

test('inline renders code, emphasis and safe links', () => {
    assert.equal(inline('**bold** _italic_ `a < b`'), '<strong>bold</strong> <em>italic</em> <code>a &lt; b</code>');
    assert.equal(
        inline('[docs](https://example.com/a?b=1&c=2)'),
        '<a href="https://example.com/a?b=1&amp;c=2">docs</a>'
    );
    assert.equal(inline('[`openapi.yaml`](openapi.yaml)'), '<a href="openapi.yaml"><code>openapi.yaml</code></a>');
    assert.equal(inline('[bad](javascript:alert(1))'), '[bad](javascript:alert(1))');
});

test('renderMarkdown renders headings, lists, tables and fenced code', () => {
    const html = renderMarkdown(
        [
            '# Title',
            '',
            '## Title',
            '',
            '- one',
            '- two',
            '',
            '| Name | Description |',
            '| :--- | ---: |',
            '| `id` | identifier |',
            '',
            '```js',
            'const value = "<tag>";',
            '```'
        ].join('\n')
    );

    assert.match(html, /<h1 id="title">Title<\/h1>/);
    assert.match(html, /<h2 id="title-1">Title<\/h2>/);
    assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
    assert.match(html, /<th style="text-align:left">Name<\/th>/);
    assert.match(html, /<th style="text-align:right">Description<\/th>/);
    assert.match(html, /<td style="text-align:left"><code>id<\/code><\/td>/);
    assert.match(html, /<pre class="doc-code language-js"><code>const value = &quot;&lt;tag&gt;&quot;;<\/code><\/pre>/);
});

test('renderMarkdown escapes raw html and blockquotes', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>\n\n> quoted **text**');
    assert.equal(html.includes('<img'), false);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(html, /<blockquote>quoted <strong>text<\/strong><\/blockquote>/);
});
