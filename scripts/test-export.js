"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { Worker } = require("node:worker_threads");
require("../export-model.js");
require("../export-reader.js");
const { DocumentModel, textOf } = globalThis.FeishuExportModel;
const { DocumentReader, documentInfo } = globalThis.FeishuDocumentReader;
const origin = "https://sample.feishu.cn";
const source = origin + "/docx/document";
const text = (value, attribs = "", pool = {}) => ({ initialAttributedTexts: { text: { "0": value }, attribs: { "0": attribs } }, apool: { numToAttrib: pool } });
const block = (type, parent, content = "", children = [], extra = {}) => ({ children, data: { type, parent_id: parent, text: text(content), ...extra } });
const page = (map, extra = {}) => ({ block_map: map, has_more: false, document_revision_id: "10", ...extra });
const response = (data, status = 200) => ({ status, text: JSON.stringify({ code: 0, data }) });
const basic = () => page({ root: block("page", "", "示例", ["heading", "body"]), heading: block("heading1", "root", "章节"), body: block("text", "root", "正文") });
const render = (model) => [...model.render(source)].join("");
const fast = { sleep: async () => {} };

test("recognizes document and wiki links, rejects unrelated pages", () => {
  assert.equal(documentInfo(source).token, "document");
  assert.equal(documentInfo(origin + "/wiki/node").kind, "wiki");
  assert.throws(() => documentInfo(origin + "/sheets/test"), /新版文档/);
});

test("decodes formatting, false marks, Unicode, code fences, safe links and mentions", () => {
  const data = { text: text("粗体纯文", "*0+2*1+2", { 0: ["bold", "true"], 1: ["bold", "false"] }) };
  assert.equal(textOf(data, origin), "**粗体**纯文");
  assert.equal(textOf({ text: text("😀后文", "+4") }, origin), "😀后文");
  assert.equal(textOf({ text: text("a`b", "*0+3", { 0: ["inline-code", "true"] }) }, origin), "``a`b``");
  assert.equal(textOf({ text: text("链接", "*0+2", { 0: ["link", "javascript:bad"] }) }, origin), "链接");
  const mention = { 0: ["inline-component", JSON.stringify({ data: { title: "被提及文档", raw_url: origin + "/docx/link" } })], 1: ["link-id", "opaque-id"] };
  assert.equal(textOf({ text: text(" ", "*0*1+1", mention) }, origin), "[被提及文档](" + origin + "/docx/link)");
  assert.throws(() => textOf({ text: text("短", "+z") }, origin), /长度/);
  assert.equal(textOf({ text: text("1. 原样") }, origin), "1\\. 原样");
  assert.equal(textOf({ text: text("链接", "*0+2", { 0: ["link", "internal-id"] }) }, origin), "链接");
  assert.throws(() => textOf({ text: { unexpected_content: "正文" } }, origin), /无法识别/);
});

