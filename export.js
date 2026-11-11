(function () {
  "use strict";
  const elements = Object.fromEntries(["document-title", "source-url", "status", "detail", "stats", "source", "cancel", "retry", "stream", "stream-hint", "download", "warnings"]
    .map((id) => [id, document.getElementById(id)]));
  const params = new URLSearchParams(location.search);
  const sourceTabId = Number(params.get("tab"));
  const sourceUrl = params.get("url");
  let worker = null;
  let writer = null;
  let jobId = "";
  let generation = 0;
  let objectUrl = "";
  let startedAt = 0;
  let sourceTitle = "飞书文档";

  function filename(title) {
    let name = String(title).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/^[. ]+|[. ]+$/g, "").slice(0, 100) || "飞书文档";
    if (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(name)) name = "文档_" + name;
    return name + ".md";
  }

  function status(label, detail, error = false) {
    elements.status.textContent = label;
    elements.status.classList.toggle("error", error);
    elements.detail.textContent = detail;
  }

  function controls(active) {
    elements.cancel.disabled = !active;
    elements.retry.hidden = active;
    elements.stream.hidden = active || typeof window.showSaveFilePicker !== "function";
    elements["stream-hint"].hidden = elements.stream.hidden;
  }

  async function sourceTab() {
    if (!Number.isInteger(sourceTabId) || sourceTabId <= 0 || !sourceUrl) throw new Error("缺少源文档，请从飞书页面重新打开导出");
    const expected = new URL(sourceUrl);
    if (!/^https?:$/.test(expected.protocol) || !/^\/(docx|wiki)\/[a-zA-Z0-9_-]+\/?$/.test(expected.pathname)) {
      throw new Error("当前页面不是支持的飞书新版文档");
    }
    const tab = await chrome.tabs.get(sourceTabId);
    if (!tab.url || new URL(tab.url).origin !== expected.origin || new URL(tab.url).pathname !== expected.pathname) {
      throw new Error("原文档已关闭或跳转，请从文档页面重新打开导出");
    }
    const defaults = ["feishu.cn", "feishuapp.cn", "larksuite.com"];
    const { domains } = await chrome.storage.sync.get({ domains: defaults });
    const configured = domains.some((domain) => {
      const suffix = String(domain).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^\*\./, "").replace(/\.$/, "");
      return suffix && (expected.hostname === suffix || expected.hostname.endsWith("." + suffix));
    });
    if (!configured || !await chrome.permissions.contains({ origins: [expected.origin + "/*"] })) {
      throw new Error("此域名尚未启用或授权，请在扩展设置中添加并授权后重试");
    }
    return tab;
  }

  function abortRequests(id) {
    if (id) chrome.scripting.executeScript({ target: { tabId: sourceTabId }, func: abortDocumentRequests, args: [id] }).catch(() => {});
  }

  async function cleanup() {
    generation += 1;
    if (worker) worker.terminate();
    worker = null;
    abortRequests(jobId);
    jobId = "";
    const oldWriter = writer;
    writer = null;
    if (oldWriter) { try { await oldWriter.abort(); } catch (_) { /* It may already be closed. */ } }
  }

  async function fail(message) {
    await cleanup();
    controls(false);
    status("导出未完成", message, true);
  }

  async function start(handle = null) {
    controls(true);
    const current = generation + 1;
    await cleanup();
    if (current !== generation) return;
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = ""; }
    elements.download.hidden = true;
    elements.warnings.replaceChildren();
    elements.warnings.hidden = true;
    status("准备中", "正在检查原文档和网站访问权限…");
    elements.stats.textContent = "";
    startedAt = performance.now();
    try {
      const tab = await sourceTab();
      if (current !== generation) return;
      sourceTitle = (tab.title || "飞书文档").replace(/\s*[-|]\s*(飞书云文档|飞书文档|Lark Docs|Feishu Docs)$/i, "");
      elements["document-title"].textContent = sourceTitle;
      elements["source-url"].textContent = sourceUrl;
      if (handle) {
        const openedWriter = await handle.createWritable();
        if (current !== generation) { await openedWriter.abort(); return; }
        writer = openedWriter;
      }
      jobId = crypto.randomUUID();
      const thisJob = jobId;
      const thisWorker = new Worker("export-worker.js");
      worker = thisWorker;
      const reply = (id, result, error, retryable) => {
        if (generation === current) thisWorker.postMessage({ type: "response", id, result, error, retryable });
      };
      thisWorker.onerror = (event) => { if (generation === current) fail(event.message || "导出线程异常，请重试"); };
      thisWorker.onmessage = async (event) => {
        if (current !== generation) return;
        const message = event.data;
        try {
          if (message.type === "request") {
            try {
              const [result] = await chrome.scripting.executeScript({
                target: { tabId: sourceTabId }, func: fetchDocumentPage,
                args: [sourceUrl, message.path, thisJob, message.id]
              });
              const payload = result?.result;
              if (!payload) throw new Error("原文档没有响应，请确认标签页仍然打开");
              reply(message.id, payload, payload.error, payload.retryable);
            } catch (error) { reply(message.id, null, "读取原文档失败：" + error.message, false); }
          } else if (message.type === "write") {
            if (!writer) throw new Error("文件写入已取消");
            await writer.write(message.buffer);
            reply(message.id, true);
          } else if (message.type === "progress") {
            const stages = {
              resolving: ["读取中", "正在获取文档信息…"],
              reading: ["读取中", "正在读取全文并补全表格，请保留原文档标签页…"],
              checking: ["校验中", "正在检查内容完整性和导出期间的变化…"],
              converting: ["转换中", "正在生成 Markdown 文件…"]
            };
            status(...(stages[message.stage] || stages.reading));
            elements.stats.textContent = "已读取 " + (message.blocks || 0).toLocaleString() + " 个内容块 · "
              + (message.requests || 0) + " 次请求 · " + ((performance.now() - startedAt) / 1000).toFixed(1) + " 秒";
          } else if (message.type === "done") {
            if (writer) { const completedWriter = writer; await completedWriter.close(); writer = null; }
            if (current !== generation) return;
            if (message.blob) {
              objectUrl = URL.createObjectURL(message.blob);
              elements.download.href = objectUrl;
              elements.download.download = filename(message.title);
              elements.download.hidden = false;
              elements.download.click();
            }
            for (const warning of message.warnings) {
              const item = document.createElement("li");
              item.textContent = warning;
              elements.warnings.appendChild(item);
            }
            elements.warnings.hidden = !message.warnings.length;
            status(message.warnings.length ? "已导出，请核对提示" : "已导出", message.blob ? "Markdown 文件已生成并开始下载。" : "Markdown 已写入所选文件。");
            elements.stats.textContent = message.blocks.toLocaleString() + " 个内容块 · " + (message.bytes / 1024).toFixed(1)
              + " KB · " + ((performance.now() - startedAt) / 1000).toFixed(1) + " 秒";
            thisWorker.terminate();
            worker = null;
            jobId = "";
            controls(false);
          } else if (message.type === "error") await fail(message.message);
        } catch (error) { if (current === generation) await fail(error.message); }
      };
      thisWorker.postMessage({ type: "start", url: sourceUrl, title: sourceTitle, streaming: Boolean(writer) });
    } catch (error) { if (current === generation) await fail(error.message); }
  }

  elements.cancel.addEventListener("click", async () => {
    await cleanup();
    controls(false);
    status("已取消", "导出已停止，可重新开始。");
  });
  elements.retry.addEventListener("click", () => start());
  elements.stream.addEventListener("click", async () => {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: filename(sourceTitle), types: [{ description: "Markdown", accept: { "text/markdown": [".md"] } }] });
      await start(handle);
    } catch (error) { if (error.name !== "AbortError") status("无法写入文件", error.message, true); }
  });
  elements.source.addEventListener("click", () => chrome.tabs.update(sourceTabId, { active: true }).catch(() => fail("原文档标签页已关闭")));
  window.addEventListener("pagehide", () => { if (worker) worker.terminate(); abortRequests(jobId); if (writer) writer.abort().catch(() => {}); });
  start();
})();
