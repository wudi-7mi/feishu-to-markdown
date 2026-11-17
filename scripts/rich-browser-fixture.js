"use strict";

const assert = require("node:assert/strict");

module.exports = async function testRichFormats(client, contextId) {
  const convert = html => client.evaluate('FeishuMarkdownConverter.fromHtml(' + JSON.stringify(html) + ')', contextId);
  const inspect = (markdown, check, forClipboard = true) => client.evaluate('(' + check.toString() + ')(new DOMParser().parseFromString(FeishuMarkdownConverter.' + (forClipboard ? 'toClipboardHtml' : 'toHtml') + '('
    + JSON.stringify(markdown) + '),"text/html"))', contextId);

  // Native export observed through the enterprise document's actual toolbar.
  const native = '<div data-lark-html-role="root"><div class="ace-line"><span style="background-color:rgba(255,246,122,0.8)"><u>下划线测试</u></span></div></div>';
  let markdown = await convert(native);
  assert.ok(markdown.includes('<span style="background-color:rgba(255,246,122,0.8)"><u>下划线测试</u></span>'));
  assert.deepEqual(await inspect(markdown, doc => ({text:doc.body.textContent,bg:doc.querySelector('span').style.backgroundColor,underline:!!doc.querySelector('u')})),
    {text:'下划线测试',bg:'rgba(255, 246, 122, 0.8)',underline:true});
  markdown = await convert('<p>文字 <span style="color:#d83931;background-color:#ffff00"><strong>重点</strong> **字面量**</span> 后文</p>');
  assert.deepEqual(await inspect(markdown, doc => ({text:doc.body.textContent,color:doc.querySelector('span').style.color,strong:doc.querySelector('strong').textContent,marks:doc.querySelectorAll('strong').length})),
    {text:'文字 重点 **字面量** 后文',color:'rgb(216, 57, 49)',strong:'重点',marks:1});

  markdown = await convert('<p style="text-align:center;margin-left:2em;text-indent:1em">居中缩进</p>');
  assert.deepEqual(await inspect(markdown, doc => {const el=doc.querySelector('.ace-line');return {align:el.style.textAlign,margin:el.style.marginLeft,indent:el.style.textIndent,text:el.textContent};}),
    {align:'center',margin:'2em',indent:'1em',text:'居中缩进'});
  for (const level of [7,8,9]) {
    const heading = await convert('<div class="heading-' + level + ' ace-line">深层标题</div>');
    assert.deepEqual(await inspect(heading, doc => ({level:doc.querySelector('[role=heading]').getAttribute('aria-level'),text:doc.body.textContent})), {level:String(level),text:'深层标题'});
  }
  markdown = await convert('<div data-type="callout"><div>💡 提示 <strong>重点</strong></div><p>第二段</p></div>');
  assert.deepEqual(await inspect(markdown, doc => ({type:doc.querySelector('[data-feishu-format]').getAttribute('data-feishu-format'),border:doc.querySelector('[data-feishu-format]').style.borderLeftWidth,text:doc.body.textContent})),
    {type:'callout',border:'4px',text:'💡 提示 重点第二段'});
  markdown = await convert('<div data-type="grid"><div data-type="grid_column" style="width:40%">左列</div><div data-type="grid_column" style="width:60%">右列</div></div>');
  assert.deepEqual(await inspect(markdown, doc => {const grid=doc.querySelector('[data-feishu-format=grid]');return {display:grid.style.display,columns:grid.style.gridTemplateColumns,widths:Array.from(grid.children,el=>el.style.width),text:grid.textContent};}),
    {display:'grid',columns:'40fr 60fr',widths:['',''],text:'左列右列'});
  for (const open of [true,false]) {
    markdown = await convert('<details' + (open?' open':'') + '><summary>折叠标题</summary><p>复制时已有的正文</p></details>');
    assert.deepEqual(await inspect(markdown, doc => ({open:doc.querySelector('details').open,title:doc.querySelector('summary').textContent,text:doc.querySelector('details').textContent})),
      {open,title:'折叠标题',text:'折叠标题复制时已有的正文'});
  }
  markdown = await convert('<div data-collapsed="true"><h3>折叠标题</h3><p>已有正文</p></div>');
  assert.deepEqual(await inspect(markdown, doc => ({open:doc.querySelector('details').open,text:doc.querySelector('details').textContent})), {open:false,text:'折叠标题已有正文'});

  const table = '<table data-ace-table-col-widths="140;260" style="border-collapse:collapse"><tbody><tr><td rowspan="2" style="background-color:#ffeeaa;text-align:center;border:2px solid #123456">合并行</td><td>第一格</td></tr><tr><td>第二格</td></tr><tr><td colspan="2"><ol start="7"><li>单元格列表</li></ol></td></tr></tbody></table>';
  markdown = await convert(table);
  assert.ok(markdown.startsWith('<table'));
  assert.deepEqual(await inspect(markdown, doc => {const table=doc.querySelector('table.ace-table'),cell=table.rows[0].cells[0];return {rows:table.rows.length,rowspan:cell.rowSpan,colspan:table.rows[2].cells[0].colSpan,bg:cell.style.backgroundColor,align:cell.style.textAlign,border:cell.style.borderWidth,widths:Array.from(table.querySelectorAll('col'),el=>el.getAttribute('width')),list:table.querySelector('li').textContent};}),
    {rows:3,rowspan:2,colspan:2,bg:'rgb(255, 238, 170)',align:'center',border:'2px',widths:['140','260'],list:'单元格列表'});
  const richAgain = await client.evaluate('FeishuMarkdownConverter.fromHtml(FeishuMarkdownConverter.toClipboardHtml(' + JSON.stringify(markdown) + '))', contextId);
  assert.deepEqual(await inspect(richAgain, doc => ({rowspan:doc.querySelector('td').rowSpan,text:doc.querySelector('li').textContent})),{rowspan:2,text:'单元格列表'});
  assert.equal(await inspect(markdown, doc => doc.querySelector('li[data-list="number"] > div:not([class])').textContent), '单元格列表');

  markdown = await convert('<table><tr><th>表达式</th><th>说明</th></tr><tr><td><code>left|right</code></td><td>正文</td></tr></table>');
  assert.equal(await inspect(markdown, doc => doc.querySelector('code').textContent), 'left|right');
  markdown = await convert('<table><tr><th>公式</th><th>说明</th></tr><tr><td><span data-latex="\\|x\\|">norm</span></td><td>正文</td></tr></table>');
  assert.equal(await inspect(markdown, doc => doc.querySelector('[data-latex]').getAttribute('data-latex')), '\\|x\\|');

  assert.equal(await convert('<pre><code data-lark-language="JavaScript">const value = 1;</code></pre>'), '```javascript\nconst value = 1;\n```');
  assert.equal(await convert('<pre><code data-language="cpp">a &lt; b\n```</code></pre>'), '````cpp\na < b\n```\n````');
  markdown = await convert('<span data-type="equation" data-latex="x^2 + y_1">公式预览</span>');
  assert.equal(markdown, '$x^2 + y_1$');
  assert.deepEqual(await inspect(markdown, doc => ({sup:doc.querySelectorAll('msup').length,sub:doc.querySelectorAll('msub').length,source:doc.querySelector('annotation').textContent}), false),
    {sup:1,sub:1,source:'x^2 + y_1'});
  assert.deepEqual(await inspect('$$\n\\frac{a}{b} + \\sqrt{x}\n$$', doc => ({display:doc.querySelector('math').getAttribute('display'),fraction:!!doc.querySelector('mfrac'),root:!!doc.querySelector('msqrt')}), false),
    {display:'block',fraction:true,root:true});
  markdown = await convert('<math><msup><mi>x</mi><mn>2</mn></msup></math>');
  assert.ok(markdown.includes('<math'));
  assert.equal(await inspect(markdown, doc => !!doc.querySelector('msup'), false),true);
  assert.equal(await inspect(markdown, doc => doc.body.textContent.startsWith('[数学公式：仅保留 MathML 源码]')),true);
  assert.equal(await inspect('$\\href{javascript:alert(1)}{x}$', doc => doc.querySelectorAll('[href],script,img').length),0);
  assert.equal(await inspect('$\\unsupported{value}$', doc => doc.querySelector('[data-latex]')?.getAttribute('data-latex')), '\\unsupported{value}');
  const nativeFormula = {blockId:'synthetic-equation',blockType:'EQUATION_BLOCK',initData:{},props:{data:{equation:'x^2+\\frac{a}{b}\n'},displayMode:'inline',viewType:'inline'}};
  assert.equal(await convert('<span class="j-block-container"><span data-meta-block-props="' + JSON.stringify(nativeFormula).replace(/"/g,'&quot;') + '"><span class="block-paste-placeholder">$$preview$$</span></span></span>'), '$x^2+\\frac{a}{b}$');
  assert.deepEqual(await inspect('before $x^2+\\frac{a}{b}$ after', doc => ({source:doc.querySelector('[data-latex]').getAttribute('data-latex'),text:doc.body.textContent,opaque:doc.querySelectorAll('[data-meta-block-props],[data-lark-record-data]').length})),
    {source:'x^2+\\frac{a}{b}',text:'before [数学公式：保留 LaTeX 源码] x^2+\\frac{a}{b} after',opaque:0});
  assert.equal(await client.evaluate('FeishuMarkdownConverter.fromHtml(FeishuMarkdownConverter.toClipboardHtml("$$x^2$$"))',contextId), '$$\nx^2\n$$');

  assert.equal(await convert('<span data-type="mention_user" data-href="https://example.invalid/person" data-name="成员"></span>'), '[成员](https://example.invalid/person)');
  assert.equal(await convert('<div data-type="file" data-url="https://example.invalid/report.pdf" data-file-name="报告.pdf"></div>'), '[报告.pdf](https://example.invalid/report.pdf)');
  assert.equal(await convert('<div data-type="file" data-file-name="报告.pdf"></div>'), '[附件：报告.pdf，剪贴板未提供可用链接]');
  markdown = await convert('<table width="400"><tr><td><span data-type="file" data-url="https://example.invalid/report.pdf" data-file-name="报告.pdf"></span><sub>下标</sub><sup>上标</sup></td></tr></table>');
  assert.deepEqual(await inspect(markdown,doc=>({width:doc.querySelector('table').getAttribute('width'),href:doc.querySelector('a').getAttribute('href'),text:doc.querySelector('a').textContent,sub:doc.querySelector('sub').textContent,sup:doc.querySelector('sup').textContent})),
    {width:'400',href:'https://example.invalid/report.pdf',text:'报告.pdf',sub:'下标',sup:'上标'});

  const hostile = '<div style="color:red;background:url(https://example.invalid/tracker);position:fixed" onclick="alert(1)"><a href="javascript:alert(1)">链接</a><script>alert(1)</script><iframe src="https://example.invalid/frame"></iframe><span style="color:var(--secret)">正文</span></div>';
  assert.deepEqual(await inspect(hostile, doc => ({active:doc.querySelectorAll('script,iframe,[onclick],[href]').length,color:doc.querySelector('div[style]').style.color,background:doc.querySelector('div[style]').style.backgroundImage,position:doc.querySelector('div[style]').style.position,text:doc.body.textContent})),
    {active:0,color:'red',background:'',position:'',text:'链接正文'});
  assert.deepEqual(await inspect('`<mark>literal</mark>` and `$x^2$`', doc => ({marks:doc.querySelectorAll('mark,math').length,codes:Array.from(doc.querySelectorAll('code'),el=>el.textContent)})),
    {marks:0,codes:['<mark>literal</mark>','$x^2$']});
  assert.deepEqual(await inspect('价格 $5+$10，公式 $x^2$，字面量 \\$x\\$', doc => ({formulas:doc.querySelectorAll('[data-latex]').length,text:doc.body.textContent})),
    {formulas:1,text:'价格 $5+$10，公式 [数学公式：保留 LaTeX 源码] x^2，字面量 $x$'});
  assert.equal(await inspect('before\n<div style="text-align:right">right</div> after\n\nend',doc=>doc.body.textContent), 'beforeright afterend');
  console.log('Rich formats: native background/underline, colors, heading levels, alignment, callouts, columns, folds, merged/styled tables, code language, local MathML, references and active-content filtering passed');
};
