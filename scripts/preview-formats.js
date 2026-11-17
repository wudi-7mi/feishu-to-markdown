"use strict";
// Local developer preview. Serves only bundled runtime files and synthetic
// sample text; it never reads a document, clipboard, or account information.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const assets = new Set(["vendor/katex.min.js", "rich-html.js", "converter.js"]);
const markdown = '# 格式补充验证 0.6.15\n\n'
  + '颜色背景与下划线：<span style="color:#d83931;background-color:rgba(255,246,122,0.8)"><u>彩色重点</u></span>\n\n'
  + '<p style="text-align:center;margin-left:2em">居中缩进段落</p>\n\n'
  + '<div data-feishu-format="callout" style="background-color:#e8f3ff;border-left:4px solid #245bdb;padding:8px">💡 提示块测试</div>\n\n'
  + '<div data-feishu-format="grid"><div>分栏左侧</div><div>分栏右侧</div></div>\n\n'
  + '<details open><summary>折叠标题测试</summary><p>折叠正文测试</p></details>\n\n'
  + '<div role="heading" aria-level="7">七级标题测试</div>\n\n'
  + '<table data-ace-table-col-widths="160;240"><tbody><tr><td rowspan="2" style="background-color:#ffeeaa;text-align:center">合并行测试</td><td>表格第一行<ol><li>单元格列表一</li><li>单元格列表二</li></ol></td></tr><tr><td>表格第二行</td></tr><tr><td colspan="2">合并列测试</td></tr></tbody></table>\n\n'
  + '```js\nconst richFormatCheck = true;\n```\n\n'
  + '行内公式前文 $x^2+y_1$ 公式后文\n\n$$\n\\frac{a}{b}+\\sqrt{x}\n$$\n\n公式后续正文完整保留\n\n'
  + '[附件示例链接](https://example.invalid/report.pdf)\n\n格式补充验证结束';
const html = '<!doctype html><meta charset="utf-8"><title>本机格式验证</title><body><h1>本机格式验证</h1>'
  + '<p>仅含合成样例；转换代码均来自当前项目。</p><div id="preview"></div>'
  + '<script src="/vendor/katex.min.js"></script><script src="/rich-html.js"></script><script src="/converter.js"></script>'
  + '<script>window.fixtureMarkdown=' + JSON.stringify(markdown) + ';window.fixtureHtml=FeishuMarkdownConverter.toClipboardHtml(fixtureMarkdown);document.getElementById("preview").innerHTML=FeishuMarkdownConverter.toHtml(fixtureMarkdown);</script></body>';
const server = http.createServer((request, response) => {
  const name = new URL(request.url, "http://localhost").pathname.slice(1);
  if (!name) { response.setHeader("content-type", "text/html;charset=utf-8"); response.end(html); return; }
  if (!assets.has(name)) { response.writeHead(404); response.end(); return; }
  response.setHeader("content-type", "application/javascript;charset=utf-8");
  response.end(fs.readFileSync(path.join(root, name)));
});
server.listen(0, "127.0.0.1", () => console.log('http://127.0.0.1:' + server.address().port + '/'));
process.stdin.resume();
process.stdin.on("data", () => { server.close(); process.stdin.pause(); });
