(function (global) {
  "use strict";

  const MAX_BLOCKS = 120000;
  const MAX_DEPTH = 100;
  const list = (value) => Array.isArray(value) ? value.map(String)
    : value && typeof value === "object" ? Object.values(value).flatMap(list) : [];
  const unique = (values) => [...new Set(values)];
  const html = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const escape = (value) => String(value).replace(/([\\`*_[\]<>~|])/g, "\\$1")
    .replace(/^(\s*)(#{1,6}|>|[-+]|(\d+)([.)]))(?=\s)/gm,
      (_, space, marker, digits, punctuation) => space + (digits ? digits + "\\" + punctuation : "\\" + marker));

  function safeUrl(value, origin) {
    try {
      if (typeof value !== "string" || !/^(?:https?:|mailto:|tel:|\/|#)/i.test(value.trim())) return "";
      const url = new URL(value.trim(), origin);
      return /^(https?:|mailto:|tel:)$/.test(url.protocol) ? url.href : "";
    } catch (_) { return ""; }
  }

  function tickFence(text, minimum = 0) {
    let longest = minimum;
    for (const match of text.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
    return "`".repeat(longest + 1);
  }

  function codeSpan(text) {
    const fence = tickFence(text);
    return fence + (/^\s|\s$|^`|`$/.test(text) ? " " + text + " " : text) + fence;
  }

  function markText(text, attributes, pool, origin, plain) {
    const marks = {};
    for (const id of attributes) {
      const pair = pool[String(id)];
      if (!Array.isArray(pair)) continue;
      const key = String(pair[0]).toLowerCase();
      const value = pair[1];
      const enabled = ![false, 0, "0", "false", ""].includes(value);
      if (/inline[-_]component/.test(key)) {
        try {
          const component = JSON.parse(value);
          const data = component.data || {};
          text = String(data.title || data.name || text);
          marks.link = safeUrl(data.raw_url || data.url || "", origin);
        } catch (_) { /* Keep the original text of an unrecognized component. */ }
      } else if (/equation/.test(key) && value) {
        text = String(value);
        marks.equation = true;
      } else if (!/(?:^|[-_])id$/.test(key) && /^(link|href|url)$/.test(key)) {
        let url = String(value || "");
        try { if (!/^[a-z]+:/i.test(url)) url = decodeURIComponent(url); } catch (_) { /* Preserve a literal URL. */ }
        marks.link = safeUrl(url, origin);
      } else if (enabled) {
        if (/bold/.test(key)) marks.bold = true;
        if (/italic/.test(key)) marks.italic = true;
        if (/strike/.test(key)) marks.strike = true;
        if (/^(code|inline[-_]?code|codeinline)$/.test(key)) marks.code = true;
      }
    }
    if (plain) return text;
    if (marks.equation) return "$" + text.replace(/\$/g, "\\$") + "$";
    let result = marks.code ? codeSpan(text) : escape(text);
    const leading = result.match(/^\s*/)[0];
    const trailing = result.match(/\s*$/)[0];
    if (result.trim()) {
      result = result.trim();
      if (marks.bold) result = "**" + result + "**";
      if (marks.italic) result = "*" + result + "*";
      if (marks.strike) result = "~~" + result + "~~";
      result = leading + result + trailing;
    }
    if (marks.link) result = "[" + result + "](" + marks.link.replace(/\(/g, "%28").replace(/\)/g, "%29") + ")";
    return result;
  }

  function textOf(data, origin, plain = false) {
    const source = data.text ?? data;
    if (typeof source === "string") return plain ? source : escape(source);
    const attributed = source.initialAttributedTexts;
    if (!attributed) {
      const content = source.content ?? source.text;
      if (typeof content === "string") return plain ? content : escape(content);
      if (Array.isArray(source.elements)) {
        return source.elements.map((element) => {
          const run = element.text_run;
          if (!run) return "";
          const styles = run.text_element_style || {};
          const pool = {};
          const ids = [];
          for (const [key, value] of Object.entries(styles)) {
            const id = ids.length;
            pool[id] = [key, key === "link" ? value.url : value];
            ids.push(id);
          }
          return markText(String(run.content || ""), ids, pool, origin, plain);
        }).join("");
      }
      if (data.text && typeof data.text === "object" && Object.keys(data.text).length) {
        throw new Error("文字块的数据格式无法识别，已停止导出以避免遗漏");
      }
      return "";
    }
    const texts = attributed.text;
    const attrs = attributed.attribs;
    const keys = typeof texts === "string" ? ["0"] : Object.keys(texts || {}).sort((a, b) => Number(a) - Number(b));
    const pool = source.apool?.numToAttrib || data.apool?.numToAttrib || {};
    return keys.map((key) => {
      const text = String(typeof texts === "string" ? texts : texts[key] || "");
      const operations = String(typeof attrs === "string" ? attrs : attrs?.[key] || "");
      if (!operations) return markText(text, [], pool, origin, plain);
      let position = 0;
      let attributes = [];
      const output = [];
      for (const match of operations.matchAll(/([*|+=-])([0-9a-z]+)/g)) {
        const count = Number.parseInt(match[2], 36);
        if (match[1] === "*") attributes.push(count);
        if (match[1] === "+" || match[1] === "=") {
          if (position + count > text.length) throw new Error("文字属性与正文长度不一致，已停止导出");
          output.push(markText(text.slice(position, position + count), attributes, pool, origin, plain));
          position += count;
          attributes = [];
        }
      }
      if (position < text.length) output.push(markText(text.slice(position), [], pool, origin, plain));
      return output.join("");
    }).join("\n");
  }

  function normalize(id, raw) {
    if (!raw || typeof raw !== "object") throw new Error("文档块数据格式无法识别");
    const data = raw.data && typeof raw.data === "object" ? raw.data : raw;
    return {
      id, type: String(data.type ?? raw.type ?? "unknown").toLowerCase(),
      parent: String(raw.parent_id ?? data.parent_id ?? ""),
      children: unique(list(raw.children ?? data.children)), data
    };
  }

  function references(block) {
    const table = block.data.table || block.data;
    const cells = block.type === "table" ? Object.values(table.cell_set || {}).map((cell) => String(cell.block_id || "")).filter(Boolean) : [];
    return unique([...block.children, ...cells]);
  }

  class DocumentModel {
    constructor(origin) {
      this.origin = origin;
      this.blocks = new Map();
      this.sequence = [];
      this.sequenceSeen = new Set();
      this.unresolved = new Set();
      this.warnings = new Set();
      this.rootId = "";
      this.edgeCount = 0;
    }

    ingest(data) {
      if (!data || !data.block_map || typeof data.block_map !== "object" || Array.isArray(data.block_map)) {
        throw new Error("网页接口未返回文档块，可能需要重新登录或适配新版飞书");
      }
      let additions = 0;
      for (const [id, raw] of Object.entries(data.block_map)) {
        const block = normalize(id, raw);
        const previous = this.blocks.get(id);
        if (previous) {
          if (previous.type !== block.type || (previous.parent && block.parent && previous.parent !== block.parent)) {
            throw new Error("导出期间文档结构发生变化，请停止编辑后重试");
          }
          const children = unique([...previous.children, ...block.children]);
          additions += children.length - previous.children.length;
          this.edgeCount += children.length - previous.children.length;
          block.children = children;
          block.data = { ...previous.data, ...block.data };
          block.parent ||= previous.parent;
        } else {
          additions += 1;
          this.edgeCount += block.children.length;
        }
        this.blocks.set(id, block);
        this.unresolved.delete(id);
        for (const child of references(block)) if (!this.blocks.has(child)) this.unresolved.add(child);
        if (block.type === "page") {
          if (this.rootId && this.rootId !== id) throw new Error("接口返回多个文档根节点，已停止导出");
          this.rootId = id;
        }
      }
      if (this.blocks.size > MAX_BLOCKS) throw new Error("文档超过 12 万个内容块，请按章节拆分导出");
      for (const id of list(data.block_sequence)) {
        if (!this.sequenceSeen.has(id)) { this.sequenceSeen.add(id); this.sequence.push(id); }
        if (!this.blocks.has(id)) this.unresolved.add(id);
      }
      return additions;
    }

    missing() {
      return [...this.unresolved];
    }

    validate() {
      if (!this.rootId) throw new Error("未识别到文档根节点，无法确认全文完整性");
      if (this.missing().length) throw new Error("仍有文档内容块缺失，已停止生成全文文件");
      const root = this.blocks.get(this.rootId);
      const top = this.sequence.filter((id) => id !== this.rootId && this.blocks.get(id).parent === this.rootId);
      this.order = unique([...root.children, ...top]);
      if (!this.order.length && this.blocks.size > 1) throw new Error("无法确认正文顺序，已停止导出");
      const reached = new Set([this.rootId]);
      const active = new Set([this.rootId]);
      const visit = (id, depth) => {
        if (depth > MAX_DEPTH) throw new Error("文档嵌套层级过深，已停止导出");
        if (active.has(id)) throw new Error("文档结构存在循环引用，已停止导出");
        if (reached.has(id)) throw new Error("文档块被重复引用，无法确认正文顺序");
        const block = this.blocks.get(id);
        reached.add(id);
        active.add(id);
        for (const child of references(block)) visit(child, depth + 1);
        active.delete(id);
      };
      for (const id of this.order) visit(id, 0);
      if (reached.size !== this.blocks.size) throw new Error("部分内容块未连接到文档正文，已停止导出以避免遗漏");
      this.title = (typeof root.data.title === "string" ? root.data.title : textOf(root.data, this.origin, true)).trim() || "飞书文档";
      return { blocks: this.blocks.size, title: this.title };
    }

    *render(sourceUrl) {
      if (!this.order) this.validate();
      yield "# " + escape(this.title) + "\n\n";
      yield "来源：" + sourceUrl + "\n\n";
      for (const id of this.order) yield* this.renderBlock(id, "", 0);
    }

    *renderBlock(id, prefix, depth) {
      const block = this.blocks.get(id);
      const { type, data, children } = block;
      const inline = () => textOf(data, this.origin);
      const line = (text) => prefix + String(text).replace(/\n/g, "\n" + prefix);
      let childPrefix = prefix;
      if (type === "table") { yield* this.renderTable(block, prefix, depth); return; }
      if (type === "text" || type === "paragraph") yield line(inline()) + "\n\n";
      else if (/^heading_?\d+$/.test(type)) {
        const level = Math.min(6, Math.max(1, Number(type.match(/\d+/)[0])));
        yield line("#".repeat(level) + " " + inline()) + "\n\n";
      } else if (["bullet", "ordered", "todo"].includes(type)) {
        const marker = type === "ordered" ? String(Number(data.sequence || data.start || 1)) + ". "
          : type === "todo" ? "- [" + ([true, "true", 1].includes(data.done) ? "x" : " ") + "] " : "- ";
        yield prefix + marker + inline().replace(/\n/g, "\n" + prefix + " ".repeat(marker.length)) + "\n";
        childPrefix += " ".repeat(Math.max(4, marker.length));
      } else if (["quote", "callout", "quote_container"].includes(type)) {
        const content = inline();
        if (content) yield line("> " + content.replace(/\n/g, "\n> ")) + "\n\n";
        childPrefix += "> ";
      } else if (type === "code") {
        const text = textOf(data, this.origin, true);
        const fence = tickFence(text, 2);
        const language = String(data.language || data.code?.language || "").replace(/[^a-zA-Z0-9_+#.-]/g, "");
        yield line(fence + language + "\n" + text + "\n" + fence) + "\n\n";
      } else if (["divider", "horizontal_rule"].includes(type)) yield line("---") + "\n\n";
      else if (type === "equation") yield line("$$\n" + textOf(data, this.origin, true) + "\n$$") + "\n\n";
      else if (type === "image") {
        const image = data.image || data;
        let url = safeUrl(image.url || image.src || "", this.origin);
        if (!image.url && !image.src && image.token) {
          url = this.origin + "/space/api/box/stream/download/all/" + encodeURIComponent(image.token)
            + "/?mount_node_token=" + encodeURIComponent(id) + "&mount_point=docx_image";
        }
        if (url) {
          yield line("![" + escape(image.name || image.caption || "图片") + "](" + url.replace(/\)/g, "%29") + ")") + "\n\n";
          this.warnings.add("图片保留在线引用，离线访问或登录失效后可能无法显示。");
        } else { yield line("> [图片：请在原文查看]") + "\n\n"; this.warnings.add("部分图片无法取得引用，已保留占位提示。"); }
      } else if (!["grid", "grid_column", "table_cell", "page"].includes(type)) {
        yield line("> [" + escape(type) + " 内容：请在原文查看]") + "\n\n";
        const text = inline();
        if (text) yield line(text) + "\n\n";
        this.warnings.add("包含 Markdown 无法完整表达的内容（" + type + "），已保留占位提示。");
      }
      for (const child of children) yield* this.renderBlock(child, childPrefix, depth + 1);
      if (["bullet", "ordered", "todo"].includes(type)) yield "\n";
    }

    *renderTable(block, prefix, depth) {
      const table = block.data.table || block.data;
      const rows = list(table.rows_id);
      const columns = list(table.columns_id);
      const cells = table.cell_set;
      if (!rows.length || !columns.length || !cells) {
        this.warnings.add("部分表格结构无法识别，已按内容顺序输出。");
        yield prefix + "> [表格按内容顺序输出]\n\n";
        for (const id of block.children) yield* this.renderBlock(id, prefix, depth + 1);
        return;
      }
      if (rows.length * columns.length > 200000) throw new Error("单个表格过大，请将表格单独导出");
      const merged = Object.values(cells).some((cell) => Number(cell.merge_info?.row_span || 1) > 1 || Number(cell.merge_info?.col_span || 1) > 1);
      const covered = new Set();
      if (merged) { yield prefix + "<table>\n"; this.warnings.add("合并单元格表格使用 HTML 保留结构，需要支持 HTML 的 Markdown 查看器。"); }
      for (let row = 0; row < rows.length; row += 1) {
        const values = [];
        for (let column = 0; column < columns.length; column += 1) {
          const cell = cells[rows[row] + columns[column]];
          if (!cell?.block_id || !this.blocks.has(String(cell.block_id))) throw new Error("表格单元格缺失，已停止导出");
          if (covered.has(row + ":" + column)) continue;
          let content = "";
          for (const part of this.renderBlock(String(cell.block_id), "", depth + 1)) {
            content += part;
            if (content.length > 2 * 1024 * 1024) throw new Error("单个表格单元格过大，请单独导出");
          }
          content = content.trim();
          if (merged) {
            const spanRows = Number(cell.merge_info?.row_span || 1);
            const spanColumns = Number(cell.merge_info?.col_span || 1);
            if (!Number.isInteger(spanRows) || !Number.isInteger(spanColumns) || spanRows < 1 || spanColumns < 1
              || row + spanRows > rows.length || column + spanColumns > columns.length) throw new Error("表格合并范围异常");
            for (let r = row; r < row + spanRows; r += 1) for (let c = column; c < column + spanColumns; c += 1) {
              if (r !== row || c !== column) covered.add(r + ":" + c);
            }
            values.push("<td rowspan=\"" + spanRows + "\" colspan=\"" + spanColumns + "\">" + html(content).replace(/\n/g, "<br>") + "</td>");
          } else values.push(content.replace(/\\\|/g, "|").replace(/\|/g, "\\|").replace(/\n/g, "<br>"));
        }
        yield prefix + (merged ? "<tr>" + values.join("") + "</tr>" : "| " + values.join(" | ") + " |") + "\n";
        if (!merged && row === 0) yield prefix + "| " + columns.map(() => "---").join(" | ") + " |\n";
      }
      if (merged) yield prefix + "</table>\n";
      yield "\n";
    }
  }

  global.FeishuExportModel = { DocumentModel, textOf, safeUrl, references, MAX_BLOCKS };
})(globalThis);