test("keeps prose Markdown characters literal and renders nested lists and code", () => {
  const model = new DocumentModel(origin);
  model.ingest(page({ root: block("page", "", "文档", ["one", "code", "prose"]),
    one: block("bullet", "root", "一级", ["two"]), two: block("todo", "one", "二级", [], { done: true }),
    code: block("code", "root", "```\nconst x = '<value>';", [], { language: "js" }),
    prose: block("text", "root", "# 原样\n**文字**") }));
  const markdown = render(model);
  assert.match(markdown, /- 一级\n {4}- \[x\] 二级/);
  assert.match(markdown, /````js\n```\nconst x/);
  assert.match(markdown, /\\# 原样\n\\\*\\\*文字/);
});

test("merges partial roots without losing earlier children and preserves declared order", () => {
  const model = new DocumentModel(origin);
  model.ingest(page({ root: block("page", "", "文档", ["a"]), a: block("text", "root", "甲") }));
  model.ingest(page({ root: block("page", "", "文档", ["b"]), b: block("text", "root", "乙") }));
  assert.deepEqual(model.blocks.get("root").children, ["a", "b"]);
  assert.ok(render(model).indexOf("甲") < render(model).indexOf("乙"));
});

test("fails closed on missing, orphaned, cyclic, or multiply referenced blocks", () => {
  const missing = new DocumentModel(origin);
  missing.ingest(page({ root: block("page", "", "", ["missing"]) }));
  assert.throws(() => missing.validate(), /缺失/);
  const orphan = new DocumentModel(origin);
  orphan.ingest(page({ root: block("page", "", "", ["a"]), a: block("text", "root", "a"), stray: block("text", "root", "lost") }));
  assert.throws(() => orphan.validate(), /未连接/);
  const cycle = new DocumentModel(origin);
  cycle.ingest(page({ root: block("page", "", "", ["a"]), a: block("text", "root", "a", ["root"]) }));
  assert.throws(() => cycle.validate(), /循环/);
  const duplicate = new DocumentModel(origin);
  duplicate.ingest(page({ root: block("page", "", "", ["a", "b"]), a: block("text", "root", "", ["child"]), b: block("text", "root", "", ["child"]), child: block("text", "a", "x") }));
  assert.throws(() => duplicate.validate(), /重复引用/);
});

function tableFixture(merged = false) {
  const map = { root: block("page", "", "表格", ["table"]), table: block("table", "root", "", [], {
    rows_id: ["r1", "r2"], columns_id: ["c1", "c2"], cell_set: {}
  }) };
  for (let index = 0; index < 4; index += 1) {
    const cellId = "cell" + index;
    const row = index < 2 ? "r1" : "r2";
    const column = index % 2 ? "c2" : "c1";
    map.table.data.cell_set[row + column] = { block_id: cellId, merge_info: { row_span: 1, col_span: merged && index === 0 ? 2 : 1 } };
    map[cellId] = block("table_cell", "table", "", ["value" + index]);
    map["value" + index] = block("text", cellId, ["名称", merged ? "" : "状态", "A|B", "完成"][index]);
  }
  return page(map);
}

test("renders table cells referenced only by cell_set, escaped pipes and merged cells", () => {
  const model = new DocumentModel(origin);
  model.ingest(tableFixture());
  assert.match(render(model), /\| 名称 \| 状态 \|\n\| --- \| --- \|\n\| A\\\|B \| 完成 \|/);
  const merged = new DocumentModel(origin);
  merged.ingest(tableFixture(true));
  assert.match(render(merged), /colspan="2"/);
  assert.equal(merged.warnings.size, 1);
});

test("unknown components are visible placeholders, images remain external links", () => {
  const model = new DocumentModel(origin);
  model.ingest(page({ root: block("page", "", "文档", ["widget", "image"]), widget: block("whiteboard", "root"), image: block("image", "root", "", [], { image: { token: "image-token" } }) }));
  assert.match(render(model), /whiteboard 内容/);
  assert.match(render(model), /mount_node_token=image/);
  assert.equal(model.warnings.size, 2);
});

test("reader follows cursors and checks the first page again", async () => {
  const first = page({ root: block("page", "", "文档", ["a", "b"]), a: block("text", "root", "甲") }, { has_more: true, cursor: "next" });
  const next = page({ b: block("text", "root", "乙") });
  const paths = [];
  const reader = new DocumentReader(source, async (url) => { paths.push(url); return response(url.includes("cursor=next") ? next : first); }, () => {}, fast);
  const model = await reader.read();
  assert.equal(model.blocks.size, 3);
  assert.equal(paths.length, 3);
  assert.ok(paths[1].includes("cursor=next"));
});

test("reader supplements skipped table subtrees including paginated child data", async () => {
  const full = tableFixture();
  const first = page({ root: full.block_map.root, table: full.block_map.table }, { skip_blocks: ["table"] });
  const remainder = Object.fromEntries(Object.entries(full.block_map).filter(([id]) => !["root", "table"].includes(id)));
  const paths = [];
  const reader = new DocumentReader(source, async (url) => {
    paths.push(url);
    return response(url.includes("mode=4") ? page(remainder) : first);
  }, () => {}, fast);
  assert.match(render(await reader.read()), /\| A\\\|B \| 完成 \|/);
  assert.equal(paths.filter((url) => url.includes("block_id=table")).length, 1);
  assert.equal(paths.length, 3, "all table cells should be supplied by a single subtree request");
});

test("independent skipped subtrees are bounded to two concurrent requests", async () => {
  const tables = Array.from({ length: 8 }, (_, index) => "table" + index);
  const rootMap = { root: block("page", "", "多表格", tables) };
  for (const id of tables) rootMap[id] = block("table", "root", "", [id + "cell"]);
  let active = 0;
  let maximum = 0;
  let requests = 0;
  const reader = new DocumentReader(source, async (url) => {
    requests += 1;
    const query = new URL(url, origin).searchParams;
    const id = query.get("block_id");
    if (!id) return response(page(rootMap, { skip_blocks: tables }));
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 3));
    active -= 1;
    return response(page({ [id + "cell"]: block("table_cell", id, "", [id + "body"]), [id + "body"]: block("text", id + "cell", id + "正文") }));
  }, () => {}, fast);
  const markdown = render(await reader.read());
  assert.equal(maximum, 2);
  assert.equal(requests, 10);
  for (const id of tables) assert.ok(markdown.includes(id + "正文"));
});

test("missing cells without skip_blocks are recovered through their parent table", async () => {
  const full = tableFixture();
  let requests = 0;
  const reader = new DocumentReader(source, async (url) => {
    requests += 1;
    return response(url.includes("mode=4") ? full : page({ root: full.block_map.root, table: full.block_map.table }));
  }, () => {}, fast);
  assert.match(render(await reader.read()), /完成/);
  assert.equal(requests, 3);
});

test("an irrecoverable missing block never produces a successful result", async () => {
  const first = page({ root: block("page", "", "", ["missing"]) });
  const reader = new DocumentReader(source, async (url) => response(url.includes("mode=4") ? page({}) : first), () => {}, fast);
  await assert.rejects(reader.read(), /仍有内容块缺失/);
});

test("reader rejects truncated pages, repeated cursors, empty maps and schema changes", async () => {
  const noCursor = basic(); noCursor.has_more = true;
  await assert.rejects(new DocumentReader(source, async () => response(noCursor), () => {}, fast).read(), /下一页/);
  let calls = 0;
  await assert.rejects(new DocumentReader(source, async () => {
    calls += 1;
    return response(calls === 1 ? page({ root: block("page", "", "", ["a", "b"]), a: block("text", "root", "a") }, { has_more: true, cursor: "same" })
      : page({ b: block("text", "root", "b") }, { has_more: true, cursor: "same" }));
  }, () => {}, fast).read(), /游标重复/);
  await assert.rejects(new DocumentReader(source, async () => response({}), () => {}, fast).read(), /未返回文档块/);
  await assert.rejects(new DocumentReader(source, async () => response(page({})), () => {}, fast).read(), /根节点/);
});

test("a cursor that only repeats the first page is never reported as complete", async () => {
  const first = basic(); first.has_more = true; first.cursor = "stuck";
  await assert.rejects(new DocumentReader(source, async () => response(first), () => {}, fast).read(), /没有取得新内容/);
});

test("reader detects changed revision and changed first-page text", async () => {
  let count = 0;
  await assert.rejects(new DocumentReader(source, async () => {
    const data = basic(); data.document_revision_id = String(++count);
    return response(data);
  }, () => {}, fast).read(), /发生变化/);
  count = 0;
  await assert.rejects(new DocumentReader(source, async () => {
    const data = basic(); if (++count > 1) data.block_map.body.data.text = text("修改后的正文");
    return response(data);
  }, () => {}, fast).read(), /正文发生变化/);
});

test("reader retries transient failures but does not retry permission or login errors", async () => {
  let attempts = 0;
  const reader = new DocumentReader(source, async () => ++attempts < 3 ? { status: 503, text: "unavailable" } : response(basic()), () => {}, fast);
  await reader.read();
  assert.equal(attempts, 4);
  attempts = 0;
  await assert.rejects(new DocumentReader(source, async () => { attempts += 1; return { status: 403, text: "" }; }, () => {}, fast).read(), /权限/);
  assert.equal(attempts, 1);
  await assert.rejects(new DocumentReader(source, async () => ({ status: 200, text: "<html>login</html>" }), () => {}, fast).read(), /登录页/);
});

test("request budget and explicit cancellation stop reads", async () => {
  const reader = new DocumentReader(source, async () => response(basic()), () => {}, { ...fast, maxRequests: 1 });
  await assert.rejects(reader.read(), /保护上限/);
  const cancelled = new DocumentReader(source, async () => response(basic()), () => {}, fast);
  cancelled.stopped = true;
  await assert.rejects(cancelled.read(), /取消/);
});

test("resolves wiki token, handles personal tenants and rejects non-docx wiki content", async () => {
  const calls = [];
  const reader = new DocumentReader(origin + "/wiki/node", async (url) => {
    calls.push(url);
    if (url.includes("get_info")) return { status: 403, text: "" };
    if (url.includes("get_node")) return response({ node: { obj_token: "document", obj_type: 22, space_id: "space" } });
    return response(basic());
  }, () => {}, fast);
  await reader.read();
  assert.ok(calls.some((url) => url.includes("container_id=node") && url.includes("wiki_space_id=space")));
  const sheet = new DocumentReader(origin + "/wiki/node", async (url) => response(url.includes("get_info") ? {} : { node: { obj_token: "sheet", obj_type: 3 } }), () => {}, fast);
  await assert.rejects(sheet.read(), /不是新版文档/);
});

test("version-less responses carry an explicit consistency warning", async () => {
  const data = basic(); delete data.document_revision_id;
  const model = await new DocumentReader(source, async () => response(data), () => {}, fast).read();
  assert.ok([...model.warnings].some((warning) => warning.includes("协同编辑")));
});

// Run the actual browser worker code in a worker_threads compatibility harness.
function spawnExportWorker() {
  const base = path.resolve(__dirname, "..");
  const bootstrap = `const {parentPort} = require('node:worker_threads'); const fs = require('node:fs'); const vm = require('node:vm');
    globalThis.postMessage = (message, transfer) => parentPort.postMessage(message, transfer);
    globalThis.importScripts = (...names) => { for (const name of names) vm.runInThisContext(fs.readFileSync(${JSON.stringify(base)} + '/' + name, 'utf8'), { filename: name }); };
    parentPort.on('message', message => globalThis.onmessage({data: message}));
    vm.runInThisContext(fs.readFileSync(${JSON.stringify(path.join(base, "export-worker.js"))}, 'utf8'), {filename:'export-worker.js'});`;
  return new Worker(bootstrap, { eval: true });
}

test("actual worker exports a million-character paginated document with bounded requests", { timeout: 20000 }, async () => {
  const worker = spawnExportWorker();
  const total = 10000;
  const batch = 200;
  const ids = Array.from({ length: total }, (_, i) => "b" + i);
  const root = block("page", "", "大文档", ids);
  let requests = 0;
  const start = performance.now();
  try {
    const result = await new Promise((resolve, reject) => {
      worker.on("error", reject);
      worker.on("message", (message) => {
        if (message.type === "request") {
          requests += 1;
          const query = new URL(message.path, origin).searchParams;
          const offset = Number(query.get("cursor") || 0);
          const map = offset === 0 ? { root } : {};
          for (let index = offset; index < Math.min(offset + batch, total); index += 1) map["b" + index] = block("text", "root", "第" + index + "段" + "大文档内容".repeat(20));
          const more = offset + batch < total;
          worker.postMessage({ type: "response", id: message.id, result: response(page(map, { has_more: more, cursor: more ? String(offset + batch) : "" })) });
        } else if (message.type === "done") resolve(message);
        else if (message.type === "error") reject(new Error(message.message));
      });
      worker.postMessage({ type: "start", url: source, streaming: false });
    });
    const markdown = await result.blob.text();
    assert.equal(result.blocks, total + 1);
    assert.equal(requests, total / batch + 1);
    assert.equal((markdown.match(/第\d+段/g) || []).length, total);
    assert.ok(markdown.indexOf("第0段") < markdown.indexOf("第9999段"));
    assert.ok(result.bytes > 1000000);
    console.log("Million-character export: " + Math.round(performance.now() - start) + "ms, " + requests + " requests, " + result.bytes + " bytes");
  } finally { await worker.terminate(); }
});

test("actual worker streams chunks with acknowledgments and preserves surrogate pairs", { timeout: 10000 }, async () => {
  const worker = spawnExportWorker();
  const data = page({ root: block("page", "", "流式", ["body"]), body: block("text", "root", "a".repeat(32767) + "😀".repeat(40000)) });
  const buffers = [];
  try {
    await new Promise((resolve, reject) => {
      worker.on("error", reject);
      worker.on("message", (message) => {
        if (message.type === "request") worker.postMessage({ type: "response", id: message.id, result: response(data) });
        if (message.type === "write") {
          buffers.push(Buffer.from(message.buffer));
          setTimeout(() => worker.postMessage({ type: "response", id: message.id, result: true }), 1);
        }
        if (message.type === "error") reject(new Error(message.message));
        if (message.type === "done") { assert.equal(message.blob, null); resolve(message); }
      });
      worker.postMessage({ type: "start", url: source, streaming: true });
    });
    assert.ok(buffers.length > 2);
    assert.ok(buffers.every((buffer) => buffer.length <= 131072));
    const output = Buffer.concat(buffers).toString("utf8");
    assert.equal((output.match(/😀/g) || []).length, 40000);
    assert.ok(!output.includes("�"));
  } finally { await worker.terminate(); }
});
