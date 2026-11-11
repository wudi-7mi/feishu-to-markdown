(function (global) {
  "use strict";

  const ignoredTags = new Set(["script", "style", "noscript", "template", "head", "meta", "link"]);
  const blockTags = new Set([
    "address", "article", "aside", "blockquote", "body", "dd", "details", "div", "dl", "dt",
    "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6",
    "header", "hr", "html", "li", "main", "nav", "ol", "p", "pre", "section", "table", "tbody",
    "td", "tfoot", "th", "thead", "tr", "ul"
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

  function renderInline(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = node.tagName.toLowerCase();
    if (ignoredTags.has(tag)) return "";
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n---\n";
    if (tag === "img") {
      const src = node.getAttribute("src") || "";
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
      const href = node.getAttribute("href") || "";
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
    const ordered = node.tagName.toLowerCase() === "ol";
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

  function renderTable(node) {
    const rows = Array.from(node.querySelectorAll("tr")).map((row) => Array.from(row.children)
      .filter((cell) => cell.matches("th,td"))
      .map((cell) => cleanInline(Array.from(cell.childNodes).map(renderInline).join(""))
        .replace(/\|/g, "\\|").replace(/\n/g, "<br>")));
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
    if (/^h[1-6]$/.test(tag)) return "#".repeat(Number(tag.slice(1))) + " " + cleanInline(Array.from(node.childNodes).map(renderInline).join(""));
    if (tag === "pre") {
      const content = textContent(node).replace(/^\n+|\n+$/g, "");
      let fence = "```";
      while (content.includes(fence)) fence += "`";
      return fence + "\n" + content + "\n" + fence;
    }
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

  function renderMarkdownInline(raw) {
    const placeholders = [];
    const stash = (html) => {
      const token = "\u0000" + placeholders.length + "\u0000";
      placeholders.push(html);
      return token;
    };
    const safeUrl = (value) => /^(?:https?:|mailto:)/i.test(value) ? value : "#";
    let text = String(raw || "").replace(/\\([\\`*_[\]{}()#+.!|>-])/g, (_, character) => stash(escapeHtml(character)));
    text = text.replace(/!\[([^\]]*)\]\((\S+?)(?:\s+[\"']([^\"']*)[\"'])?\)/g,
      (_, alt, src, title) => stash("<img src=\"" + escapeHtml(safeUrl(src)) + "\" alt=\"" + escapeHtml(alt) + "\"" + (title ? " title=\"" + escapeHtml(title) + "\"" : "") + ">"));
    text = text.replace(/\[([^\]]+)\]\((\S+?)(?:\s+[\"']([^\"']*)[\"'])?\)/g,
      (_, label, href, title) => stash("<a href=\"" + escapeHtml(safeUrl(href)) + "\"" + (title ? " title=\"" + escapeHtml(title) + "\"" : "") + ">" + escapeHtml(label) + "</a>"));
    text = text.replace(/`([^`\n]+)`/g, (_, code) => stash("<code>" + escapeHtml(code) + "</code>"));
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

  function renderMarkdownList(records, start, indent) {
    const ordered = records[start].ordered;
    const startNumber = records[start].number;
    const items = [];
    let index = start;
    while (index < records.length && records[index].indent === indent && records[index].ordered === ordered) {
      const record = records[index++];
      const task = record.content.match(/^\[([ xX])\]\s+(.*)$/);
      const body = task
        ? "<input type=\"checkbox\" disabled" + (task[1].toLowerCase() === "x" ? " checked" : "") + "> " + renderMarkdownInline(task[2])
        : renderMarkdownInline(record.content);
      let nested = "";
      while (index < records.length && records[index].indent > indent) {
        const result = renderMarkdownList(records, index, records[index].indent);
        nested += result.html;
        index = result.index;
      }
      items.push("<li>" + body + nested + "</li>");
    }
    const tag = ordered ? "ol" : "ul";
    const startAttribute = ordered && startNumber !== 1 ? " start=\"" + startNumber + "\"" : "";
    return { html: "<" + tag + startAttribute + ">" + items.join("") + "</" + tag + ">", index };
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

  function renderClipboardTable(header, rows) {
    // Feishu's document tables carry ace-table and column widths, with a
    // paragraph inside each td. Use that clipboard shape by default.
    const columnWidth = 200;
    const widths = header.map(() => columnWidth);
    const rowHtml = (cells, isHeader) => "<tr>" + header.map((_, index) => {
      const content = renderMarkdownInline(cells[index] || "");
      const body = isHeader && content ? "<strong>" + content + "</strong>" : content || "<br>";
      return '<td colspan="1" rowspan="1" style="border:1px solid rgb(222, 224, 227);font-size:10pt;padding:8px;vertical-align:top;">'
        + '<div style="text-align:left" class="ace-line">' + body + '</div></td>';
    }).join("") + "</tr>";
    return '<div><table class="ace-table" data-ace-table-col-widths="' + widths.join(";")
      + '" style="border:none;border-collapse:collapse;table-layout:fixed;width:' + columnWidth * header.length + 'px;">'
      + '<colgroup>' + widths.map((width) => '<col width="' + width + '">').join("") + '</colgroup><tbody>'
      + rowHtml(header, true) + rows.map((row) => rowHtml(row, false)).join("") + '</tbody></table></div>';
  }

  function markdownToHtml(markdown, forClipboard = false) {
    const source = String(markdown || "").replace(/\r\n?/g, "\n");
    if (!source.trim()) return "";
    const lines = source.split("\n");
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
      const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) { output.push("<h" + heading[1].length + ">" + renderMarkdownInline(heading[2]) + "</h" + heading[1].length + ">"); index += 1; continue; }
      if (/^\s*(?:\*\s*){3,}$/.test(line) || /^\s*(?:-\s*){3,}$/.test(line) || /^\s*_{3,}\s*$/.test(line)) { output.push("<hr>"); index += 1; continue; }
      if (/^\s*>/.test(line)) {
        const quote = [];
        while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].replace(/^\s*> ?/, ""));
        output.push("<blockquote>" + markdownToHtml(quote.join("\n"), forClipboard) + "</blockquote>");
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
        const rowHtml = (cells, tag) => "<tr>" + Array.from({ length: width }, (_, i) => "<" + tag + ">" + renderMarkdownInline(cells[i] || "") + "</" + tag + ">").join("") + "</tr>";
        output.push("<table><thead>" + rowHtml(header, "th") + "</thead>" + (rows.length ? "<tbody>" + rows.map((row) => rowHtml(row, "td")).join("") + "</tbody>" : "") + "</table>");
        continue;
      }
      if (isList(line)) {
        const records = [];
        while (index < lines.length) {
          const match = lines[index].replace(/\t/g, "    ").match(/^(\s*)([-*+]|(\d+)[.)])\s+(.+)$/);
          if (!match) break;
          records.push({ indent: match[1].length, ordered: Boolean(match[3]), number: Number(match[3] || 1), content: match[4] });
          index += 1;
        }
        let recordIndex = 0;
        while (recordIndex < records.length) {
          const result = renderMarkdownList(records, recordIndex, records[recordIndex].indent);
          output.push(result.html);
          recordIndex = result.index;
        }
        continue;
      }
      const paragraph = [line];
      index += 1;
      while (index < lines.length && lines[index].trim() && !/^\s*(?:#{1,6}\s|>|```|~~~|[-*+]\s+|\d+[.)]\s+)/.test(lines[index]) && !(lines[index].includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1]))) paragraph.push(lines[index++]);
      output.push("<p>" + renderMarkdownInline(paragraph.join("\n")).replace(/\n/g, "<br>") + "</p>");
    }
    return output.join("");
  }

  function toClipboardHtml(markdown) {
    const html = markdownToHtml(markdown, true);
    return html ? '<div data-lark-html-role="root" data-docx-has-block-data="false">' + html + '</div>' : "";
  }

  global.FeishuMarkdownConverter = { fromHtml, toHtml: markdownToHtml, toClipboardHtml };
})(globalThis);
