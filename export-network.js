// This function is serialized by scripting.executeScript; keep it self-contained.
async function fetchDocumentPage(expectedUrl, path, jobId, requestId) {
  "use strict";
  const expected = new URL(expectedUrl);
  const currentMatches = () => location.origin === expected.origin && location.pathname === expected.pathname;
  if (!currentMatches()) return { error: "源文档已跳转，请重新打开导出任务", retryable: false };
  const target = new URL(path, location.origin);
  if (target.origin !== expected.origin || !/^\/space\/api\/(?:docx\/pages\/client_vars\/?|wiki\/v2\/tree\/(?:get_info|get_node)\/?)$/.test(target.pathname)) {
    return { error: "导出请求地址不合法", retryable: false };
  }
  const key = "__feishuMarkdownExportRequests";
  const requests = globalThis[key] ||= new Map();
  const id = jobId + ":" + requestId;
  const controller = new AbortController();
  requests.set(id, controller);
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(target.href, {
      credentials: "include", signal: controller.signal, redirect: "error",
      headers: { Accept: "application/json" }
    });
    const limit = 8 * 1024 * 1024;
    if (Number(response.headers.get("content-length") || 0) > limit) throw new Error("单页数据超过 8 MB，已停止导出以保护页面性能");
    if (!response.body) return { status: response.status, text: "" };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parts = [];
    let bytes = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new Error("单页数据超过 8 MB，已停止导出以保护页面性能"); }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    if (!currentMatches()) return { error: "源文档已跳转，请重新打开导出任务", retryable: false };
    return { status: response.status, retryAfter: response.headers.get("retry-after"), text: parts.join("") };
  } catch (error) {
    const aborted = error.name === "AbortError";
    return { error: aborted ? "读取超时或任务已取消" : error.message,
      retryable: aborted || error instanceof TypeError };
  } finally {
    clearTimeout(timer);
    requests.delete(id);
    if (!requests.size) delete globalThis[key];
  }
}

function abortDocumentRequests(jobId) {
  const key = "__feishuMarkdownExportRequests";
  const requests = globalThis[key];
  if (!(requests instanceof Map)) return;
  for (const [id, controller] of requests) {
    if (id.startsWith(jobId + ":")) controller.abort();
  }
}
