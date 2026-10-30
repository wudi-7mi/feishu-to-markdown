(function () {
  "use strict";
  const LOG_PREFIX = "[Feishu MD][content]";
  const DEFAULT_DOMAINS = ["feishu.cn", "feishuapp.cn", "larksuite.com"];
  const DEBUG = false;
  let shortcutEnabled = false;
  let markdownPasteEnabled = false;
  let listenerAttached = false;
  let copyInFlight = false;

  function debugLog(...args) {
    if (DEBUG) console.info(LOG_PREFIX, ...args);
  }

  function debugWarn(...args) {
    if (DEBUG) console.warn(LOG_PREFIX, ...args);
  }

  function normalizeDomain(value) {
    return String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^\*\./, "");
  }

  function matchesDomain(hostname, pattern) {
    const suffix = normalizeDomain(pattern);
    return Boolean(suffix) && (hostname === suffix || hostname.endsWith("." + suffix));
  }

  function selectionHtml() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
    const container = document.createElement("div");
    for (let index = 0; index < selection.rangeCount; index += 1) {
      container.appendChild(selection.getRangeAt(index).cloneContents());
    }
    return { html: container.innerHTML, text: selection.toString().trim() };
  }

  async function writeClipboard(markdown, html) {
    if (html && globalThis.ClipboardItem && navigator.clipboard.write) {
      try {
        const item = new ClipboardItem({
          "text/plain": new Blob([markdown], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" })
        });
        await navigator.clipboard.write([item]);
        debugLog("rich clipboard write succeeded", {
          markdownCharacters: markdown.length,
          htmlCharacters: html.length
        });
        return true;
      } catch (error) {
        debugWarn("rich clipboard write failed, falling back to plain text", error);
      }
    }

    try {
      await navigator.clipboard.writeText(markdown);
      debugLog("plain clipboard write succeeded with navigator.clipboard", { characters: markdown.length });
      return true;
    } catch (error) {
      debugWarn("navigator.clipboard failed, trying execCommand", error);
      const textarea = document.createElement("textarea");
      textarea.value = markdown;
      textarea.setAttribute("readonly", "");
      Object.assign(textarea.style, { position: "fixed", left: "-9999px", top: "0", opacity: "0" });
      document.documentElement.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      debugLog("execCommand copy result", { copied, characters: markdown.length });
      return copied;
    }
  }

  function normalizedClipboardText(text) {
    return String(text || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function matchesSelection(plainText, fallbackSelection) {
    if (!fallbackSelection?.text) return true;
    return normalizedClipboardText(plainText) === normalizedClipboardText(fallbackSelection.text);
  }

  async function readClipboardPayload(fallbackSelection) {
    let htmlCandidate = fallbackSelection?.html || "";
    let markdownCandidate = htmlCandidate
      ? globalThis.FeishuMarkdownConverter.fromHtml(htmlCandidate)
      : "";
    let plainTextCandidate = "";
    const retryTimes = [50, 70, 160];
    const startedAt = performance.now();

    retryLoop: for (const retryTime of retryTimes) {
      const wait = Math.max(0, retryTime - (performance.now() - startedAt));
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      try {
        const items = await navigator.clipboard.read();
        let clipboardHtml = "";
        let clipboardText = "";

        for (const item of items) {
          if (item.types.includes("text/html")) {
            clipboardHtml = await (await item.getType("text/html")).text();
          }
          if (item.types.includes("text/plain")) {
            clipboardText = (await (await item.getType("text/plain")).text()).trim();
          }
        }

        // A read started around keydown may still return the previous clipboard.
        // Only replace a captured DOM selection when the plain text confirms
        // that this clipboard value belongs to the current copy action.
        if (!matchesSelection(clipboardText, fallbackSelection)) continue;
        if (clipboardText) plainTextCandidate = clipboardText;
        if (clipboardHtml) {
          const markdown = globalThis.FeishuMarkdownConverter.fromHtml(clipboardHtml);
          if (markdown) {
            htmlCandidate = clipboardHtml;
            markdownCandidate = markdown;
            debugLog("rich clipboard candidate captured", {
              htmlCharacters: clipboardHtml.length,
              markdownCharacters: markdown.length,
              attempt: retryTimes.indexOf(retryTime) + 1
            });
            if (fallbackSelection?.text) break retryLoop;
          }
        }
      } catch (error) {
        debugWarn("reading clipboard after Ctrl+C failed", { attempt: retryTimes.indexOf(retryTime) + 1, error });
      }
    }

    return {
      markdown: markdownCandidate || plainTextCandidate || fallbackSelection?.text || "",
      html: htmlCandidate
    };
  }

  async function replaceCtrlCCopy(fallbackSelection) {
    try {
      const { markdown, html } = await readClipboardPayload(fallbackSelection);
      if (!markdown) {
        showToast("飞书复制尚未完成，请再按一次 Ctrl+C", "error");
        return;
      }
      const copied = await writeClipboard(markdown, html);
      showToast(copied ? "已复制为 Markdown" : "复制为 Markdown 失败", copied ? "success" : "error");
    } finally {
      copyInFlight = false;
    }
  }

  function handleKeydown(event) {
    if (event.repeat || event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "c") return;
    if (!shortcutEnabled || copyInFlight) return;
    copyInFlight = true;
    debugLog("Ctrl+C detected");
    const fallbackSelection = selectionHtml();
    replaceCtrlCCopy(fallbackSelection);
  }

  function looksLikeMarkdown(text) {
    const value = String(text || "").trim();
    if (!value) return false;
    return /^(?:\s{0,3}#{1,6}\s|\s*>\s?|\s*(?:[-*+] |\d+[.)] )|\s*```|\s*~~~|\s*(?:-{3,}|\*{3,}|_{3,})\s*$)/m.test(value)
      || /(?:\*\*[^*\n]+\*\*|~~[^~\n]+~~|`[^`\n]+`|!?\[[^\]]+\]\([^\s)]+\))/.test(value)
      || /(?:^|[^*])\*[^*\n]+\*(?!\*)|(?:^|[^_])_[^_\n]+_(?!_)/m.test(value)
      || /^\s*\|?.+\|.+\n\s*\|?\s*:?-{3,}/m.test(value);
  }

  function editableContainer(target) {
    if (!(target instanceof Element) || target.closest("input, textarea, [contenteditable='false']")) return null;
    return target.closest("[contenteditable='true'], [contenteditable='plaintext-only']");
  }

  function insertRichHtml(html, container) {
    if (document.execCommand("insertHTML", false, html)) return true;
    const selection = window.getSelection();
    if (!selection?.rangeCount || !container.contains(selection.anchorNode)) return false;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const fragment = range.createContextualFragment(html);
    const lastNode = fragment.lastChild;
    range.insertNode(fragment);
    if (lastNode) {
      range.setStartAfter(lastNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    container.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste", data: null }));
    return true;
  }

  function handlePaste(event) {
    if (!markdownPasteEnabled || event.defaultPrevented || !event.clipboardData) return;
    const container = editableContainer(event.target);
    if (!container) return;
    const explicitMarkdown = event.clipboardData.getData("text/markdown");
    const markdown = explicitMarkdown || event.clipboardData.getData("text/plain");
    if (!markdown || (!explicitMarkdown && event.clipboardData.getData("text/html")) || !looksLikeMarkdown(markdown)) return;
    const html = globalThis.FeishuMarkdownConverter.toHtml(markdown);
    if (!html || !insertRichHtml(html, container)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showToast("已粘贴为飞书格式", "success");
  }

  async function syncShortcut() {
    const { domains = DEFAULT_DOMAINS, replaceCtrlC = true, convertMarkdownPaste = true } = await chrome.storage.sync.get({
      domains: DEFAULT_DOMAINS,
      replaceCtrlC: true,
      convertMarkdownPaste: true
    });
    const domainEnabled = domains.some((domain) => matchesDomain(location.hostname.toLowerCase(), domain));
    shortcutEnabled = replaceCtrlC && domainEnabled;
    markdownPasteEnabled = convertMarkdownPaste && domainEnabled;

    if ((shortcutEnabled || markdownPasteEnabled) && !listenerAttached) {
      document.addEventListener("keydown", handleKeydown, true);
      document.addEventListener("paste", handlePaste, true);
      listenerAttached = true;
      debugLog("enabled on matching page", { hostname: location.hostname });
    } else if (!shortcutEnabled && !markdownPasteEnabled && listenerAttached) {
      document.removeEventListener("keydown", handleKeydown, true);
      document.removeEventListener("paste", handlePaste, true);
      listenerAttached = false;
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && (changes.domains || changes.replaceCtrlC || changes.convertMarkdownPaste)) syncShortcut();
  });

  syncShortcut();

  function showToast(message, tone) {
    document.getElementById("feishu-md-toast")?.remove();
    const toast = document.createElement("div");
    toast.id = "feishu-md-toast";
    toast.textContent = message;
    Object.assign(toast.style, {
      position: "fixed", left: "50%", bottom: "28px", zIndex: "2147483647",
      transform: "translateX(-50%)", padding: "9px 14px", borderRadius: "6px",
      background: tone === "error" ? "#b42318" : "#1f2329", color: "#fff",
      boxShadow: "0 4px 16px rgba(0,0,0,.2)", font: "13px/1.4 sans-serif"
    });
    (document.body || document.documentElement).appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

})();
