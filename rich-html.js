(function (global) {
  "use strict";

  const htmlTags = new Set("a b blockquote br code col colgroup del details div em figcaption figure h1 h2 h3 h4 h5 h6 h7 h8 h9 hr i img input li mark ol p pre s span strong sub summary sup table tbody td tfoot th thead tr u ul".split(" "));
  const mathTags = new Set("math semantics annotation mrow mi mn mo mtext mfrac msqrt mroot msub msup msubsup munder mover munderover mtable mtr mtd mstyle mspace mpadded mphantom menclose mfenced".split(" "));
  const blockTags = new Set("blockquote details div figure h1 h2 h3 h4 h5 h6 hr ol p pre table ul math".split(" "));
  const voidTags = new Set(["br", "hr", "img", "input", "col"]);
  const discarded = new Set("script style iframe object embed video audio canvas template noscript head meta link annotation-xml".split(" "));
  const escape = value => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  // Entity-encode Markdown punctuation inside HTML, so literal characters do
  // not become a second layer of Markdown formatting in another renderer.
  const htmlText = value => escape(value).replace(/[`*_[\]\\|]/g, character => "&#" + character.charCodeAt(0) + ";");
  const attribute = (name, value) => " " + name + '="' + escape(value).replace(/\|/g, "&#124;") + '"';

  function safeUrl(value, image = false) {
    const url = String(value || "").trim();
    if (/^(?:https?:|mailto:)/i.test(url) && !/[\u0000-\u0020\u007f]/.test(url)) return url;
    if (image && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(url)) return url;
    return "";
  }

  function color(value) {
    return /^(?:#[a-f0-9]{3,8}|(?:rgba?|hsla?)\([0-9\s.,%/+\-deg]+\)|[a-z]{1,24})$/i.test(value) ? value : "";
  }
  const length = value => /^(?:0|-?\d{1,4}(?:\.\d+)?(?:px|pt|em|rem|%))$/.test(value);
  function styles(node) {
    const result = {};
    const source = node.getAttribute?.("style") || "";
    for (const declaration of source.split(";")) {
      const colon = declaration.indexOf(":");
      if (colon < 0) continue;
      const name = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim().toLowerCase();
      if (!value || /[\\<>]|url\s*\(|expression|var\s*\(|!important/.test(value)) continue;
      let valid = false;
      if (["color", "background-color", "border-color"].includes(name)) valid = Boolean(color(value));
      else if (name === "background" && color(value)) { result["background-color"] = value; continue; }
      else if (name === "text-align") valid = /^(?:left|right|center|justify|start|end)$/.test(value);
      else if (name === "vertical-align") valid = /^(?:top|middle|bottom|baseline)$/.test(value);
      else if (name === "font-weight") valid = /^(?:normal|bold|bolder|[1-9]00)$/.test(value);
      else if (name === "font-style") valid = /^(?:normal|italic|oblique)$/.test(value);
      else if (["text-decoration", "text-decoration-line"].includes(name)) valid = /^(?:none|underline|line-through|overline)(?:\s+(?:underline|line-through|overline))*$/.test(value);
      else if (["font-size", "text-indent", "margin-left", "padding-left", "gap", "column-gap", "row-gap"].includes(name)) valid = length(value);
      else if (name === "text-underline-offset") valid = length(value);
      else if (name === "text-decoration-skip-ink") valid = /^(?:auto|none)$/.test(value);
      else if (["width", "height", "min-width", "max-width"].includes(name)) valid = length(value) || value === "auto";
      else if (["padding", "margin", "border-spacing"].includes(name)) valid = value.split(/\s+/).length <= 4 && value.split(/\s+/).every(length);
      else if (/^border(?:-(?:left|right|top|bottom))?$/.test(name)) {
        const match = value.match(/^(\d{1,2}(?:\.\d+)?px)\s+(solid|dashed|dotted|double)\s+(.+)$/);
        valid = value === "none" || Boolean(match && color(match[3]));
      } else if (name === "border-collapse") valid = /^(?:collapse|separate)$/.test(value);
      else if (name === "table-layout") valid = /^(?:fixed|auto)$/.test(value);
      else if (name === "white-space") valid = /^(?:normal|pre|pre-wrap)$/.test(value);
      else if (name === "display") valid = /^(?:block|inline|inline-block|flex|grid)$/.test(value);
      else if (name === "flex-direction") valid = /^(?:row|column)$/.test(value);
      else if (name === "flex-wrap") valid = /^(?:wrap|nowrap)$/.test(value);
      else if (name === "flex") valid = /^(?:\d(?:\.\d+)?)(?:\s+\d(?:\.\d+)?)?(?:\s+(?:0|\d+(?:px|%)))?$/.test(value);
      else if (name === "grid-template-columns") valid = /^(?:repeat\([1-9]\d?,\s*(?:minmax\(0,\s*1fr\)|\d+(?:fr|px|%))\)|\d+(?:\.\d+)?(?:fr|px|%)(?:\s+\d+(?:\.\d+)?(?:fr|px|%))*)$/.test(value);
      if (valid) result[name] = value;
    }
    const align = node.getAttribute?.("align");
    if (!result["text-align"] && /^(?:left|right|center|justify)$/.test(align || "")) result["text-align"] = align;
    const background = node.getAttribute?.("bgcolor");
    if (!result["background-color"] && color(background || "")) result["background-color"] = background;
    return result;
  }

  const semanticType = node => (node.getAttribute?.("data-feishu-format") || node.getAttribute?.("data-type") || node.getAttribute?.("data-block-type") || "").toLowerCase().replace(/[-_]/g, "");
  function reference(node) {
    if (!["mention", "mentionuser", "mentiondoc", "linkcard", "file", "attachment"].includes(semanticType(node))) return null;
    const url = ["href", "data-href", "data-url", "data-link"].map(name => safeUrl(node.getAttribute(name))).find(Boolean) || "";
    const text = node.textContent.trim();
    const name = ["data-file-name", "data-name", "data-title", "title", "aria-label"].map(key => node.getAttribute(key)).find(Boolean)
      || (/^\[.*(?:暂不支持转换为 Markdown|剪贴板未提供类型)/.test(text) ? "" : text);
    return { url, name, file: ["file", "attachment"].includes(semanticType(node)) };
  }
  function headingLevel(node) {
    const type = semanticType(node);
    const match = node.localName?.match(/^h([1-9])$/) || type.match(/^heading([1-9])$/)
      || String(node.className || "").match(/(?:^|\s)heading-([1-9])(?:\s|$)/);
    const level = Number(match?.[1] || node.getAttribute?.("data-feishu-heading-level")
      || (node.getAttribute?.("role") === "heading" ? node.getAttribute("aria-level") : 0));
    return level >= 1 && level <= 9 ? level : 0;
  }
  function formulaSource(node) {
    const meta = node.getAttribute?.("data-meta-block-props");
    if (meta && meta.length <= 200000) {
      try {
        const block = JSON.parse(meta);
        if (block.blockType === "EQUATION_BLOCK" && typeof block.props?.data?.equation === "string") return block.props.data.equation.trim();
      } catch (_) { /* Not a recognized native equation. */ }
    }
    for (const name of ["data-latex", "data-tex", "data-equation", "data-formula"]) {
      if (node.hasAttribute?.(name) && node.getAttribute(name).trim()) return node.getAttribute(name).trim();
    }
    if (node.localName === "math" || node.classList?.contains("katex") || node.classList?.contains("katex-mathml")) {
      return node.querySelector('annotation[encoding="application/x-tex"]')?.textContent.trim() || "";
    }
    return "";
  }
  function equation(tex, display = false, forClipboard = false) {
    const sourceTag = display ? "div" : "span";
    const source = () => '<' + sourceTag + ' data-feishu-format="formula-source"' + attribute("data-latex", tex)
      + '>[数学公式：保留 LaTeX 源码] <code>' + escape(tex) + '</code></' + sourceTag + '>';
    // Feishu's native equation also needs its private attributed-text pool.
    // A standalone component tag disappears; a partial pool can discard other
    // pasted content. Keep source explicitly instead of producing either loss.
    if (forClipboard) return source();
    if (global.katex && tex.length <= 20000) {
      try {
        const math = global.katex.renderToString(tex, { output: "mathml", displayMode: display, throwOnError: true,
          trust: false, strict: "ignore", maxExpand: 1000, maxSize: 20, macros: {} });
        return math;
      } catch (_) { /* Preserve unsupported source below. */ }
    }
    return source();
  }

  function needsInline(node) {
    const style = styles(node);
    return ["u", "mark", "sub", "sup", "math"].includes(node.localName) || Boolean(formulaSource(node))
      || Boolean(style.color || style["background-color"] || /underline/.test(style["text-decoration"] || style["text-decoration-line"] || ""));
  }
  function needsTable(node) {
    return ["style", "width", "height", "align", "bgcolor", "data-ace-table-col-widths"].some(name => node.hasAttribute(name))
      || Boolean(node.querySelector("colgroup, [rowspan]:not([rowspan='1']), [colspan]:not([colspan='1']), td[style], th[style], [align], [bgcolor]"));
  }
  function needsBlock(node) {
    const style = styles(node), type = semanticType(node);
    return node.localName === "details" || node.localName === "math" || headingLevel(node) > 6
      || ["callout", "grid", "columns", "gridcolumn", "column", "fold", "folded"].includes(type)
      || ["data-folded", "data-collapsed"].some(name => node.hasAttribute(name))
      || Boolean(style.color || style["background-color"] || style["text-align"] && !/^(?:left|start)$/.test(style["text-align"])
        || ["text-indent", "margin-left", "padding-left"].some(name => style[name] && !/^0(?:[a-z%]+)?$/.test(style[name]))
        || /^(?:flex|grid)$/.test(style.display || ""))
      || node.localName === "table" && needsTable(node);
  }

  function serialize(node, options = {}) {
    if (node.nodeType === 3) return htmlText(node.nodeValue);
    if (node.nodeType !== 1 || node.hasAttribute("data-lark-record-data")) return "";
    let tag = node.localName.toLowerCase();
    if (discarded.has(tag)) return "";
    const type = semanticType(node), level = headingLevel(node), style = styles(node);
    const ref = reference(node);
    if (ref && !node.querySelector("a, img")) {
      if (ref.url) return '<a' + attribute("href", ref.url) + '>' + htmlText(ref.name || (ref.file ? "附件" : "链接")) + '</a>';
      if (ref.file && ref.name) return htmlText('[附件：' + ref.name + '，剪贴板未提供可用链接]');
    }
    if (options.columnChild) delete style.width;
    if (tag === "mark") style["background-color"] ||= "#ffff00";
    const fold = tag !== "details" && ["data-folded", "data-collapsed"].some(name => node.hasAttribute(name));
    if (fold) {
      const first = node.firstElementChild;
      const summary = first ? Array.from(first.childNodes).map(child => serialize(child, options)).join("") : htmlText(node.textContent);
      const body = first ? Array.from(node.childNodes).filter(child => child !== first).map(child => serialize(child, options)).join("") : "";
      const closed = node.getAttribute("data-folded") === "true" || node.getAttribute("data-collapsed") === "true";
      return '<details' + (closed ? '' : ' open') + '><summary>' + summary + '</summary>'
        + (body || '[折叠内容：剪贴板未提供正文]') + '</details>';
    }
    if (level > 6) { tag = options.forClipboard ? "h" + level : "div"; style["font-weight"] ||= "bold"; style["font-size"] ||= (21 - level) + "px"; }
    if (!htmlTags.has(tag) && !mathTags.has(tag)) return Array.from(node.childNodes).map(child => serialize(child, options)).join("");
    const tex = formulaSource(node);
    if (tag === "math" && options.forClipboard && !tex) {
      return '<span data-feishu-format="mathml-source">[数学公式：仅保留 MathML 源码] <code>'
        + escape(serialize(node)) + '</code></span>';
    }
    if (tex && options.forClipboard && type !== "formulasource") return equation(tex, node.localName === "div" || node.getAttribute("display") === "block", true);
    if (tex && tag !== "math" && !node.querySelector("math") && type !== "formulasource") return equation(tex, node.localName === "div");
    let attrs = "";
    if (level > 6) attrs += ' role="heading"' + attribute("aria-level", level) + attribute("data-feishu-heading-level", level);
    if (["callout", "grid", "columns", "gridcolumn", "column"].includes(type)) {
      attrs += attribute("data-feishu-format", type);
      if (options.forClipboard) attrs += attribute("data-type", ({ columns:"grid", gridcolumn:"grid_column", column:"grid_column" })[type] || type);
      if (type === "callout") { style["border-left"] ||= "4px solid #d0d7de"; style.padding ||= "8px 12px"; style["background-color"] ||= "#f6f8fa"; }
      if (type === "grid" || type === "columns") {
        const count = Math.min(12, Math.max(1, node.children.length));
        const widths = Array.from(node.children).map(child => styles(child).width || "");
        const columns = widths.length && widths.every(width => /^\d+(?:\.\d+)?%$/.test(width))
          ? widths.map(width => width.slice(0, -1) + "fr").join(" ") : 'repeat(' + count + ',minmax(0,1fr))';
        style.display ||= "grid"; style["grid-template-columns"] ||= columns; style.gap ||= "12px";
      }
    }
    if (type === "formulasource") attrs += ' data-feishu-format="formula-source"' + attribute("data-latex", tex);
    if (tag === "a") {
      const url = safeUrl(node.getAttribute("href"));
      if (url) attrs += attribute("href", url);
    }
    if (tag === "img") {
      const url = safeUrl(node.getAttribute("src"), true);
      if (!url) return htmlText(node.getAttribute("alt") || "[图片：剪贴板未提供可用地址]");
      attrs += attribute("src", url) + attribute("alt", node.getAttribute("alt") || "");
    }
    if (node.hasAttribute("title")) attrs += attribute("title", node.getAttribute("title"));
    if (tag === "code") {
      for (const name of ["data-language", "data-lark-language"]) {
        const value = node.getAttribute(name);
        if (value && /^[a-z0-9_#+. -]{1,40}$/i.test(value)) attrs += attribute(name, value);
      }
      const languageClass = String(node.className || "").match(/(?:^|\s)(language-[a-z0-9_#+.-]{1,40})(?:\s|$)/i);
      if (languageClass) attrs += attribute("class", languageClass[1]);
    }
    if (tag === "details" && node.hasAttribute("open")) attrs += " open";
    if (tag === "ol") {
      const start = node.getAttribute("start");
      if (/^\d{1,6}$/.test(start || "")) attrs += attribute("start", start);
      else if (options.forClipboard && options.inCell) attrs += ' start="1"';
    }
    if (tag === "input") {
      if (node.getAttribute("type") !== "checkbox") return "";
      attrs += ' type="checkbox" disabled' + (node.hasAttribute("checked") ? ' checked' : '');
    }
    if (["td", "th"].includes(tag)) {
      for (const name of ["rowspan", "colspan"]) if (/^[1-9]\d{0,2}$/.test(node.getAttribute(name) || "")) attrs += attribute(name, node.getAttribute(name));
      if (options.forClipboard) {
        if (tag === "th") style["font-weight"] ||= "bold";
        tag = "td"; style.border ||= "1px solid #dee0e3"; style.padding ||= "8px"; style["vertical-align"] ||= "top";
      }
    }
    for (const name of ["width", "height"]) if (/^[1-9]\d{0,3}$/.test(node.getAttribute(name) || "")) attrs += attribute(name, node.getAttribute(name));
    if (mathTags.has(tag)) {
      if (tag === "math") attrs += ' xmlns="http://www.w3.org/1998/Math/MathML"' + (node.getAttribute("display") === "block" ? ' display="block"' : '');
      if (tag === "annotation") attrs += ' encoding="application/x-tex"';
      for (const name of ["mathvariant", "displaystyle", "scriptlevel", "stretchy", "accent", "accentunder", "fence", "separator", "form", "columnalign", "rowalign", "columnspacing", "rowspacing", "linethickness", "lspace", "rspace", "depth", "voffset"]) {
        const value = node.getAttribute(name);
        if (value && /^[a-z0-9\s.+%\-]{1,100}$/i.test(value)) attrs += attribute(name, value);
      }
    }
    const tableWidths = tag === "table" && node.getAttribute("data-ace-table-col-widths");
    if (tag === "table" && options.forClipboard) {
      attrs += ' class="ace-table"'; style["border-collapse"] ||= "collapse";
      const widths = tableWidths || Array.from(node.querySelectorAll(':scope > colgroup > col')).map(col => col.getAttribute('width') || '200').join(';');
      if (widths && /^\d{1,4}(?:;\d{1,4})*$/.test(widths)) attrs += attribute("data-ace-table-col-widths", widths);
    }
    const inCell = options.inCell || ["td", "th"].includes(node.localName);
    if (options.forClipboard && (tag === "p" || tag === "div" && inCell)) { tag = "div"; if (!options.listItem) attrs += ' class="ace-line"'; }
    if (options.forClipboard && inCell && (tag === "ul" || tag === "ol")) attrs += attribute("class", tag === "ol" ? "list-number1" : "list-bullet1");
    if (options.forClipboard && inCell && tag === "li") attrs += ' class="ace-line"' + attribute("data-list", node.parentElement.localName === "ol" ? "number" : "bullet");
    const css = Object.entries(style).map(([name, value]) => name + ":" + value).join(";");
    if (options.forClipboard && style["text-align"]) attrs += attribute("align", style["text-align"]);
    if (options.forClipboard && /^(?:#[a-f0-9]{6}|[a-z]+)$/i.test(style["background-color"] || "")) attrs += attribute("bgcolor", style["background-color"]);
    if (css) attrs += attribute("style", css);
    const childOptions = { ...options, inCell, listItem: tag === "li", columnChild: type === "grid" || type === "columns" };
    let children;
    if (options.forClipboard && inCell && ["td", "th", "li"].includes(node.localName)) {
      // Native table cells and list items need paragraph containers. Bare
      // text under li is flattened into a paragraph by Feishu's importer.
      const blocks = [];
      let inline = "";
      const paragraph = tag === "li" ? '<div>' : '<div class="ace-line">';
      const flush = () => { if (inline) blocks.push(paragraph + inline + '</div>'); inline = ""; };
      for (const child of node.childNodes) {
        const value = serialize(child, childOptions);
        if (child.nodeType === 1 && blockTags.has(child.localName)) { flush(); blocks.push(value); }
        else inline += value;
      }
      flush();
      children = blocks.join("") || paragraph + '<br></div>';
    } else children = Array.from(node.childNodes).map(child => serialize(child, childOptions)).join("");
    if (tag === "table" && tableWidths && /^\d{1,4}(?:;\d{1,4})*$/.test(tableWidths) && !node.querySelector(':scope > colgroup')) {
      children = '<colgroup>' + tableWidths.split(';').map(width => '<col width="' + width + '">').join('') + '</colgroup>' + children;
    }
    if (voidTags.has(tag)) return "<" + tag + attrs + ">";
    return "<" + tag + attrs + ">" + children + "</" + tag + ">";
  }

  function sanitize(raw, options = {}) {
    if (!global.DOMParser) return escape(raw);
    const doc = new DOMParser().parseFromString(raw, "text/html");
    return Array.from(doc.body.childNodes).map(node => serialize(node, options)).join("");
  }
  function readFragment(source, start = 0) {
    const tokens = /<\/?([a-z][\w:-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
    tokens.lastIndex = start;
    const first = tokens.exec(source);
    if (!first || first.index !== start || /^<\//.test(first[0])) return null;
    const tag = first[1].toLowerCase();
    if (!htmlTags.has(tag) && !mathTags.has(tag)) return null;
    if (voidTags.has(tag) || /\/>$/.test(first[0])) return { raw: first[0], end: tokens.lastIndex, tag };
    let depth = 1;
    for (let token; (token = tokens.exec(source));) {
      if (token[1].toLowerCase() !== tag) continue;
      if (/^<\//.test(token[0])) depth -= 1;
      else if (!/\/>$/.test(token[0])) depth += 1;
      if (!depth) return { raw: source.slice(start, tokens.lastIndex), end: tokens.lastIndex, tag };
    }
    return null;
  }
  function looksLikeSource(text) {
    const tag = text.match(/<(span|mark|u|sub|sup|div|p|details|table|math|blockquote)\b/i);
    return Boolean(tag && readFragment(text, tag.index)) || /(?:^|[^\\])(?:\$\$[^$]+\$\$|\$[^\s$][^\n$]*[^\s$]\$(?!\d)|\$[^\s$]\$(?!\d))/m.test(text);
  }
  global.FeishuRichHtml = { safeUrl, styles, reference, headingLevel, formulaSource, equation, needsInline, needsBlock, serialize, sanitize, readFragment,
    isBlock: tag => blockTags.has(tag), looksLikeSource };
})(globalThis);
