"use strict";
// Local, authenticated-page fixtures; no Feishu account or external requests.
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const root = path.resolve(__dirname, "..");
const browserPath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "feishu-export-browser-"));

class CDP {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.next = 0;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", ({ data }) => {
      const result = JSON.parse(data);
      if (!result.id) return;
      const waiting = this.pending.get(result.id);
      if (!waiting) return;
      this.pending.delete(result.id);
      if (result.error) waiting.reject(new Error(result.error.message)); else waiting.resolve(result.result);
    });
  }
  async send(method, params = {}) {
    await this.ready;
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression, contextId) {
    const result = await this.send("Runtime.evaluate", { expression, contextId, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  close() { this.socket.close(); }
}

async function waitFor(predicate, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await predicate(); if (value) return value; await delay(30); }
  throw new Error("Browser fixture timed out");
}

async function testHtmlConversion(client, contextId) {
  await client.evaluate(fs.readFileSync(path.join(root, "converter.js"), "utf8"), contextId);
  // Opt-in local regression: keep the actual document in memory; print only counts.
  if (process.argv.includes("--clipboard-sample")) {
    const sample = JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-STA", "-Command",
      "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); Add-Type -AssemblyName System.Windows.Forms; $sample = [Windows.Forms.Clipboard]::GetDataObject(); @{html=[string]$sample.GetData([Windows.Forms.DataFormats]::Html);text=[string]$sample.GetData([Windows.Forms.DataFormats]::UnicodeText)} | ConvertTo-Json -Compress"
    ], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
    assert.ok(sample.html, "Copy rich document content before running --clipboard-sample");
    const fragment = sample.html.match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/)?.[1] || sample.html;
    const metrics = await client.evaluate("((html, plain) => {" +
      "const doc = new DOMParser().parseFromString(html, 'text/html');" +
      "const markdown = FeishuMarkdownConverter.fromHtml(html);" +
      "const compact = value => value.normalize('NFKC').replace(/[^\\p{L}\\p{N}]/gu, '');" +
      "const output = compact(markdown);" +
      "const codes = Array.from(doc.querySelectorAll('pre'));" +
      "const cells = Array.from(doc.querySelectorAll('td,th'));" +
      "const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT); const chunks = [];" +
      "for (let node; (node = walker.nextNode());) { if (node.parentElement.closest('script,style,noscript,template,head')) continue; const value = compact(node.nodeValue); if (value.length >= 8) chunks.push(value); }" +
      "return {htmlCharacters:html.length,plainCharacters:plain.length,markdownCharacters:markdown.length," +
      "tables:doc.querySelectorAll('table').length,codeBlocks:codes.length,tableCells:cells.length," +
      "missingCodeBlocks:codes.filter(node=>!output.includes(compact(node.textContent))).length," +
      "missingTableCells:cells.filter(node=>!output.includes(compact(node.textContent))).length," +
      "checkedTextChunks:chunks.length,missingTextChunks:chunks.filter(value=>!output.includes(value)).length};" +
      "})(" + JSON.stringify(fragment) + "," + JSON.stringify(sample.text) + ")", contextId);
    console.log("Local clipboard conversion: " + JSON.stringify(metrics));
    assert.equal(metrics.missingCodeBlocks, 0, "Code blocks were dropped from the copied HTML");
    assert.equal(metrics.missingTableCells, 0, "Table cell content was dropped from the copied HTML");
    assert.equal(metrics.missingTextChunks, 0, "Visible text was dropped from the copied HTML");
  }
  const cases = [
    {
      name: "Feishu blocks directly inside a nested list",
      html: '<ol><li><div>章节</div><ol><li><div>详情</div><ol><pre><code>const answer = 42;\nreturn answer;</code></pre><div>输入说明<table><tr><td>参数</td><td>含义</td></tr><tr><td>limit</td><td>最大数量</td></tr></table></div><div>正文末尾<img src="https://example.invalid/image.png" alt="示意图"></div><div><span>白板占位说明</span></div></ol></li></ol></li></ol>',
      contains: ["章节", "详情", "```\n", "const answer = 42;\n", "return answer;", "输入说明", "| 参数 | 含义 |", "| limit | 最大数量 |", "正文末尾", "![示意图](https://example.invalid/image.png)", "白板占位说明"]
    },
    {
      name: "Paragraphs and code inside a list item",
      html: '<ul><li><p>第一段</p><p>第二段</p><pre><code>a &lt; b</code></pre><p>最后一段</p></li></ul>',
      contains: ["第一段", "第二段", "```\n", "a < b", "最后一段"]
    },
    {
      name: "Inline text, task items and ordinary nested lists",
      html: '<ol start="7"><li>普通 <strong>加粗</strong> 内容<ul><li><input type="checkbox" checked>已完成</li><li>子项</li></ul></li><li>后续条目</li></ol>',
      contains: ["7. 普通 **加粗** 内容", "- [x] 已完成", "- 子项", "8. 后续条目"]
    }
  ];
  for (const testCase of cases) {
    const markdown = await client.evaluate("FeishuMarkdownConverter.fromHtml(" + JSON.stringify(testCase.html) + ")", contextId);
    let previous = -1;
    for (const value of testCase.contains) {
      const index = markdown.indexOf(value, previous + 1);
      assert.ok(index > previous, testCase.name + ": missing or reordered " + value);
      previous = index;
    }
  }
  console.log("HTML conversion: nested lists preserve paragraphs, code, tables, images and placeholders");
}

