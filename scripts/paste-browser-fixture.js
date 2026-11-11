"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The editor fixture runs in the page world; content.js runs in an isolated
// extension world. Code HTML follows a native Feishu clipboard sample: a
// code[data-lark-language] element contains a div holding the complete text.
// Tables follow a native document-table sample (table.ace-table with paragraph
// divs in its cells). This models the HTML contract, not Feishu's actual importer.
module.exports = async function testMarkdownPaste(client, contextId, contentSource, clipboardSample) {
  await client.evaluate(`(() => {
    const host = document.createElement('section');
    host.id = 'paste-fixture';
    host.innerHTML = '<div id="paste-editor" contenteditable="true"><span id="paste-target"></span></div>'
      + '<div id="paste-plain" contenteditable="plaintext-only"></div><textarea id="paste-textarea"></textarea>';
    document.body.appendChild(host);
    const fixture = window.__pasteFixture = { blocks: [], events: [], consume: true, undo: [] };
    fixture.listener = event => {
      if (!host.contains(event.target)) return;
      const html = event.clipboardData.getData('text/html');
      fixture.events.push({ html, text: event.clipboardData.getData('text/plain'), target: event.target.id });
      if (!fixture.consume) return;
      event.preventDefault();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const root = doc.querySelector('[data-lark-html-role="root"]') || doc.body;
      fixture.undo.push(fixture.blocks);
      fixture.blocks = html ? Array.from(root.children, node => {
        const table = node.matches('table') ? node : node.querySelector(':scope > table');
        if (table) return {
          type: table.classList.contains('ace-table') ? 'table' : 'html-table',
          cells: Array.from(table.rows, row => Array.from(row.cells, cell => cell.textContent))
        };
        if (node.tagName !== 'PRE') return { type: 'text', text: node.textContent, language: '' };
        const code = node.querySelector(':scope > code[data-lark-language]');
        const content = code?.querySelector(':scope > div');
        return { type: 'code', text: content?.textContent || '', language: code?.getAttribute('data-lark-language') || '' };
      }) : [{ type: 'text', text: event.clipboardData.getData('text/plain'), language: '' }];
    };
    // Installed first, as Feishu's editor listener normally is.
    document.addEventListener('paste', fixture.listener, true);
    fixture.paste = (formats, targetId = 'paste-target', file = false) => {
      fixture.events = [];
      const clipboardData = new DataTransfer();
      for (const [type, value] of Object.entries(formats)) clipboardData.setData(type, value);
      if (file) clipboardData.items.add(new File(['image'], 'image.png', { type: 'image/png' }));
      const event = new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true });
      document.getElementById(targetId).dispatchEvent(event);
      return { prevented: event.defaultPrevented, blocks: fixture.blocks, events: fixture.events,
        toast: document.getElementById('feishu-md-toast')?.textContent || '' };
    };
  })()`);

  await client.evaluate(`window.__pasteSettings = { domains: ['127.0.0.1'], replaceCtrlC: false, convertMarkdownPaste: true };
    window.chrome = { storage: {
      sync: { get: async defaults => ({ ...defaults, ...window.__pasteSettings }) },
      onChanged: { addListener: listener => { window.__pasteStorageChanged = listener; } }
    } };
    window.__pasteInsertions = 0;
    window.__pasteExecCommand = document.execCommand;
    document.execCommand = function (...args) {
      if (args[0] === 'insertHTML') window.__pasteInsertions++;
      return window.__pasteExecCommand.apply(this, args);
    };`, contextId);
  await client.evaluate(contentSource || fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8"), contextId);
  await client.evaluate("Promise.resolve()", contextId);
  const paste = (formats, targetId, file) => client.evaluate(
    "__pasteFixture.paste(" + JSON.stringify(formats) + "," + JSON.stringify(targetId || "paste-target") + "," + Boolean(file) + ")"
  );
  const configure = async values => {
    await client.evaluate("Object.assign(__pasteSettings," + JSON.stringify(values) + "); __pasteStorageChanged({ convertMarkdownPaste: {} }, 'sync')", contextId);
    await client.evaluate("Promise.resolve()", contextId);
  };

  try {
    // Sanitized structure copied from Feishu itself. No document IDs, record
    // metadata, author information, or user document text are retained.
    const nativeCode = '目录/\n├── main.py\n\n  print("<tag>&")\n\treturn value;';
    const nativeHtml = '<div data-lark-html-role="root" data-docx-has-block-data="false"><pre style="white-space:pre;"><code class="language-Markdown" data-lark-language="Markdown" data-wrap="false"><div>目录/\n├── main.py\n\n  print(&quot;&lt;tag&gt;&amp;&quot;)\n\treturn value;</div></code></pre></div>';
    const nativeResult = await paste({ 'text/plain': nativeCode, 'text/html': nativeHtml });
    assert.deepEqual(nativeResult.blocks, [{ type: 'code', text: nativeCode, language: 'Markdown' }]);
    const convertedResult = await paste({ 'text/plain': '```md\n' + nativeCode + '\n```' });
    assert.deepEqual(convertedResult.blocks, nativeResult.blocks, 'Generated code must match the content-bearing native Feishu code structure');
    await client.evaluate('__pasteFixture.blocks = []; __pasteFixture.undo = []');

    const code = '  const tag = "<div>&";\n\n\treturn tag;';
    const markdown = '# 标题\n\n```js\n' + code + '\n```\n\n后文';
    let result = await paste({ "text/plain": markdown });
    assert.equal(result.prevented, true);
    assert.deepEqual(result.blocks, [
      { type: "text", text: "标题", language: "" },
      { type: "code", text: code, language: "JavaScript" },
      { type: "text", text: "后文", language: "" }
    ], "Markdown code must reach the editor's paste importer as a code block");
    assert.equal(result.events.length, 1, "The editor must not also receive the original Markdown paste");
    assert.equal(result.events[0].target, "paste-target", "Preserve the editor's original event target");
    assert.equal(result.toast, "已粘贴为飞书格式");
    assert.equal(await client.evaluate("__pasteInsertions", contextId), 0, "A handled paste must not mutate the editor DOM");
    assert.equal(await client.evaluate("document.getElementById('paste-editor').querySelector('pre') === null"), true);
    await client.evaluate("__pasteFixture.blocks = __pasteFixture.undo.pop()");
    assert.deepEqual(await client.evaluate("__pasteFixture.blocks"), [], "The paste remains one editor undo operation");

    result = await paste({ "text/plain": '~~~python title=example.py\nprint("ok")\n~~~\n\n```\nplain code\n```' });
    assert.deepEqual(result.blocks, [
      { type: "code", text: 'print("ok")', language: "Python" },
      { type: "code", text: "plain code", language: "Plain Text" }
    ]);
    assert.equal(result.events.length, 1);

    // VS Code includes colored HTML when copying Markdown source. A four-tick
    // Markdown fence can contain ordinary three-tick JSON fences, and an open
    // outer fence remains a single code block through the end of the selection.
    const sourceCode = '# 示例\n\n```json\n{"ok": true}\n```\n\n```json\n{"value": "<tag>&"}\n```\n';
    const sourceMarkdown = '#### Prompt\n\n````markdown\n' + sourceCode;
    const sourceHtml = '<div style="white-space:pre;font-family:monospace">' + sourceMarkdown.trimEnd().split('\n').map(line =>
      line ? '<div><span style="color:#0550ae;font-weight:bold">' + line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span></div>' : '<br>'
    ).join('') + '</div>';
    result = await paste({ 'text/plain': sourceMarkdown, 'text/html': sourceHtml });
    assert.deepEqual(result.blocks, [
      { type: 'text', text: 'Prompt', language: '' },
      { type: 'code', text: sourceCode, language: 'Markdown' }
    ], 'Colored Markdown source HTML must not bypass conversion or split nested fences');
    assert.equal(result.events.length, 1);

    const renderedHtml = '<h4>Prompt</h4><pre><code>rendered code</code></pre>';
    result = await paste({ 'text/plain': sourceMarkdown, 'text/html': renderedHtml });
    assert.equal(result.events[0].html, renderedHtml, 'Rendered rich text must retain its native paste path');
    result = await paste({ 'text/plain': sourceMarkdown, 'text/html': '<div data-lark-html-role="root">' + sourceHtml + '</div>' });
    assert.ok(result.events[0].html.includes('data-lark-html-role="root"><div style='), 'Native Feishu HTML must not be reconverted');
    const differentHtml = '<div><span>不同的正文</span></div>';
    result = await paste({ 'text/plain': sourceMarkdown, 'text/html': differentHtml });
    assert.equal(result.events[0].html, differentHtml, 'Unrelated HTML must not be mistaken for Markdown source');

    // Sanitized from the user's second table type: an ace-table document block,
    // rather than a sheet/byte-sheet-html-origin embedded spreadsheet.
    const nativeTableHtml = '<div data-lark-html-role="root" data-docx-has-block-data="false"><div><table class="ace-table" data-ace-table-col-widths="185;406"><colgroup><col width="185"><col width="406"></colgroup><tbody><tr><td colspan="1" rowspan="1"><div class="ace-line"><strong>名称</strong></div></td><td colspan="1" rowspan="1"><div class="ace-line"><strong>含义</strong></div></td></tr><tr><td colspan="1" rowspan="1"><div class="ace-line">value</div></td><td colspan="1" rowspan="1"><div class="ace-line">示例</div></td></tr></tbody></table></div></div>';
    const nativeTableResult = await paste({ 'text/plain': '名称\t含义\nvalue\t示例', 'text/html': nativeTableHtml });
    const convertedTableResult = await paste({ 'text/plain': '| 名称 | 含义 |\n| --- | --- |\n| value | 示例 |' });
    assert.deepEqual(convertedTableResult.blocks, nativeTableResult.blocks, 'Markdown must default to the second, document-table type');
    assert.equal(convertedTableResult.blocks[0].type, 'table');
    assert.equal(convertedTableResult.events.length, 1);
    result = await paste({ 'text/plain': '| 表达式 | 代码 | 空白 |\n| --- | --- | --- |\n| A\\|B | `left|right` | |\n| **加粗** | [链接](https://example.com) | <tag>& |' });
    assert.deepEqual(result.blocks, [{ type: 'table', cells: [
      ['表达式', '代码', '空白'], ['A|B', 'left|right', ''], ['加粗', '链接', '<tag>&']
    ] }]);
    const tableContract = await client.evaluate('((html) => {' +
      'const doc = new DOMParser().parseFromString(html, "text/html"); const table = doc.querySelector("table.ace-table");' +
      'return {cols:table.querySelectorAll("colgroup > col").length,widths:table.getAttribute("data-ace-table-col-widths").split(";").map(Number),' +
      'cells:table.querySelectorAll("td").length,paragraphs:table.querySelectorAll("td > div.ace-line").length,' +
      'headers:table.querySelectorAll("tr:first-child td strong").length,embeddedSheets:doc.querySelectorAll("byte-sheet-html-origin, [data-type=sheet]").length};' +
      '})(' + JSON.stringify(result.events[0].html) + ')');
    assert.equal(tableContract.cols, 3);
    assert.equal(tableContract.widths.length, 3);
    assert.ok(tableContract.widths.every(width => Number.isFinite(width) && width > 0));
    assert.equal(tableContract.cells, 9);
    assert.equal(tableContract.paragraphs, 9);
    assert.equal(tableContract.headers, 3);
    assert.equal(tableContract.embeddedSheets, 0);
    result = await paste({ 'text/plain': '> | 名称 | 含义 |\n> | --- | --- |\n> | value | 示例 |' });
    assert.ok(result.events[0].html.includes('class="ace-table"'), 'Quoted tables must use the same default document-table type');

    // Optional real sample supplied by a local debug runner. Keep its contents
    // in memory and only print counts, never document text or clipboard HTML.
    if (clipboardSample) {
      const expected = await paste({ 'text/plain': clipboardSample.text });
      const actual = await paste({ 'text/plain': clipboardSample.text, 'text/html': clipboardSample.html });
      assert.ok(JSON.stringify(actual.blocks) === JSON.stringify(expected.blocks), 'The real source HTML clipboard must import the same blocks as its Markdown text');
      assert.ok(actual.events.length === 1 && actual.events[0].html !== clipboardSample.html, 'The real Markdown source clipboard must pass through conversion exactly once');
      console.log('Real Markdown clipboard sample: ' + JSON.stringify({
        textCharacters: clipboardSample.text.length, htmlCharacters: clipboardSample.html.length,
        blocks: actual.blocks.length, codeBlocks: actual.blocks.filter(block => block.type === 'code').length
      }));
    }

    const rich = { "text/plain": markdown, "text/html": "<p>已有富文本</p>" };
    result = await paste(rich);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].html, rich["text/html"], "Existing rich clipboard data must keep its native paste path");
    result = await paste({ ...rich, "text/markdown": "```js\nexplicit()\n```" });
    assert.deepEqual(result.blocks, [{ type: "code", text: "explicit()", language: "JavaScript" }]);
    assert.equal(result.events.length, 1, "Explicit Markdown must not recursively reconvert");

    for (const target of ["paste-plain", "paste-textarea"]) {
      result = await paste({ "text/plain": markdown }, target);
      assert.equal(result.events[0].html, "", "Plain-text editors must keep literal Markdown");
      assert.equal(result.events.length, 1);
    }
    await client.evaluate("document.getElementById('paste-target').innerHTML = '<pre><code id=\"paste-code\"></code></pre>'");
    result = await paste({ "text/plain": markdown }, "paste-code");
    assert.equal(result.events[0].html, "", "Pasting inside an existing code block must keep literal text");
    await client.evaluate("document.getElementById('paste-target').replaceChildren()");
    result = await paste({ "text/plain": markdown }, "paste-target", true);
    assert.equal(result.events[0].html, "", "Attachments must remain on the native paste path");
    result = await paste({ "text/plain": "普通文本" });
    assert.equal(result.events[0].html, "");

    await configure({ convertMarkdownPaste: false });
    result = await paste({ "text/plain": markdown });
    assert.equal(result.events[0].html, "", "The paste setting must disable conversion");
    await configure({ convertMarkdownPaste: true, domains: ["unrelated.invalid"] });
    result = await paste({ "text/plain": markdown });
    assert.equal(result.events[0].html, "", "Conversion must respect the domain setting");
    await configure({ domains: ["127.0.0.1"] });

    // Ordinary contenteditables without an importer still use browser insertion.
    await client.evaluate(`(() => { __pasteFixture.consume = false;
      const editor = document.getElementById('paste-editor');
      editor.replaceChildren(); editor.focus();
      const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false);
      getSelection().removeAllRanges(); getSelection().addRange(range); })()`);
    result = await paste({ "text/plain": "```\nfallback\n```" }, "paste-editor");
    assert.equal(result.prevented, true);
    assert.equal(await client.evaluate("document.querySelector('#paste-editor pre code')?.textContent"), "fallback");
    assert.equal(await client.evaluate("__pasteInsertions", contextId), 1);

    // A rejected browser command exercises the Range fallback and input event.
    await client.evaluate(`(() => { document.getElementById('paste-editor').replaceChildren();
      const editor = document.getElementById('paste-editor'); editor.focus();
      const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false);
      getSelection().removeAllRanges(); getSelection().addRange(range);
      window.__pasteInputs = 0; editor.addEventListener('input', () => window.__pasteInputs++); })()`);
    await client.evaluate("document.execCommand = () => false", contextId);
    result = await paste({ "text/plain": "```\nrange fallback\n```" }, "paste-editor");
    assert.equal(result.prevented, true);
    assert.equal(await client.evaluate("document.querySelector('#paste-editor pre code')?.textContent"), "range fallback");
    assert.equal(await client.evaluate("__pasteInputs"), 1);
    assert.equal(await client.evaluate("getSelection().isCollapsed"), true);
    console.log("Markdown paste: native clipboard HTML contract, isolated-world delivery, code content/language, undo, no duplicates, settings and fallbacks passed");
  } finally {
    await configure({ convertMarkdownPaste: false, replaceCtrlC: false });
    await client.evaluate("document.execCommand = window.__pasteExecCommand", contextId);
    await client.evaluate("document.removeEventListener('paste', __pasteFixture.listener, true); document.getElementById('paste-fixture').remove(); document.getElementById('feishu-md-toast')?.remove()");
  }
};
