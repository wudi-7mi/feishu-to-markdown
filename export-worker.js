"use strict";
importScripts("export-model.js", "export-reader.js");

const pending = new Map();
let sequence = 0;
let running = false;
const encoder = new TextEncoder();

function rpc(type, payload, transfer = []) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    postMessage({ type, id, ...payload }, transfer);
  });
}

async function run(message) {
  const reader = new FeishuDocumentReader.DocumentReader(message.url,
    (path) => rpc("request", { path }),
    (progress) => postMessage({ type: "progress", ...progress }));
  const model = await reader.read();
  if (model.title === "飞书文档" && message.title) model.title = String(message.title);
  postMessage({ type: "progress", stage: "converting", blocks: model.blocks.size, requests: reader.requests });
  const parts = [];
  let bytes = 0;
  let pieces = [];
  let pieceLength = 0;
  const flush = async () => {
    if (!pieces.length) return;
    const buffer = encoder.encode(pieces.join(""));
    pieces = [];
    pieceLength = 0;
    bytes += buffer.byteLength;
    if (!message.streaming && bytes > 64 * 1024 * 1024) throw new Error("结果超过 64 MB，请使用“直接写入文件”重新导出");
    if (message.streaming) await rpc("write", { buffer }, [buffer.buffer]);
    else parts.push(buffer);
  };
  for (const part of model.render(message.url)) {
    // Slice an unusually large text block as well as ordinary small blocks.
    for (let offset = 0; offset < part.length;) {
      let end = Math.min(offset + 32768, part.length);
      if (end < part.length && /[\uD800-\uDBFF]/.test(part[end - 1])) end -= 1;
      const piece = part.slice(offset, end);
      pieces.push(piece);
      pieceLength += piece.length;
      offset = end;
      if (pieceLength >= 32768) await flush();
    }
  }
  await flush();
  const warnings = [...model.warnings];
  const title = model.title;
  const blocks = model.blocks.size;
  model.blocks.clear();
  postMessage({ type: "done", title, blocks, bytes, requests: reader.requests, warnings,
    blob: message.streaming ? null : new Blob(parts, { type: "text/markdown;charset=utf-8" }) });
}

globalThis.onmessage = (event) => {
  const message = event.data;
  if (message.type === "response") {
    const waiting = pending.get(message.id);
    if (!waiting) return;
    pending.delete(message.id);
    if (message.error) {
      const error = new Error(message.error);
      error.retryable = message.retryable;
      waiting.reject(error);
    } else waiting.resolve(message.result);
    return;
  }
  if (message.type === "start" && !running) {
    running = true;
    run(message).catch((error) => postMessage({ type: "error", message: error.message }));
  }
};