let sourceClient;
let sourceContext;
let base;
let mode = "large";
let apiCalls = 0;
let active = 0;
let maxActive = 0;
let capturedFile = "";
const text = (value) => ({ initialAttributedTexts: { text: { 0: value }, attribs: {} }, apool: { numToAttrib: {} } });
const block = (type, parent, value, children = []) => ({ children, data: { type, parent_id: parent, text: text(value) } });
const total = 10000;
const ids = Array.from({ length: total }, (_, index) => "b" + index);
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, base || "http://localhost");
  try {
    if (url.pathname === "/__execute") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const result = await sourceClient.evaluate(data.code, sourceContext);
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify([{ result }]));
      return;
    }
    if (url.pathname === "/__download") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      capturedFile = Buffer.concat(chunks).toString("utf8");
      response.end("ok");
      return;
    }
    if (url.pathname === "/docx/document") {
      response.setHeader("set-cookie", "fixture_session=valid; SameSite=Strict; Path=/");
      response.setHeader("content-type", "text/html;charset=utf-8");
      response.end("<!doctype html><title>长文档测试</title><script>window.exportLongTasks=[];new PerformanceObserver(list=>exportLongTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true})</script><p>源文档</p>");
      return;
    }
    if (url.pathname === "/space/api/docx/pages/client_vars") {
      if (!request.headers.cookie?.includes("fixture_session=valid")) { response.writeHead(403); response.end(); return; }
      apiCalls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(mode === "slow" ? 250 : 1);
      const offset = Number(url.searchParams.get("cursor") || 0);
      const map = offset === 0 ? { root: block("page", "", "浏览器长文档", ids) } : {};
      for (let index = offset; index < Math.min(total, offset + 200); index += 1) map["b" + index] = block("text", "root", "第" + index + "段" + "长文档测试".repeat(20));
      const more = offset + 200 < total;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ code: 0, data: { block_map: map, document_revision_id: "1", has_more: more,
        cursor: more ? (mode === "stuck" ? "0" : String(offset + 200)) : "" } }));
      active -= 1;
      return;
    }
    if (url.pathname === "/browser-shim.js") {
      response.setHeader("content-type", "application/javascript");
      response.end(`window.chrome={tabs:{get:async()=>({id:1,url:${JSON.stringify(base + "/docx/document")},title:'长文档测试'}),update:async()=>{}},
        storage:{sync:{get:async()=>({domains:['127.0.0.1']})}},permissions:{contains:async()=>true},
        scripting:{executeScript:async options=>{const code='('+options.func.toString()+')(...'+JSON.stringify(options.args)+')';
          return (await fetch('/__execute',{method:'POST',body:JSON.stringify({code})})).json()}}};
        HTMLAnchorElement.prototype.click=function(){if(this.href.startsWith('blob:'))fetch(this.href).then(r=>r.text()).then(body=>fetch('/__download',{method:'POST',body}));};
        window.__streamText='';window.__streamClosed=false;window.showSaveFilePicker=async()=>({createWritable:async()=>({
          write:async bytes=>{window.__streamText+=new TextDecoder().decode(bytes);},close:async()=>{window.__streamClosed=true;},abort:async()=>{window.__streamText='';}
        })});`);
      return;
    }
    const filename = url.pathname.slice(1);
    if (!/^[a-z-]+\.(html|js|css)$/.test(filename)) { response.writeHead(404); response.end(); return; }
    let content = fs.readFileSync(path.join(root, filename));
    if (filename === "export.html") content = content.toString().replace('<script src="export-network.js">', '<script src="browser-shim.js"></script><script src="export-network.js">');
    response.setHeader("content-type", filename.endsWith(".js") ? "application/javascript" : filename.endsWith(".css") ? "text/css" : "text/html");
    response.end(content);
  } catch (error) { response.writeHead(500); response.end(error.message); }
});

