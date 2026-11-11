(function (global) {
  "use strict";
  const LIMIT = 200;
  const MAX_REQUESTS = 12000;
  const MAX_INPUT_BYTES = 256 * 1024 * 1024;
  const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  function documentInfo(value) {
    const url = new URL(value);
    const match = url.pathname.match(/^\/(docx|wiki)\/([a-zA-Z0-9_-]+)\/?$/);
    if (!/^https?:$/.test(url.protocol) || !match) throw new Error("请先打开一篇飞书新版文档或知识库文档");
    return { origin: url.origin, path: url.pathname, kind: match[1], token: match[2], url: url.origin + url.pathname };
  }

  function cursorList(data) {
    const collect = (value) => typeof value === "string" ? (value ? [value] : [])
      : Array.isArray(value) ? value.flatMap(collect)
        : value && typeof value === "object" ? Object.values(value).flatMap(collect) : [];
    return [...new Set([...collect(data.cursor), ...collect(data.next_cursors)])];
  }

  function revisionOf(data) {
    const value = data.document_revision_id ?? data.doc_revision_id ?? data.revision_id ?? data.revision;
    return (typeof value === "string" || typeof value === "number") && String(value) !== "-1" ? String(value) : "";
  }

  function fingerprint(data) {
    const rows = Object.entries(data.block_map || {}).sort(([a], [b]) => a.localeCompare(b)).map(([id, raw]) => {
      const body = raw.data || raw;
      return [id, body.type || raw.type, raw.children || body.children, body.text, body.done, body.language,
        body.table || body.cell_set, body.rows_id, body.columns_id];
    });
    return JSON.stringify(rows);
  }

  class DocumentReader {
    constructor(url, request, progress = () => {}, options = {}) {
      this.info = documentInfo(url);
      this.request = request;
      this.progress = progress;
      this.model = new global.FeishuExportModel.DocumentModel(this.info.origin);
      this.requests = 0;
      this.bytes = 0;
      this.queue = [];
      this.queueIndex = 0;
      this.queued = new Set();
      this.stopped = false;
      this.sleep = options.sleep || pause;
      this.maxRequests = options.maxRequests || MAX_REQUESTS;
      this.startedAt = Date.now();
    }

    check() {
      if (this.stopped) throw new Error("导出已取消");
      if (Date.now() - this.startedAt > 20 * 60 * 1000) throw new Error("导出超过 20 分钟，请按章节拆分后重试");
    }

    async get(path) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        this.check();
        if (++this.requests > this.maxRequests) throw new Error("请求数量超过保护上限，已停止导出，未生成不完整文件");
        let response;
        try { response = await this.request(path); }
        catch (error) {
          if (attempt === 2 || error.retryable === false) throw error;
          await this.sleep(500 * 2 ** attempt);
          continue;
        }
        this.check();
        if (response.status === 429 || response.status >= 500) {
          if (attempt < 2) { await this.sleep(Math.min(10000, Math.max(500 * 2 ** attempt, Number(response.retryAfter || 0) * 1000))); continue; }
          throw new Error("飞书暂时繁忙，请稍后重试（HTTP " + response.status + "）");
        }
        if (response.status === 401 || response.status === 403) throw new Error("当前登录状态或文档权限不足，请返回文档检查后重试");
        if (response.status < 200 || response.status >= 300) throw new Error("网页数据请求失败（HTTP " + response.status + "）");
        this.bytes += new TextEncoder().encode(response.text).byteLength;
        if (this.bytes > MAX_INPUT_BYTES) throw new Error("读取数据超过 256 MB 安全预算，请按章节拆分导出");
        let json;
        try { json = JSON.parse(response.text); }
        catch (_) { throw new Error("飞书返回了登录页或无法识别的数据，请刷新文档后重试"); }
        if (!json || Number(json.code) !== 0 || !json.data || typeof json.data !== "object") {
          const error = new Error("网页接口返回错误（" + String(json?.code ?? "未知") + "），请检查登录和文档权限");
          error.apiCode = json?.code;
          throw error;
        }
        return json.data;
      }
    }

    endpoint(parameters) {
      const query = new URLSearchParams({ id: this.info.token, limit: String(LIMIT), ...parameters });
      if (this.info.kind === "wiki") {
        query.set("container_type", "wiki2.0");
        query.set("container_id", this.info.wikiToken);
        if (this.info.spaceId) query.set("wiki_space_id", this.info.spaceId);
      }
      return "/space/api/docx/pages/client_vars?" + query;
    }

    async resolve() {
      if (this.info.kind !== "wiki") return;
      const wikiToken = this.info.token;
      let spaceId = "";
      try {
        const info = await this.get("/space/api/wiki/v2/tree/get_info/?wiki_token=" + encodeURIComponent(wikiToken));
        spaceId = String(info.space_id || info.nodes?.[wikiToken]?.space_id || "");
      } catch (error) {
        if (error.retryable === false) throw error;
        // Some personal tenants only expose the node lookup; it must still succeed below.
      }
      const query = new URLSearchParams({ wiki_token: wikiToken });
      if (spaceId) query.set("space_id", spaceId);
      const data = await this.get("/space/api/wiki/v2/tree/get_node/?" + query);
      const node = data.node || data;
      if (!/^[a-zA-Z0-9_-]+$/.test(String(node.obj_token || ""))) throw new Error("未能解析知识库文档，请打开文档本体后重试");
      if (node.obj_type != null && ![22, "22", "docx"].includes(node.obj_type)) throw new Error("该知识库节点不是新版文档，暂不支持全文导出");
      this.info = { ...this.info, wikiToken, token: node.obj_token, spaceId: String(node.space_id || spaceId), title: String(node.title || "") };
    }

    observe(data, root = false) {
      if (root) {
        const revision = revisionOf(data);
        if (revision && this.revision && revision !== this.revision) throw new Error("导出期间文档版本发生变化，请停止编辑后重试");
        if (revision) this.revision = revision;
      }
      this.model.ingest(data);
      for (const id of Array.isArray(data.skip_blocks) ? data.skip_blocks : []) this.enqueue(String(id));
      this.progress({ stage: "reading", blocks: this.model.blocks.size, requests: this.requests, bytes: this.bytes });
    }

    enqueue(id) {
      if (id && id !== this.model.rootId && !this.queued.has(id)) {
        this.queued.add(id);
        this.queue.push(id);
      }
    }

    makesProgress(data) {
      return Object.entries(data.block_map || {}).some(([id, raw]) => {
        const previous = this.model.blocks.get(id);
        if (!previous) return true;
        const children = raw.children ?? raw.data?.children;
        const ids = Array.isArray(children) ? children : Object.values(children || {}).flat();
        return ids.some((child) => !previous.children.includes(String(child)));
      });
    }

    async continuePage(cursor, blockId, preferred) {
      const root = this.model.rootId || this.info.token;
      const variants = blockId
        ? [{ mode: "4", block_id: blockId }]
        : [{ mode: "1" }, { mode: "4", paging_root_id: root }, { mode: "4", block_id: root }];
      if (preferred) variants.sort((a, b) => Number(JSON.stringify(b) === preferred) - Number(JSON.stringify(a) === preferred));
      for (const variant of variants) {
        let data;
        try { data = await this.get(this.endpoint({ ...variant, cursor })); }
        catch (error) {
          if ([2, 4000091, 4009904].includes(Number(error.apiCode))) continue;
          throw error;
        }
        if (!data.block_map || typeof data.block_map !== "object") throw new Error("分页数据格式已变化，请等待适配后重试");
        if (this.makesProgress(data) || (!data.has_more && cursorList(data).length === 0)) {
          return { data, preferred: JSON.stringify(variant) };
        }
      }
      throw new Error("分页没有取得新内容，已停止导出以避免重复或遗漏");
    }

    async drain(first, blockId = "") {
      const root = !blockId;
      const pending = [];
      const seen = new Set();
      let preferred = "";
      const follow = (data) => {
        if (!data.has_more) return;
        const cursors = cursorList(data);
        if (!cursors.length) throw new Error("正文尚未读取完，但接口未提供下一页，已停止导出");
        for (const cursor of cursors) {
          if (seen.has(cursor)) throw new Error("分页游标重复，已停止导出以避免遗漏");
          seen.add(cursor);
          pending.push(cursor);
        }
      };
      this.observe(first, root);
      follow(first);
      for (let index = 0; index < pending.length; index += 1) {
        this.check();
        const next = await this.continuePage(pending[index], blockId, preferred);
        preferred = next.preferred;
        this.observe(next.data, root);
        follow(next.data);
      }
    }

    async read() {
      this.progress({ stage: "resolving", blocks: 0, requests: 0, bytes: 0 });
      await this.resolve();
      const first = await this.get(this.endpoint({ mode: "1" }));
      const initialFingerprint = fingerprint(first);
      await this.drain(first);
      const process = async () => {
        try {
          while (this.queueIndex < this.queue.length) {
            this.check();
            const id = this.queue[this.queueIndex++];
            const page = await this.get(this.endpoint({ mode: "4", block_id: id }));
            await this.drain(page, id);
          }
        } catch (error) { this.failure ||= error; this.stopped = true; throw error; }
      };
      const drainQueue = async () => {
        await Promise.allSettled([process(), process()]);
        if (this.failure) throw this.failure;
      };
      // Complete declared skipped subtrees before requesting individual missing
      // blocks: one table request often supplies thousands of missing cells.
      await drainQueue();
      while (this.model.missing().length) {
        const missing = new Set(this.model.missing());
        const before = this.queue.length;
        for (const block of this.model.blocks.values()) {
          if (block.type !== "page" && global.FeishuExportModel.references(block).some((id) => missing.has(id))) this.enqueue(block.id);
        }
        if (this.queue.length === before) for (const id of missing) this.enqueue(id);
        if (this.queue.length === before) throw new Error("补拉后仍有内容块缺失，已停止导出");
        await drainQueue();
      }
      this.progress({ stage: "checking", blocks: this.model.blocks.size, requests: this.requests, bytes: this.bytes });
      this.model.validate();
      const verification = await this.get(this.endpoint({ mode: "1" }));
      const finalRevision = revisionOf(verification);
      if ((this.revision && finalRevision !== this.revision) || fingerprint(verification) !== initialFingerprint) {
        throw new Error("导出期间正文发生变化，请停止编辑后重试");
      }
      if (!this.revision) this.model.warnings.add("无法核对全文版本；导出期间的协同编辑可能影响内容，请核对结果。");
      if (this.info.title && this.model.title === "飞书文档") this.model.title = this.info.title;
      return this.model;
    }
  }

  global.FeishuDocumentReader = { DocumentReader, documentInfo, cursorList, revisionOf };
})(globalThis);
