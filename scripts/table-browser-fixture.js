"use strict";

const assert = require("node:assert/strict");

module.exports = async function testTableLists(client, contextId) {
  // Same structure as the copied table: 4 rows, 3 columns, with a paragraph
  // followed by four numbered items in row 2 / column 2. No document data.
  const native = '<table class="ace-table"><tbody><tr><td><div><strong>名称</strong></div></td><td><div><strong>说明</strong></div></td><td><div><strong>状态</strong></div></td></tr>'
    + '<tr><td><div>项目</div></td><td><div>处理步骤<ol start="1" class="list-number1">'
    + ['准备', '检查', '执行', '完成'].map(text => '<li class="ace-line" data-list="number"><div>' + text + '</li>').join('')
    + '</ol></td><td><div>进行中<div><br></div></td></tr>'
    + '<tr><td><div>项目二</div></td><td><div>其他说明</td><td><div>待办</td></tr>'
    + '<tr><td><div>项目三</div></td><td><div>最后说明</div></td><td><div>完成</div></td></tr></tbody></table>';
  const convert = (html) => client.evaluate('FeishuMarkdownConverter.fromHtml(' + JSON.stringify(html) + ')', contextId);
  const inspect = (markdown) => client.evaluate('((markdown) => {' +
    'const html=FeishuMarkdownConverter.toClipboardHtml(markdown); const doc=new DOMParser().parseFromString(html,"text/html");' +
    'const table=doc.querySelector("table.ace-table"); return {html,rows:table.rows.length,cols:table.rows[0].cells.length,' +
    'header:Array.from(table.rows[0].cells,cell=>cell.textContent),text:table.rows[1].cells[1].textContent,' +
    'items:Array.from(table.rows[1].cells[1].querySelectorAll("ol > li"),li=>li.textContent),' +
    'nativeItems:table.rows[1].cells[1].querySelectorAll("ol.list-number1 > li.ace-line[data-list=number] > div").length};' +
    '})(' + JSON.stringify(markdown) + ')', contextId);
  const markdown = await convert(native);
  assert.ok(markdown.includes('处理步骤<br><br>1. 准备<br>2. 检查<br>3. 执行<br>4. 完成'), 'Preserve the paragraph, numbering and item boundaries');
  const roundtrip = await inspect(markdown);
  assert.equal(roundtrip.rows, 4);
  assert.equal(roundtrip.cols, 3);
  assert.deepEqual(roundtrip.header, ['名称', '说明', '状态']);
  assert.deepEqual(roundtrip.items, ['准备', '检查', '执行', '完成']);
  assert.equal(roundtrip.nativeItems, 4, 'Use the native content-bearing Feishu numbered-list structure');
  const again = await convert(roundtrip.html);
  // Once explicit table styles/widths exist, export HTML to retain them.
  assert.equal(await convert((await inspect(again)).html), again, 'Rich table export must stabilize without accumulating header formatting');
  assert.deepEqual((await inspect(again)).header, ['名称', '说明', '状态']);
  assert.deepEqual((await inspect(again)).items, roundtrip.items, 'Repeated conversions must not flatten or duplicate lists');

  const nested = '<table><tr><th>名称</th><th>内容</th></tr><tr><td>层级</td><td>'
    + '<div>开头 <strong>重点</strong> 说明</div><ol start="7"><li><div>父项 <code>&lt;br&gt;</code></div>'
    + '<ol class="list-bullet1"><li data-list="bullet"><div>子项 A</div></li>'
    + '<li data-list="bullet"><div><input type="checkbox" checked>任务 B</div></li></ol></li>'
    + '<li><div>后续 <a href="https://example.com">链接</a></div></li></ol><div>结尾段落</div></td></tr></table>';
  const nestedMarkdown = await convert(nested);
  assert.ok(nestedMarkdown.includes('开头 **重点** 说明'), 'Adjacent inline text must stay in the same paragraph');
  assert.ok(nestedMarkdown.includes('7. 父项 `<br>`'));
  assert.ok(nestedMarkdown.includes('<br>&nbsp;&nbsp;&nbsp;- 子项 A'), 'Keep nesting indentation in a single table row');
  const nestedResult = await client.evaluate('((markdown) => {' +
    'const html=FeishuMarkdownConverter.toClipboardHtml(markdown); const doc=new DOMParser().parseFromString(html,"text/html");' +
    'const cell=doc.querySelectorAll("tr")[1].cells[1]; const list=cell.querySelector("ol");' +
    'return {start:list.getAttribute("start"),parents:list.querySelectorAll(":scope > li").length,' +
    'children:list.querySelectorAll(":scope > li > ul > li").length,task:cell.querySelector("input")?.checked,' +
    'code:cell.querySelector("code")?.textContent,bold:cell.querySelector("strong")?.textContent,' +
    'paragraphs:Array.from(cell.querySelectorAll(":scope > div"),div=>div.textContent),href:cell.querySelector("a")?.getAttribute("href")};' +
    '})(' + JSON.stringify(nestedMarkdown) + ')', contextId);
  assert.deepEqual(nestedResult, {start:'7',parents:2,children:2,task:true,code:'<br>',bold:'重点',paragraphs:['开头 重点 说明','结尾段落'],href:'https://example.com'});

  const plain = await convert('<table><tr><th>文本</th><th>示例</th></tr><tr><td>字面量</td><td><div>第一段</div><div>第二段含 &lt;br&gt; 文本</div><div>第三段 A|B</div></td></tr></table>');
  assert.ok(plain.includes('第一段<br><br>第二段含 \\<br> 文本<br><br>第三段 A\\|B'));
  const plainResult = await inspect(plain);
  assert.equal(plainResult.text, '第一段第二段含 <br> 文本第三段 A|B');
  assert.deepEqual(plainResult.items, []);
  console.log('Table lists: copied 4x3 table, populated numbered items, nested bullets/tasks, paragraphs, inline code, literal breaks and round trips passed');
};
