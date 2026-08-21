(function () {
  "use strict";
  const LOG_PREFIX = "[Feishu MD][content]";
  const DEFAULT_DOMAINS = ["feishu.cn", "feishuapp.cn", "larksuite.com"];
  const DEBUG = false;
  let shortcutEnabled = false;
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

  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      debugLog("clipboard write succeeded with navigator.clipboard", { characters: text.length });
      return true;
    } catch (error) {
      debugWarn("navigator.clipboard failed, trying execCommand", error);
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      Object.assign(textarea.style, { position: "fixed", left: "-9999px", top: "0", opacity: "0" });
      document.documentElement.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      debugLog("execCommand copy result", { copied, characters: text.length });
      return copied;
    }
  }

  async function readClipboardMarkdown(fallbackSelection) {
    const retryDelays = [0, 70, 160];
    let plainTextCandidate = "";
    for (const delay of retryDelays) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes("text/html")) {
            const html = await (await item.getType("text/html")).text();
            const markdown = globalThis.FeishuMarkdownConverter.fromHtml(html);
            if (markdown) {
              debugLog("rich clipboard converted", {
                htmlCharacters: html.length,
                markdownCharacters: markdown.length,
                attempt: retryDelays.indexOf(delay) + 1
              });
              return markdown;
            }
          }
        }
        for (const item of items) {
          if (item.types.includes("text/plain")) {
            const text = (await (await item.getType("text/plain")).text()).trim();
            if (text && !plainTextCandidate) plainTextCandidate = text;
          }
        }
      } catch (error) {
        debugWarn("reading clipboard after Ctrl+C failed", { attempt: retryDelays.indexOf(delay) + 1, error });
      }
    }
    if (fallbackSelection?.text) {
      return globalThis.FeishuMarkdownConverter.fromHtml(fallbackSelection.html) || fallbackSelection.text;
    }
    return plainTextCandidate;
  }

  async function replaceCtrlCCopy(fallbackSelection) {
    try {
      // Let the page's own copy handler populate rich clipboard formats before the first read.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const markdown = await readClipboardMarkdown(fallbackSelection);
      if (!markdown) {
        showToast("飞书复制尚未完成，请再按一次 Ctrl+C", "error");
        return;
      }
      const copied = await writeClipboard(markdown);
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

  async function syncShortcut() {
    const { domains = DEFAULT_DOMAINS, replaceCtrlC = true } = await chrome.storage.sync.get({
      domains: DEFAULT_DOMAINS,
      replaceCtrlC: true
    });
    const domainEnabled = domains.some((domain) => matchesDomain(location.hostname.toLowerCase(), domain));
    shortcutEnabled = replaceCtrlC && domainEnabled;

    if (shortcutEnabled && !listenerAttached) {
      document.addEventListener("keydown", handleKeydown, true);
      listenerAttached = true;
      debugLog("enabled on matching page", { hostname: location.hostname });
    } else if (!shortcutEnabled && listenerAttached) {
      document.removeEventListener("keydown", handleKeydown, true);
      listenerAttached = false;
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && (changes.domains || changes.replaceCtrlC)) syncShortcut();
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
