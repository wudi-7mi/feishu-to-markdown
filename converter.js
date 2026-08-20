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

  function isBold(node) {
    const weight = styleOf(node)["font-weight"] || "";
    return weight === "bold" || weight === "bolder" || Number.parseInt(weight, 10) >= 600;
  }

  function isItalic(node) {
    return (styleOf(node)["font-style"] || "").includes("italic");
  }

  function isStrike(node) {
    const style = styleOf(node);
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

    let content = Array.from(node.childNodes).map(renderInline).join("");
    if (tag === "a") {
      const href = node.getAttribute("href") || "";
      const label = cleanInline(content) || href;
      return href && label ? "[" + label + "](" + href + ")" : label;
    }
    if (tag === "strong" || tag === "b" || isBold(node)) content = preserveSpace(content, "**");
    if (tag === "em" || tag === "i" || isItalic(node)) content = preserveSpace(content, "*");
    if (tag === "s" || tag === "strike" || tag === "del" || isStrike(node)) content = preserveSpace(content, "~~");
    return content;
  }

  function hasBlockChild(node) {
    return Array.from(node.children || []).some((child) => blockTags.has(child.tagName.toLowerCase()) && child.tagName.toLowerCase() !== "br");
  }

  function renderList(node, indent) {
    const ordered = node.tagName.toLowerCase() === "ol";
    let index = Number(node.getAttribute("start") || "1");
    if (!Number.isFinite(index)) index = 1;
    const lines = [];
    Array.from(node.children).forEach((item) => {
      if (item.tagName.toLowerCase() !== "li") return;
      const marker = ordered ? index++ + "." : "-";
      const nested = [];
      const inline = [];
      Array.from(item.childNodes).forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE && ["ul", "ol"].includes(child.tagName.toLowerCase())) nested.push(renderList(child, indent + 1));
        else inline.push(renderInline(child));
      });
      lines.push("  ".repeat(indent) + marker + " " + cleanInline(inline.join("")));
      lines.push(...nested.filter(Boolean));
    });
    return lines.join("\n");
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
    if (tag === "ul" || tag === "ol") return renderList(node, 0);
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

  global.FeishuMarkdownConverter = { fromHtml };
})(globalThis);
