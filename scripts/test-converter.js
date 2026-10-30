"use strict";

const assert = require("node:assert/strict");
require("../converter.js");

const { toHtml } = globalThis.FeishuMarkdownConverter;

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
assert.equal(
  toHtml("```js\nconst value = \"<tag>\";\n```") ,
  "<pre><code class=\"language-js\">const value = &quot;&lt;tag&gt;&quot;;</code></pre>"
);
assert.equal(toHtml("[链接](https://example.com/?a=1&b=2)"), "<p><a href=\"https://example.com/?a=1&amp;b=2\">链接</a></p>");
assert.equal(toHtml("[危险](javascript:evil)"), "<p><a href=\"#\">危险</a></p>");
assert.equal(toHtml("第一行\n第二行"), "<p>第一行<br>第二行</p>");

console.log("Converter tests passed");
