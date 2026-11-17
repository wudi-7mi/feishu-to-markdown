(function (global) {
  "use strict";
  const rich = global.FeishuRichHtml;

  const ignoredTags = new Set(["script", "style", "noscript", "template", "head", "meta", "link"]);
  const blockTags = new Set([
    "address", "article", "aside", "blockquote", "body", "dd", "details", "div", "dl", "dt",
    "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6",
    "header", "hr", "html", "li", "main", "nav", "ol", "p", "pre", "section", "table", "tbody",
    "td", "tfoot", "th", "thead", "tr", "ul", "summary", "math", "h7", "h8", "h9"
  ]);

  function cleanInline(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .split(/\r?\n/)
      .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
      .join("\n")
      .replace(/^\n+|\n+$/g, "");
  }

  function styleOf(node) {
    const style = {};
    const raw = node.getAttribute?.("style") || "";
    raw.split(";").forEach((part) => {
      const index = part.indexOf(":");
      if (index !== -1) style[part.slice(0, index).trim().toLowerCase()] = part.slice(index + 1).trim().toLowerCase();
    });
    return style;
  }

  function isBold(style) {
    const weight = style["font-weight"] || "";
    return weight === "bold" || weight === "bolder" || Number.parseInt(weight, 10) >= 600;
  }

  function isItalic(style) {
    return (style["font-style"] || "").includes("italic");
  }

  function isStrike(style) {
    return (style["text-decoration"] || style["text-decoration-line"] || "").includes("line-through");
  }

  function textContent(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    if (node.tagName.toLowerCase() === "br") return "\n";
    return Array.from(node.childNodes).map(textContent).join("");
  }

  function preserveSpace(text, marker) {
    if (!text || !text.trim()) return text;
    const leading = text.match(/^\s*/)[0];
    const trailing = text.match(/\s*$/)[0];
    return leading + marker + text.trim() + marker + trailing;
  }

  function escapeCode(text) {
    let ticks = "`";
    while (text.includes(ticks)) ticks += "`";
    return /^\s|\s$/.test(text) ? ticks + " " + text + " " + ticks : ticks + text + ticks;
  }

  const embeddedTypes = new Map([
    ["思维导图", ["mindnote", "mindnotes", "mindmap", "mind-map", "mind_note", "思维导图", "思维笔记"]],
    ["画板", ["board", "whiteboard", "white-board", "画板", "白板"]],
    ["流程图/图表", ["diagram", "flowchart", "flow-chart", "uml", "流程图", "图表"]],
    ["电子表格", ["sheet", "spreadsheet", "电子表格"]],
    ["多维表格", ["bitable", "多维表格"]],
    ["视频", ["video", "视频"]], ["音频", ["audio", "音频"]],
    ["附件", ["file", "attachment", "附件"]],
    ["嵌入内容", ["iframe", "embed", "嵌入内容"]],
    ["文档小组件", ["widget", "addon", "add-ons", "isv", "文档小组件", "小组件"]],
    ["同步块", ["synced-block", "synced_block", "同步块"]],
    ["群名片", ["chat-card", "chat_card", "群名片"]],
    ["投票", ["poll", "vote", "投票"]]
  ].flatMap(([label, aliases]) => aliases.map((alias) => [alias.replace(/[-_]/g, ""), label])));
  const typeAttributes = ["data-block-type", "data-type", "data-lark-type", "data-node-type", "data-embed-type"];
  const nativeEmbeds = new Map([["iframe", "嵌入内容"], ["embed", "嵌入内容"], ["object", "嵌入内容"],
    ["canvas", "画布"], ["video", "视频"], ["audio", "音频"]]);

  function embeddedType(node) {
    for (let parent = node, depth = 0; parent && depth < 4; parent = parent.parentElement, depth += 1) {
      for (const attribute of typeAttributes) {
        const value = (parent.getAttribute(attribute) || "").trim().toLowerCase().replace(/[-_]/g, "");
        if (embeddedTypes.has(value)) return embeddedTypes.get(value);
      }
      // Match explicit component classes, not arbitrary words in document text.
      for (const name of parent.classList) {
        const match = name.match(/^(?:block|docx|feishu)[-_](.+)$|^(.+)[-_](?:block|container|wrapper)$/i);
        const value = (match?.[1] || match?.[2] || "").toLowerCase().replace(/[-_]/g, "");
        if (embeddedTypes.has(value)) return embeddedTypes.get(value);
      }
      for (const attribute of ["aria-label", "title"]) {
        const value = (parent.getAttribute(attribute) || "").trim().toLowerCase().replace(/[-_]/g, "");
        if (embeddedTypes.has(value)) return embeddedTypes.get(value);
      }
    }
    return nativeEmbeds.get(node.localName) || "";
  }

  function isUnavailableMessage(text) {
    const value = text.replace(/[\s\u200b-\u200d\ufeff]+/g, "").replace(/[。.!！]$/, "");
    return /^暂(?:时)?(?:无法|不支持)在(?:(?:飞书|Lark)(?:文档)?|[^，。！？:：]{1,32}文档)外(?:展示|显示)(?:此|该)?内容$/i.test(value);
  }

  function annotateUnavailableContent(doc) {
    // Work only on this copy's inert HTML. Never inspect the live document or
    // fetch component data. Opaque metadata and IDs are not guessed as types.
    const nodes = [doc.body, ...doc.body.querySelectorAll("*")].reverse();
    for (const node of nodes) {
      if (!doc.body.contains(node) || node.closest("pre, code, textarea, script, style, noscript, template, [data-lark-record-data]")) continue;
      const text = node.textContent.trim();
      const unavailable = isUnavailableMessage(text);
      const native = nativeEmbeds.has(node.localName);
      const label = (unavailable || !text || native) ? embeddedType(node) : "";
      const emptyComponent = !text && label && typeAttributes.some((attribute) => node.hasAttribute(attribute));
      if (!unavailable && !native && !emptyComponent) continue;
      // A copied preview is useful even when the native component is unavailable.
      if (!native && node.querySelector("img[src], video, audio, iframe, canvas, object, embed, pre, code, textarea, script, style, noscript, template")) continue;
      const marker = label
        ? "[" + label + "：暂不支持转换为 Markdown，请在飞书原文中查看]"
        : "[未识别的飞书内容块：剪贴板未提供类型，请在飞书原文中查看]";
      if (native) {
        const replacement = doc.createElement("span");
        replacement.appendChild(doc.createTextNode(marker + (text && !unavailable ? " " : "")));
        if (text && !unavailable) replacement.append(...node.childNodes);
        node.replaceWith(replacement);
      } else node.replaceChildren(doc.createTextNode(marker));
    }
  }

  function renderInline(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = node.tagName.toLowerCase();
    if (ignoredTags.has(tag)) return "";
    const ref = rich?.reference(node);
    if (ref && !node.querySelector("a, img")) {
      if (ref.url) return "[" + (ref.name || (ref.file ? "附件" : "链接")) + "](" + ref.url + ")";
      if (ref.file && ref.name) return "[附件：" + ref.name + "，剪贴板未提供可用链接]";
    }
    const tex = rich?.formulaSource(node);
    if (tex) return "$" + tex + "$";
    if (rich?.needsInline(node)) return rich.serialize(node);
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n---\n";
    if (tag === "img") {
      const src = rich ? rich.safeUrl(node.getAttribute("src"), true) : node.getAttribute("src") || "";
      const alt = cleanInline(node.getAttribute("alt") || node.getAttribute("title") || "");
      return src ? "![" + alt + "](" + src + ")" : "";
    }
    if (tag === "input" && (node.getAttribute("type") || "").toLowerCase() === "checkbox") {
      return node.checked || node.hasAttribute("checked") || node.getAttribute("aria-checked") === "true" ? "[x] " : "[ ] ";
    }
    if (tag === "code") return escapeCode(cleanInline(textContent(node)));

    const style = styleOf(node);
    let content = Array.from(node.childNodes).map(renderInline).join("");
    if (tag === "a") {
      const href = rich ? rich.safeUrl(node.getAttribute("href")) : node.getAttribute("href") || "";
      const label = cleanInline(content) || href;
      return href && label ? "[" + label + "](" + href + ")" : label;
    }
    if (tag === "strong" || tag === "b" || isBold(style)) content = preserveSpace(content, "**");
    if (tag === "em" || tag === "i" || isItalic(style)) content = preserveSpace(content, "*");
    if (tag === "s" || tag === "strike" || tag === "del" || isStrike(style)) content = preserveSpace(content, "~~");
    return content;
  }

  function hasBlockChild(node) {
    return Array.from(node.children || []).some((child) => blockTags.has(child.tagName.toLowerCase()) && child.tagName.toLowerCase() !== "br");
  }

  function renderList(node) {
    const ordered = node.tagName.toLowerCase() === "ol"
      && !node.querySelector(":scope > li[data-list='bullet']")
      && !/\blist-bullet\d*\b/.test(node.className);
    let index = Number(node.getAttribute("start") || "1");
    if (!Number.isFinite(index)) index = 1;
    const chunks = [];
    Array.from(node.childNodes).forEach((item) => {
      // Feishu also puts paragraphs, code and tables directly inside nested
      // lists. Preserve those blocks even when the clipboard HTML has no li.
      if (item.nodeType !== Node.ELEMENT_NODE || item.tagName.toLowerCase() !== "li") {
        const value = renderBlock(item);
        if (value) chunks.push({ value, listItem: false });
        return;
      }
      const marker = ordered ? index++ + "." : "-";
      const blocks = [];
      const inline = [];
      const flushInline = () => {
        const value = cleanInline(inline.join(""));
        if (value) blocks.push(value);
        inline.length = 0;
      };
      Array.from(item.childNodes).forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE && blockTags.has(child.tagName.toLowerCase())) {
          flushInline();
          const value = renderBlock(child);
          if (value) blocks.push(value);
        } else inline.push(renderInline(child));
      });
      flushInline();
      const continuation = " ".repeat(marker.length + 1);
      const value = blocks.join("\n\n").split("\n")
        .map((line, lineIndex) => lineIndex === 0 ? marker + " " + line : line ? continuation + line : "")
        .join("\n");
      chunks.push({ value, listItem: true });
    });
    return chunks.map((chunk, chunkIndex) => {
      const separator = chunkIndex === 0 ? "" : chunk.listItem && chunks[chunkIndex - 1].listItem ? "\n" : "\n\n";
      return separator + chunk.value;
    }).join("");
  }

  function renderCellBlocks(node) {
    const blocks = [], inline = [];
    const flushInline = () => {
      const value = cleanInline(inline.join(""));
      if (value) blocks.push(value);
      inline.length = 0;
    };
    for (const child of node.childNodes) {
      const tag = child.nodeType === Node.ELEMENT_NODE ? child.localName : "";
      if (blockTags.has(tag)) {
        flushInline();
        const value = rich?.needsBlock(child) ? rich.serialize(child)
          : tag === "div" || tag === "p" ? renderCellBlocks(child) : renderBlock(child);
        if (value) blocks.push(value);
      } else inline.push(renderInline(child));
    }
    flushInline();
    return blocks.join("\n\n");
  }

  // Only unescaped line-break tags outside inline code are table separators.
  // Rich HTML is handled separately by the strict rich-format sanitizer.
  function replaceCellBreaks(raw, replace) {
    let value = "", ticks = 0;
    const lineBreak = /<br\s*\/?>/iy;
    for (let index = 0; index < raw.length;) {
      if (raw[index] === "\\" && index + 1 < raw.length) {
        value += raw.slice(index, index + 2);
        index += 2;
        continue;
      }
      if (raw[index] === "`") {
        let end = index + 1;
        while (raw[end] === "`") end += 1;
        const count = end - index;
        if (!ticks) ticks = count;
        else if (ticks === count) ticks = 0;
        value += raw.slice(index, end);
        index = end;
        continue;
      }
      lineBreak.lastIndex = index;
      const match = !ticks && raw[index] === "<" && lineBreak.exec(raw);
      if (match) {
        value += replace(match[0]);
        index += match[0].length;
      } else value += raw[index++];
    }
    return value;
  }

  function renderCellMarkdown(cell) {
    const value = replaceCellBreaks(renderCellBlocks(cell), (tag) => "\\" + tag);
    return value.replace(/(\\*)\|/g, (_, slashes) => "\\".repeat(slashes.length * 2 + 1) + "|").split("\n")
      .map((line) => line.replace(/^ +/, (spaces) => "&nbsp;".repeat(spaces.length)))
      .join("<br>");
  }

  function renderTable(node) {
    if (rich?.needsBlock(node)) return rich.serialize(node);
    const rows = Array.from(node.rows).map((row) => Array.from(row.children)
      .filter((cell) => cell.matches("th,td"))
      .map(renderCellMarkdown));
    if (!rows.length) return "";
    const width = Math.max(...rows.map((row) => row.length));
    rows.forEach((row) => { while (row.length < width) row.push(""); });
    return [
      "| " + rows[0].join(" | ") + " |",
      "| " + rows[0].map(() => "---").join(" | ") + " |",
      ...rows.slice(1).map((row) => "| " + row.join(" | ") + " |")
    ].join("\n");
  }

  function renderBlock(node) {
    if (node.nodeType === Node.TEXT_NODE) return cleanInline(node.nodeValue || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = node.tagName.toLowerCase();
    if (ignoredTags.has(tag)) return "";
    const ref = rich?.reference(node);
    if (ref && !node.querySelector("a, img")) return renderInline(node);
    if (tag === "pre") {
      const content = textContent(node).replace(/^\n+|\n+$/g, "");
      let fence = "```";
      while (content.includes(fence)) fence += "`";
      const code = node.querySelector("code") || node;
      let language = code.getAttribute("data-language") || code.getAttribute("data-lark-language")
        || code.className.match(/(?:^|\s)language-([^\s]+)/)?.[1] || "";
      language = ({ "plain text": "text", "c++": "cpp", "c#": "csharp", "visual basic": "vb" })[language.toLowerCase()]
        || language.toLowerCase().replace(/\s+/g, "-");
      if (!/^[a-z0-9_#+.-]{1,40}$/i.test(language)) language = "";
      return fence + language + "\n" + content + "\n" + fence;
    }
    const tex = rich?.formulaSource(node);
    if (tex) return node.localName === "div" || node.getAttribute("display") === "block" ? "$$\n" + tex + "\n$$" : "$" + tex + "$";
    if (rich?.needsBlock(node)) return rich.serialize(node);
    const level = rich?.headingLevel(node) || (/^h[1-6]$/.test(tag) ? Number(tag.slice(1)) : 0);
    if (level && level <= 6) return "#".repeat(level) + " " + cleanInline(Array.from(node.childNodes).map(renderInline).join(""));
    if (tag === "ul" || tag === "ol") return renderList(node);
    if (tag === "table") return renderTable(node);
    if (tag === "blockquote") return renderBlocks(node).split("\n").map((line) => line ? "> " + line : ">").join("\n");
    if (tag === "hr") return "---";
    if (tag === "p" || tag === "figcaption" || !hasBlockChild(node)) return cleanInline(Array.from(node.childNodes).map(renderInline).join(""));
    return renderBlocks(node);
  }

  function renderBlocks(node) {
    return Array.from(node.childNodes).map(renderBlock).filter(Boolean).join("\n\n");
  }

  function fromHtml(rawHtml) {
    const doc = new DOMParser().parseFromString(rawHtml || "", "text/html");
    annotateUnavailableContent(doc);
    return renderBlocks(doc.body).replace(/\n{3,}/g, "\n\n").trim();
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderMarkdownInline(raw, forClipboard = false) {
    const placeholders = [];
    const stash = (html) => {
      const token = "\u0000" + placeholders.length + "\u0000";
      placeholders.push(html);
      return token;
    };
    const safeUrl = (value) => /^(?:https?:|mailto:)/i.test(value) ? value : "#";
    let text = "";
    const source = String(raw || "");
    for (let index = 0; index < source.length;) {
      if (source[index] === "\\" && /[\\`*_[\]{}()#+.!|><$-]/.test(source[index + 1] || "")) {
        text += stash(escapeHtml(source[index + 1])); index += 2; continue;
      }
      if (source[index] === "`") {
        const ticks = source.slice(index).match(/^`+/)[0];
        let end = index + ticks.length;
        while ((end = source.indexOf(ticks, end)) !== -1 && (source[end - 1] === "`" || source[end + ticks.length] === "`")) end += ticks.length;
        if (end !== -1) {
          let code = source.slice(index + ticks.length, end).replace(/\n/g, " ");
          if (/^ .+ $/.test(code) && /[^ ]/.test(code)) code = code.slice(1, -1);
          text += stash("<code>" + escapeHtml(code) + "</code>"); index = end + ticks.length; continue;
        }
      }
      if (rich && source[index] === "<") {
        const fragment = rich.readFragment(source, index);
        if (fragment) { text += stash(rich.sanitize(fragment.raw, { forClipboard })); index = fragment.end; continue; }
      }
      if (rich && source[index] === "$" && source[index + 1] !== "$" && !/\s/.test(source[index + 1] || " ")) {
        let end = index + 1;
        while ((end = source.indexOf("$", end)) !== -1 && source[end - 1] === "\\") end += 1;
        if (end > index + 1 && !/\s/.test(source[end - 1]) && !/\d/.test(source[end + 1] || "") && !source.slice(index + 1, end).includes("\n")) {
          text += stash(rich.equation(source.slice(index + 1, end), false, forClipboard)); index = end + 1; continue;
        }
      }
      text += source[index++];
    }
    text = text.replace(/!\[([^\]]*)\]\((\S+?)(?:\s+[\"']([^\"']*)[\"'])?\)/g,
      (_, alt, src, title) => stash("<img src=\"" + escapeHtml(safeUrl(src)) + "\" alt=\"" + escapeHtml(alt) + "\"" + (title ? " title=\"" + escapeHtml(title) + "\"" : "") + ">"));
    text = text.replace(/\[([^\]]+)\]\((\S+?)(?:\s+[\"']([^\"']*)[\"'])?\)/g,
      (_, label, href, title) => stash("<a href=\"" + escapeHtml(safeUrl(href)) + "\"" + (title ? " title=\"" + escapeHtml(title) + "\"" : "") + ">" + escapeHtml(label) + "</a>"));
    text = escapeHtml(text);
    text = text.replace(/(\*\*|__)(.+?)\1/g, "<strong>$2</strong>");
    text = text.replace(/(~~)(.+?)\1/g, "<del>$2</del>");
    text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    text = text.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
    return text.replace(/\u0000(\d+)\u0000/g, (_, index) => placeholders[Number(index)] || "");
  }

  function isTableSeparator(line) {
    return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  }

  function splitTableRow(line) {
    let value = line.trim();
    if (value.startsWith("|")) value = value.slice(1);
    if (value.endsWith("|")) {
      let backslashes = 0;
      for (let index = value.length - 2; index >= 0 && value[index] === "\\"; index -= 1) backslashes += 1;
      if (backslashes % 2 === 0) value = value.slice(0, -1);
    }

    const cells = [];
    let cell = "";
    let codeTicks = 0;
    for (let index = 0; index < value.length; index += 1) {
      const character = value[index];
      if (character === "\\" && index + 1 < value.length) {
        cell += character + value[index + 1];
        index += 1;
        continue;
      }
      if (character === "`") {
        let runLength = 1;
        while (value[index + runLength] === "`") runLength += 1;
        if (codeTicks === 0) codeTicks = runLength;
        else if (codeTicks === runLength) codeTicks = 0;
        cell += "`".repeat(runLength);
        index += runLength - 1;
        continue;
      }
      if (character === "|" && codeTicks === 0) {
        cells.push(cell.trim());
        cell = "";
        continue;
      }
      cell += character;
    }
    cells.push(cell.trim());
    return cells;
  }

  function renderMarkdownList(records, start, indent, nativeLists = false, forClipboard = false) {
    const ordered = records[start].ordered;
    const startNumber = records[start].number;
    const items = [];
    let index = start;
    while (index < records.length && records[index].indent === indent && records[index].ordered === ordered) {
      const record = records[index++];
      const task = record.content.match(/^\[([ xX])\]\s+(.*)$/);
      const body = task
        ? "<input type=\"checkbox\" disabled" + (task[1].toLowerCase() === "x" ? " checked" : "") + "> " + renderMarkdownInline(task[2], forClipboard)
        : renderMarkdownInline(record.content, forClipboard);
      let nested = "";
      while (index < records.length && records[index].indent > indent) {
        const result = renderMarkdownList(records, index, records[index].indent, nativeLists, forClipboard);
        nested += result.html;
        index = result.index;
      }
      items.push(nativeLists
        ? '<li class="ace-line" data-list="' + (ordered ? "number" : "bullet") + '"><div>' + body + '</div>' + nested + '</li>'
        : "<li>" + body + nested + "</li>");
    }
    const tag = ordered ? "ol" : "ul";
    const startAttribute = ordered && (nativeLists || startNumber !== 1) ? " start=\"" + startNumber + "\"" : "";
    const classAttribute = nativeLists ? ' class="list-' + (ordered ? "number" : "bullet") + '1"' : "";
    return { html: "<" + tag + startAttribute + classAttribute + ">" + items.join("") + "</" + tag + ">", index };
  }

  const codeLanguages = new Map([
    "Plain Text", "ABAP", "Ada", "Apache", "Apex", "Assembly language", "Bash", "C", "C#", "C++",
    "COBOL", "CSS", "CoffeeScript", "D", "Dart", "Delphi", "Django", "Dockerfile", "Erlang", "Fortran",
    "FoxPro", "Gherkin", "Go", "Groovy", "HTML", "HTMLBars", "HTTP", "Haskell", "JSON", "Java",
    "JavaScript", "Julia", "Kotlin", "LaTeX", "Lisp", "Logo", "Lua", "MATLAB", "Makefile", "Markdown",
    "Nginx", "Objective-C", "OpenEdge ABL", "OpenGL Shading Language", "PHP", "Perl", "PostScript",
    "PowerShell", "Prolog", "ProtoBuf", "Python", "R", "RPG", "Ruby", "Rust", "SAS", "SCSS", "SQL",
    "Scala", "Scheme", "Scratch", "Shell", "Swift", "Thrift", "TypeScript", "VBScript", "Visual Basic", "XML", "YAML"
  ].map((language) => [language.toLowerCase(), language]));
  const codeLanguageAliases = {
    js: "JavaScript", jsx: "JavaScript", ts: "TypeScript", tsx: "TypeScript", py: "Python", rb: "Ruby",
    rs: "Rust", golang: "Go", sh: "Shell", zsh: "Shell", yml: "YAML", md: "Markdown", cpp: "C++",
    csharp: "C#", cs: "C#", objc: "Objective-C", docker: "Dockerfile", ps1: "PowerShell", proto: "ProtoBuf",
    text: "Plain Text", txt: "Plain Text", plaintext: "Plain Text"
  };

  function renderMarkdownCode(content, language) {
    const key = language.toLowerCase();
    const nativeLanguage = Object.hasOwn(codeLanguageAliases, key)
      ? codeLanguageAliases[key] : codeLanguages.get(key) || "Plain Text";
    const lang = " class=\"language-" + nativeLanguage + "\"" + (language ? " data-language=\"" + escapeHtml(language) + "\"" : "");
    // Match Feishu's native clipboard HTML. Its code body lives inside a div;
    // a text node directly under code can be imported outside an empty block.
    return "<pre style=\"white-space:pre;\"><code" + lang + " data-lark-language=\"" + nativeLanguage
      + "\" data-wrap=\"false\"><div>" + escapeHtml(content) + "</div></code></pre>";
  }

  function renderMarkdownCell(raw, forClipboard = false, isHeader = false) {
    // Remove the table delimiter escape before parsing code or TeX. A literal
    // backslash before a pipe is exported as a doubled backslash plus \|.
    const source = replaceCellBreaks(String(raw || "").replace(/(\\+)\|/g,
      (_, slashes) => "\\".repeat(Math.floor(slashes.length / 2)) + "|"), () => "\n")
      .replace(/^(?:[ \t]|&nbsp;|&#160;|&#xa0;)+/gim,
        (spaces) => spaces.replace(/&nbsp;|&#160;|&#xa0;/gi, " "));
    const blockContent = source.includes("\n") || /^\s*(?:[-*+] |\d+[.)] )/.test(source);
    let html = !source.trim() ? "" : blockContent
      ? markdownToHtml(source, forClipboard, forClipboard) : "<p>" + renderMarkdownInline(source, forClipboard) + "</p>";
    if (isHeader) html = html.replace(/<p>([\s\S]*?)<\/p>/g,
      (_, body) => "<p>" + (body.includes("<strong>") ? body : "<strong>" + body + "</strong>") + "</p>");
    if (forClipboard) {
      return html.replace(/<p>/g, '<div style="text-align:left" class="ace-line">').replace(/<\/p>/g, "</div>")
        || '<div style="text-align:left" class="ace-line"><br></div>';
    }
    // Keep simple cells inline, retaining block structure in compound cells.
    return /^<p>(?:(?!<\/p>)[\s\S])*<\/p>$/.test(html) ? html.slice(3, -4) : html;
  }

  function renderClipboardTable(header, rows) {
    // Feishu's document tables carry ace-table and column widths, with a
    // paragraph inside each td. Use that clipboard shape by default.
    const columnWidth = 200;
    const widths = header.map(() => columnWidth);
    const rowHtml = (cells, isHeader) => "<tr>" + header.map((_, index) => {
      const body = renderMarkdownCell(cells[index] || "", true, isHeader);
      return '<td colspan="1" rowspan="1" style="border:1px solid rgb(222, 224, 227);font-size:10pt;padding:8px;vertical-align:top;">'
        + body + '</td>';
    }).join("") + "</tr>";
    return '<div><table class="ace-table" data-ace-table-col-widths="' + widths.join(";")
      + '" style="border:none;border-collapse:collapse;table-layout:fixed;width:' + columnWidth * header.length + 'px;">'
      + '<colgroup>' + widths.map((width) => '<col width="' + width + '">').join("") + '</colgroup><tbody>'
      + rowHtml(header, true) + rows.map((row) => rowHtml(row, false)).join("") + '</tbody></table></div>';
  }

  function markdownToHtml(markdown, forClipboard = false, nativeLists = false) {
    const source = String(markdown || "").replace(/\r\n?/g, "\n");
    if (!source.trim()) return "";
    const lines = source.split("\n");
    let offset = 0;
    const positions = lines.map(line => { const start = offset; offset += line.length + 1; return start; });
    const output = [];
    let index = 0;
    const isList = (line) => /^\s*(?:[-*+] |\d+[.)] )/.test(line);

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) { index += 1; continue; }
      const fence = line.match(/^\s*(`{3,}|~{3,})[ \t]*(.*)$/);
      if (fence && (fence[1][0] !== "`" || !fence[2].includes("`"))) {
        const marker = fence[1][0];
        const close = new RegExp("^\\s*" + marker + "{" + fence[1].length + ",}\\s*$");
        index += 1;
        const code = [];
        while (index < lines.length && !close.test(lines[index])) code.push(lines[index++]);
        if (index < lines.length) index += 1;
        const language = fence[2].trim().split(/\s+/)[0];
        output.push(renderMarkdownCode(code.join("\n"), language));
        continue;
      }
      if (rich && /^\s*\$\$/.test(line)) {
        const single = line.match(/^\s*\$\$(.+)\$\$\s*$/);
        let close = index + 1;
        while (close < lines.length && !/^\s*\$\$\s*$/.test(lines[close])) close += 1;
        if (single || /^\s*\$\$\s*$/.test(line) && close < lines.length) {
          const tex = single ? single[1] : lines.slice(index + 1, close).join("\n");
          output.push(rich.equation(tex, true, forClipboard));
          index = single ? index + 1 : close + 1;
          continue;
        }
      }
      const htmlStart = rich && line.match(/^(\s*)<([a-z][\w:-]*)\b/i);
      if (htmlStart && rich.isBlock(htmlStart[2].toLowerCase())) {
        const fragment = rich.readFragment(source, positions[index] + htmlStart[1].length);
        if (fragment) {
          output.push(rich.sanitize(fragment.raw, { forClipboard }));
          let last = index;
          while (last + 1 < positions.length && positions[last + 1] < fragment.end) last += 1;
          const tail = source.slice(fragment.end, last + 1 < positions.length ? positions[last + 1] - 1 : source.length);
          if (tail.trim()) output.push(markdownToHtml(tail, forClipboard, nativeLists));
          index = last + 1;
          continue;
        }
      }
      const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) { output.push("<h" + heading[1].length + ">" + renderMarkdownInline(heading[2], forClipboard) + "</h" + heading[1].length + ">"); index += 1; continue; }
      if (/^\s*(?:\*\s*){3,}$/.test(line) || /^\s*(?:-\s*){3,}$/.test(line) || /^\s*_{3,}\s*$/.test(line)) { output.push("<hr>"); index += 1; continue; }
      if (/^\s*>/.test(line)) {
        const quote = [];
        while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].replace(/^\s*> ?/, ""));
        output.push("<blockquote>" + markdownToHtml(quote.join("\n"), forClipboard, nativeLists) + "</blockquote>");
        continue;
      }
      if (index + 1 < lines.length && line.includes("|") && isTableSeparator(lines[index + 1])) {
        const header = splitTableRow(line);
        index += 2;
        const rows = [];
        while (index < lines.length && lines[index].trim() && lines[index].includes("|")) rows.push(splitTableRow(lines[index++]));
        if (forClipboard) {
          output.push(renderClipboardTable(header, rows));
          continue;
        }
        const width = header.length;
        const rowHtml = (cells, tag) => "<tr>" + Array.from({ length: width }, (_, i) => "<" + tag + ">" + renderMarkdownCell(cells[i] || "") + "</" + tag + ">").join("") + "</tr>";
        output.push("<table><thead>" + rowHtml(header, "th") + "</thead>" + (rows.length ? "<tbody>" + rows.map((row) => rowHtml(row, "td")).join("") + "</tbody>" : "") + "</table>");
        continue;
      }
      if (isList(line)) {
        const records = [];
        while (index < lines.length) {
          if (!lines[index].trim()) {
            let next = index + 1;
            while (next < lines.length && !lines[next].trim()) next += 1;
            if (next < lines.length && isList(lines[next])) { index = next; continue; }
          }
          const match = lines[index].replace(/\t/g, "    ").match(/^(\s*)([-*+]|(\d+)[.)])\s+(.*)$/);
          if (!match) break;
          records.push({ indent: match[1].length, ordered: Boolean(match[3]), number: Number(match[3] || 1), content: match[4] });
          index += 1;
        }
        let recordIndex = 0;
        while (recordIndex < records.length) {
          const result = renderMarkdownList(records, recordIndex, records[recordIndex].indent, nativeLists, forClipboard);
          output.push(result.html);
          recordIndex = result.index;
        }
        continue;
      }
      const paragraph = [line];
      index += 1;
      while (index < lines.length && lines[index].trim() && !/^\s*(?:#{1,6}\s|>|```|~~~|[-*+]\s+|\d+[.)]\s+|\$\$)/.test(lines[index])
        && !(rich && /^\s*<(?:div|p|details|table|math|blockquote|ul|ol|pre|h[1-6])\b/i.test(lines[index]))
        && !(lines[index].includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1]))) paragraph.push(lines[index++]);
      output.push("<p>" + renderMarkdownInline(paragraph.join("\n"), forClipboard).replace(/\n/g, "<br>") + "</p>");
    }
    return output.join("");
  }

  function toClipboardHtml(markdown) {
    const html = markdownToHtml(markdown, true);
    return html ? '<div data-lark-html-role="root" data-docx-has-block-data="false">' + html + '</div>' : "";
  }

  global.FeishuMarkdownConverter = { fromHtml, toHtml: markdownToHtml, toClipboardHtml };
})(globalThis);