async function main() {
  if (!fs.existsSync(browserPath)) throw new Error("Set CHROME_PATH to a Chromium browser executable");
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = "http://127.0.0.1:" + server.address().port;
  const browser = spawn(browserPath, ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + profile,
    "--enable-unsafe-extension-debugging", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "about:blank"], { windowsHide: true, stdio: "ignore" });
  const browserExited = new Promise(resolve => browser.once("exit", resolve));
  let task;
  let extensionTask;
  let extensionOptions;
  let extensionPopup;
  let browserClient;
  try {
    const port = await waitFor(() => {
      const file = path.join(profile, "DevToolsActivePort");
      try {
        const value = fs.readFileSync(file, "utf8").split("\n")[0];
        return /^\d+$/.test(value) && value;
      } catch (error) {
        // Chrome can briefly lock this file while publishing its debug port on Windows.
        if (error.code === "ENOENT" || error.code === "EBUSY") return false;
        throw error;
      }
    });
    const debugging = "http://127.0.0.1:" + port;
    const browserInfo = await (await fetch(debugging + "/json/version")).json();
    browserClient = new CDP(browserInfo.webSocketDebuggerUrl);
    const create = async (url) => {
      const target = await (await fetch(debugging + "/json/new?" + encodeURIComponent(url), { method: "PUT" })).json();
      const client = new CDP(target.webSocketDebuggerUrl);
      await client.send("Page.enable");
      await waitFor(() => client.evaluate("document.readyState === 'complete' && location.href === " + JSON.stringify(url)).catch(() => false));
      return client;
    };
    sourceClient = await create(base + "/docx/document");
    const { frameTree } = await sourceClient.send("Page.getFrameTree");
    sourceContext = (await sourceClient.send("Page.createIsolatedWorld", { frameId: frameTree.frame.id, worldName: "fixture-extension" })).executionContextId;
    await testHtmlConversion(sourceClient, sourceContext);
    await require("./paste-browser-fixture.js")(sourceClient, sourceContext);
    task = await create(base + "/export.html?tab=1&url=" + encodeURIComponent(base + "/docx/document"));
    try {
      await waitFor(async () => {
        const result = await task.evaluate("({status:document.getElementById('status').textContent,detail:document.getElementById('detail').textContent})");
        if (result.status === "导出未完成") throw new Error("Browser fixture export failed: " + result.detail);
        return result.status.startsWith("已导出");
      });
    } catch (error) {
      const state = await task.evaluate("({status:document.getElementById('status').textContent,detail:document.getElementById('detail').textContent,stats:document.getElementById('stats').textContent})");
      throw new Error(error.message + "; fixture state: " + JSON.stringify({ ...state, apiCalls, active, maxActive }));
    }
    await waitFor(() => capturedFile.length > 1000000);
    assert.equal((capturedFile.match(/第\d+段/g) || []).length, total);
    assert.equal(apiCalls, 51);
    assert.ok(maxActive <= 2);
    const metrics = await sourceClient.evaluate("({longTasks:exportLongTasks.length,maxTask:Math.max(0,...exportLongTasks)})");
    console.log("Browser UI + authenticated requests + worker: " + JSON.stringify({ characters: capturedFile.length, apiCalls, maxActive, ...metrics }));

    await task.evaluate("document.getElementById('stream').click()");
    await waitFor(async () => await task.evaluate("window.__streamClosed"));
    assert.equal(await task.evaluate("(window.__streamText.match(/第\\d+段/g)||[]).length"), total);
    console.log("Browser streaming output passed");

    mode = "slow";
    await task.evaluate("document.getElementById('retry').click()");
    await waitFor(async () => await task.evaluate("!document.getElementById('cancel').disabled"));
    await delay(50);
    await task.evaluate("document.getElementById('cancel').click()");
    await waitFor(async () => await task.evaluate("document.getElementById('status').textContent === '已取消'"));
    await delay(350);
    assert.equal(await sourceClient.evaluate("globalThis.__feishuMarkdownExportRequests?.size || 0", sourceContext), 0);
    console.log("Browser cancellation aborts source requests");

    mode = "stuck";
    await task.evaluate("document.getElementById('retry').click()");
    await waitFor(async () => await task.evaluate("document.getElementById('status').textContent === '导出未完成'"));
    assert.match(await task.evaluate("document.getElementById('detail').textContent"), /没有取得新内容|游标重复/);
    assert.equal(await task.evaluate("document.getElementById('download').hidden"), true);
    console.log("Browser repeated-page failure is visible and does not download");

    const network = fs.readFileSync(path.join(root, "export-network.js"), "utf8");
    await sourceClient.evaluate(network, sourceContext);
    const rejected = await sourceClient.evaluate("fetchDocumentPage(location.href,'https://unrelated.invalid/data','test',1)", sourceContext);
    assert.equal(rejected.retryable, false);
    assert.match(rejected.error, /不合法/);
    console.log("Browser same-origin path restriction passed");

    // Exercise the real MV3 APIs/CSP using the original toolbar popup.
    const protocol = await (await fetch(debugging + "/json/protocol")).json();
    if (protocol.domains.some(domain => domain.domain === "Extensions" && domain.commands.some(command => command.name === "loadUnpacked"))) {
      const extensionDirectory = path.join(profile, "fixture-extension");
      fs.mkdirSync(extensionDirectory);
      for (const name of ["background.js", "content.js", "converter.js", "options.html", "options.css", "options.js", "export.html", "export.css", "export.js", "export-network.js", "export-reader.js", "export-model.js", "export-worker.js", "icon.svg", "icon16.png", "icon32.png", "icon48.png", "icon128.png", "_locales"]) {
        fs.cpSync(path.join(root, name), path.join(extensionDirectory, name), { recursive: true });
      }
      const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
      assert.equal(manifest.action.default_popup, "options.html");
      manifest.host_permissions.push("http://127.0.0.1/*");
      fs.writeFileSync(path.join(extensionDirectory, "manifest.json"), JSON.stringify(manifest));
      const { id } = await browserClient.send("Extensions.loadUnpacked", { path: extensionDirectory });
      const downloads = path.join(profile, "fixture-downloads");
      fs.mkdirSync(downloads);
      await browserClient.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
      extensionOptions = await create("chrome-extension://" + id + "/options.html");
      await extensionOptions.evaluate("chrome.storage.sync.set({domains:['127.0.0.1']})");
      const sourceTab = await extensionOptions.evaluate("chrome.tabs.query({}).then(tabs=>tabs.find(tab=>tab.url===" + JSON.stringify(base + "/docx/document") + "))");
      let lastPopupId = null;
      const openPopup = async () => {
        if (lastPopupId) await waitFor(async () => !(await (await fetch(debugging + "/json/list")).json()).some(target => target.id === lastPopupId));
        await extensionOptions.evaluate("chrome.tabs.update(" + sourceTab.id + ",{active:true})");
        await sourceClient.send("Page.bringToFront");
        const existing = new Set((await (await fetch(debugging + "/json/list")).json()).map(target => target.id));
        await extensionOptions.evaluate("chrome.action.openPopup({windowId:" + sourceTab.windowId + "})");
        const target = await waitFor(async () => (await (await fetch(debugging + "/json/list")).json())
          .find(target => target.url === "chrome-extension://" + id + "/options.html" && !existing.has(target.id)));
        const client = new CDP(target.webSocketDebuggerUrl);
        lastPopupId = target.id;
        await waitFor(() => client.evaluate("document.readyState==='complete' && document.getElementById('domains')?.value==='127.0.0.1'").catch(() => false));
        await waitFor(() => client.evaluate("document.getElementById('domain-status').textContent==='已生效'"));
        return client;
      };
      extensionPopup = await openPopup();
      assert.equal(await extensionPopup.evaluate("typeof FeishuMarkdownConverter.toHtml"), "function");
      assert.deepEqual(await extensionPopup.evaluate("Array.from(document.scripts,script=>script.getAttribute('src'))"), ["converter.js", "options.js"]);
      await extensionPopup.evaluate("document.getElementById('replace-copy').click();document.getElementById('markdown-paste').click()");
      await waitFor(() => extensionOptions.evaluate("chrome.storage.sync.get(['replaceCtrlC','convertMarkdownPaste']).then(s=>s.replaceCtrlC===false&&s.convertMarkdownPaste===false)"));
      // Test the rich clipboard conversion without changing the OS clipboard.
      await extensionPopup.evaluate(String.raw`Object.defineProperty(navigator, 'clipboard', {value: {
        readText: async () => '# 弹窗转换\n\n\x60\x60\x60js\nconst value = "<tag>";\n\x60\x60\x60\n\n| 名称 | 状态 |\n| --- | --- |\n| 文档 | 完成 |',
        write: async items => { window.__clipboardHtml = await (await items[0].getType('text/html')).text(); }
      }}); document.getElementById('convert-clipboard').click()`);
      await waitFor(() => extensionPopup.evaluate("document.getElementById('clipboard-message').textContent.startsWith('已转换')"));
      assert.deepEqual(await extensionPopup.evaluate(`(() => {
        const doc = new DOMParser().parseFromString(window.__clipboardHtml, 'text/html');
        return { root: Boolean(doc.querySelector('[data-lark-html-role="root"]')), heading: doc.querySelector('h1')?.textContent,
          code: doc.querySelector('pre > code > div')?.textContent, language: doc.querySelector('code')?.getAttribute('data-lark-language'),
          documentTables: doc.querySelectorAll('table.ace-table').length,
          cells: Array.from(doc.querySelectorAll('table td'), cell => cell.textContent) };
      })()`), { root: true, heading: '弹窗转换', code: 'const value = "<tag>";', language: 'JavaScript',
        documentTables: 1, cells: ['名称', '状态', '文档', '完成'] });
      await extensionPopup.evaluate("window.close()");
      extensionPopup.close();
      extensionPopup = await openPopup();
      assert.equal(await extensionPopup.evaluate("document.getElementById('replace-copy').checked"), false);
      assert.equal(await extensionPopup.evaluate("document.getElementById('markdown-paste').checked"), false);
      console.log("Native toolbar popup: switches persist and rich clipboard conversion passed");

      mode = "large";
      await extensionPopup.evaluate("document.getElementById('export-document').click()");
      const exportTarget = await waitFor(async () => (await (await fetch(debugging + "/json/list")).json())
        .find(target => target.url.startsWith("chrome-extension://" + id + "/export.html?")));
      extensionTask = new CDP(exportTarget.webSocketDebuggerUrl);
      await waitFor(() => extensionTask.evaluate("document.readyState==='complete' && Boolean(document.getElementById('status'))").catch(() => false));
      await waitFor(async () => {
        const state = await extensionTask.evaluate("({status:document.getElementById('status').textContent,detail:document.getElementById('detail').textContent})");
        if (state.status === "导出未完成") throw new Error("Extension export failed: " + state.detail);
        return state.status.startsWith("已导出");
      });
      const downloaded = path.join(downloads, "浏览器长文档.md");
      await waitFor(() => fs.existsSync(downloaded));
      assert.equal((fs.readFileSync(downloaded,"utf8").match(/第\d+段/g)||[]).length, total);
      assert.equal(new URL(exportTarget.url).searchParams.get("tab"), String(sourceTab.id));
      assert.equal((await extensionTask.evaluate("chrome.tabs.getCurrent()")).openerTabId, sourceTab.id);
      console.log("Real MV3 extension: toolbar popup, Worker CSP, source document and full-document download passed");
    } else console.log("Real extension phase skipped: installed browser lacks Extensions.loadUnpacked; browser fixture coverage passed");
  } finally {
    if (browserClient) await Promise.race([browserClient.send("Browser.close").catch(() => {}), delay(2000)]);
    if (extensionPopup) extensionPopup.close();
    if (extensionTask) extensionTask.close();
    if (extensionOptions) extensionOptions.close();
    if (browserClient) browserClient.close();
    if (task) task.close();
    if (sourceClient) sourceClient.close();
    await Promise.race([browserExited, delay(2000)]);
    if (browser.exitCode === null && browser.signalCode === null) {
      browser.kill();
      await Promise.race([browserExited, delay(3000)]);
    }
    await new Promise(resolve => server.close(resolve));
    await delay(300);
    const resolved = path.resolve(profile);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith("feishu-export-browser-")) {
      fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
