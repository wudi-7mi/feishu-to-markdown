"use strict";

const assert = require("node:assert/strict");
require("../converter.js");

const { toHtml, toClipboardHtml } = globalThis.FeishuMarkdownConverter;

assert.equal(toClipboardHtml(""), "");
assert.equal(toClipboardHtml("# 标题"), '<div data-lark-html-role="root" data-docx-has-block-data="false"><h1>标题</h1></div>');

assert.equal(toHtml("# 标题"), "<h1>标题</h1>");
assert.equal(
  toHtml("**粗体**、*斜体*、~~删除~~、`code`") ,
  "<p><strong>粗体</strong>、<em>斜体</em>、<del>删除</del>、<code>code</code></p>"
);
assert.equal(
  toHtml("- [x] 完成\n- [ ] 待办"),
  "<ul><li><input type=\"checkbox\" disabled checked> 完成</li><li><input type=\"checkbox\" disabled> 待办</li></ul>"
);
assert.equal(
  toHtml("- 一级\n  - 二级\n  - 仍是二级\n- 回到一级"),
  "<ul><li>一级<ul><li>二级</li><li>仍是二级</li></ul></li><li>回到一级</li></ul>"
);
assert.equal(
  toHtml("| 名称 | 状态 |\n| --- | --- |\n| 文档 | 完成 |"),
  "<table><thead><tr><th>名称</th><th>状态</th></tr></thead><tbody><tr><td>文档</td><td>完成</td></tr></tbody></table>"
);
assert.equal(
  toHtml("| 表达式 | 代码 |\n| --- | --- |\n| A\\|B | `left|right` |"),
  "<table><thead><tr><th>表达式</th><th>代码</th></tr></thead><tbody><tr><td>A|B</td><td><code>left|right</code></td></tr></tbody></table>"
);
const clipboardTable = toClipboardHtml("| 名称 | 状态 |\n| --- | --- |\n| 文档 | 完成 |");
assert.ok(clipboardTable.includes('<table class="ace-table" data-ace-table-col-widths="200;200"'));
assert.ok(clipboardTable.includes('<div style="text-align:left" class="ace-line"><strong>名称</strong></div>'));
assert.ok(clipboardTable.includes('<div style="text-align:left" class="ace-line">完成</div>'));
assert.equal((clipboardTable.match(/<td\b/g) || []).length, 4);
assert.equal((clipboardTable.match(/<col\s/g) || []).length, 2);
assert.ok(toClipboardHtml("> | 名称 | 状态 |\n> | --- | --- |\n> | 文档 | 完成 |").includes('class="ace-table"'));
assert.equal(
  toHtml("```js\nconst value = \"<tag>\";\n```") ,
  "<pre style=\"white-space:pre;\"><code class=\"language-JavaScript\" data-language=\"js\" data-lark-language=\"JavaScript\" data-wrap=\"false\"><div>const value = &quot;&lt;tag&gt;&quot;;</div></code></pre>"
);
assert.equal(
  toHtml("```python title=example.py\n  print(\"<tag>&\")\n\n    # indented\n```"),
  "<pre style=\"white-space:pre;\"><code class=\"language-Python\" data-language=\"python\" data-lark-language=\"Python\" data-wrap=\"false\"><div>  print(&quot;&lt;tag&gt;&amp;&quot;)\n\n    # indented</div></code></pre>"
);
assert.equal(
  toHtml("````md\n```js\nconst value = 1;\n```\n````"),
  "<pre style=\"white-space:pre;\"><code class=\"language-Markdown\" data-language=\"md\" data-lark-language=\"Markdown\" data-wrap=\"false\"><div>```js\nconst value = 1;\n```</div></code></pre>"
);
assert.equal(toHtml("~~~\n**literal**\n~~~"), "<pre style=\"white-space:pre;\"><code class=\"language-Plain Text\" data-lark-language=\"Plain Text\" data-wrap=\"false\"><div>**literal**</div></code></pre>");
assert.equal(toHtml("```\nfirst\n~~~\nlast\n```"), "<pre style=\"white-space:pre;\"><code class=\"language-Plain Text\" data-lark-language=\"Plain Text\" data-wrap=\"false\"><div>first\n~~~\nlast</div></code></pre>");
assert.equal(toHtml("```\n  unclosed  "), "<pre style=\"white-space:pre;\"><code class=\"language-Plain Text\" data-lark-language=\"Plain Text\" data-wrap=\"false\"><div>  unclosed  </div></code></pre>");
assert.equal(toHtml("```\r\nline one\r\n\r\nline two\r\n```"), "<pre style=\"white-space:pre;\"><code class=\"language-Plain Text\" data-lark-language=\"Plain Text\" data-wrap=\"false\"><div>line one\n\nline two</div></code></pre>");
for (const [alias, language] of [["ts", "TypeScript"], ["sh", "Shell"], ["c++", "C++"], ["yml", "YAML"], ["unsupported", "Plain Text"], ["__proto__", "Plain Text"]]) {
  assert.ok(toHtml("```" + alias + "\ncode\n```").includes('data-lark-language="' + language + '"'), "Native language for " + alias);
}
assert.equal(toHtml("[链接](https://example.com/?a=1&b=2)"), "<p><a href=\"https://example.com/?a=1&amp;b=2\">链接</a></p>");
assert.equal(toHtml("[危险](javascript:evil)"), "<p><a href=\"#\">危险</a></p>");
assert.equal(toHtml("第一行\n第二行"), "<p>第一行<br>第二行</p>");

console.log("Converter tests passed");
