const DEFAULT_DOMAINS = ["feishu.cn", "feishuapp.cn", "larksuite.com"];
const domainsInput = document.getElementById("domains");
const replaceCopyInput = document.getElementById("replace-copy");
const markdownPasteInput = document.getElementById("markdown-paste");
const message = document.getElementById("message");
const clipboardMessage = document.getElementById("clipboard-message");
const convertClipboardButton = document.getElementById("convert-clipboard");
const exportDocumentButton = document.getElementById("export-document");
const exportMessage = document.getElementById("export-message");
const grantButton = document.getElementById("grant");
const featureStatus = document.getElementById("feature-status");
const version = document.getElementById("version");
const domainStatus = document.getElementById("domain-status");
let saveTimer = null;

function normalizeDomain(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

function readDomains() {
  return [...new Set(domainsInput.value.split(/\r?\n/).map(normalizeDomain).filter(Boolean))];
}

function validate(domains) {
  const invalid = domains.find((domain) => !/^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(domain));
  return invalid ? "无效域名：" + invalid : "";
}

function matchesDomain(hostname, domain) {
  const normalized = normalizeDomain(domain).replace(/^\*\./, "");
  return Boolean(normalized) && (hostname === normalized || hostname.endsWith("." + normalized));
}

function permissionPatterns(domain) {
  const normalized = normalizeDomain(domain).replace(/^\*\./, "");
  return ["*://" + normalized + "/*", "*://*." + normalized + "/*"];
}

function customPatterns(domains) {
  return [...new Set(domains
    .map((domain) => normalizeDomain(domain).replace(/^\*\./, ""))
    .filter((domain) => domain && !DEFAULT_DOMAINS.includes(domain))
    .flatMap(permissionPatterns))];
}

async function missingPatterns(domains) {
  const patterns = customPatterns(domains);
  const granted = await Promise.all(patterns.map((pattern) => chrome.permissions.contains({ origins: [pattern] })));
  return patterns.filter((_, index) => !granted[index]);
}

async function updatePermissionState() {
  const domains = readDomains();
  const invalid = validate(domains);
  if (invalid) {
    grantButton.disabled = true;
    return;
  }
  const missing = await missingPatterns(domains);
  grantButton.disabled = missing.length === 0;
}

async function updateDomainStatus(domains = readDomains()) {
  let pageUrl = null;
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (/^https?:\/\//.test(activeTab?.url || "")) pageUrl = new URL(activeTab.url);
  } catch (_) {
    pageUrl = null;
  }

  let state = "unknown";
  let label = "无法判断";
  if (pageUrl) {
    const hostname = pageUrl.hostname.toLowerCase();
    const configured = domains.some((domain) => matchesDomain(hostname, domain));
    if (!configured) {
      state = "out-of-range";
      label = "不在范围";
    } else {
      const origin = pageUrl.protocol + "//" + hostname + "/*";
      const authorized = await chrome.permissions.contains({ origins: [origin] });
      state = authorized ? "in-range" : "out-of-range";
      label = authorized ? "已生效" : "未授权";
    }
  }

  domainStatus.textContent = label;
  domainStatus.classList.toggle("in-range", state === "in-range");
  domainStatus.classList.toggle("out-of-range", state === "out-of-range");
  domainStatus.classList.toggle("unknown", state === "unknown");
}

function showMessage(text, error = false) {
  message.textContent = text;
  message.classList.toggle("error", error);
  if (text && !error) setTimeout(() => { if (message.textContent === text) message.textContent = ""; }, 2200);
}

async function saveDomains() {
  const domains = readDomains();
  const error = validate(domains);
  domainsInput.classList.toggle("invalid", Boolean(error));
  domainsInput.setAttribute("aria-invalid", String(Boolean(error)));
  if (error) return showMessage(error, true);
  const { domains: previousDomains = DEFAULT_DOMAINS } = await chrome.storage.sync.get({ domains: DEFAULT_DOMAINS });
  const desiredPatterns = new Set(customPatterns(domains));
  const removedPatterns = customPatterns(previousDomains).filter((pattern) => !desiredPatterns.has(pattern));
  if (removedPatterns.length) await chrome.permissions.remove({ origins: removedPatterns });
  await chrome.storage.sync.set({ domains });
  showMessage(domains.length ? "已自动保存" : "已自动保存，所有域名均已关闭");
  await updatePermissionState();
  await updateDomainStatus(domains);
}

async function load() {
  version.textContent = "版本 " + chrome.runtime.getManifest().version;
  const { domains = DEFAULT_DOMAINS, replaceCtrlC = true, convertMarkdownPaste = true } = await chrome.storage.sync.get({
    domains: DEFAULT_DOMAINS,
    replaceCtrlC: true,
    convertMarkdownPaste: true
  });
  domainsInput.value = domains.join("\n");
  replaceCopyInput.checked = replaceCtrlC;
  markdownPasteInput.checked = convertMarkdownPaste;
  updateFeatureStatus();
  await Promise.all([
    updatePermissionState(),
    updateDomainStatus(domains)
  ]);
}

function updateFeatureStatus() {
  const enabled = replaceCopyInput.checked;
  featureStatus.textContent = enabled ? "已开启" : "已关闭";
  featureStatus.classList.toggle("off", !enabled);
}

domainsInput.addEventListener("input", () => {
  clearTimeout(saveTimer);
  showMessage("等待输入完成...");
  saveTimer = setTimeout(saveDomains, 500);
});

domainsInput.addEventListener("blur", () => {
  clearTimeout(saveTimer);
  saveDomains().then(() => {
    if (domainsInput.getAttribute("aria-invalid") === "false") domainsInput.value = readDomains().join("\n");
  });
});

replaceCopyInput.addEventListener("change", async () => {
  updateFeatureStatus();
  await chrome.storage.sync.set({ replaceCtrlC: replaceCopyInput.checked });
  showMessage(replaceCopyInput.checked ? "插件功能已开启" : "插件功能已关闭");
});

markdownPasteInput.addEventListener("change", async () => {
  await chrome.storage.sync.set({ convertMarkdownPaste: markdownPasteInput.checked });
  showMessage(markdownPasteInput.checked ? "Markdown 粘贴转换已开启" : "Markdown 粘贴转换已关闭");
});

async function writeRichClipboard(markdown, html) {
  if (globalThis.ClipboardItem && navigator.clipboard.write) {
    await navigator.clipboard.write([new ClipboardItem({
      "text/plain": new Blob([markdown], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" })
    })]);
    return true;
  }
  const preview = document.createElement("div");
  preview.contentEditable = "true";
  preview.innerHTML = html;
  Object.assign(preview.style, { position: "fixed", left: "-9999px", top: "0" });
  document.body.appendChild(preview);
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(preview);
  selection.removeAllRanges();
  selection.addRange(range);
  const copied = document.execCommand("copy");
  selection.removeAllRanges();
  preview.remove();
  return copied;
}

convertClipboardButton.addEventListener("click", async () => {
  clipboardMessage.classList.remove("error");
  try {
    const markdown = await navigator.clipboard.readText();
    if (!markdown.trim()) throw new Error("剪贴板中没有文本");
    const html = globalThis.FeishuMarkdownConverter.toClipboardHtml(markdown);
    if (!html) throw new Error("没有可转换的 Markdown 内容");
    if (!await writeRichClipboard(markdown, html)) throw new Error("浏览器拒绝写入剪贴板");
    clipboardMessage.textContent = "已转换，可回到飞书文档直接粘贴";
  } catch (error) {
    clipboardMessage.textContent = error.message || "转换剪贴板失败";
    clipboardMessage.classList.add("error");
  }
});

exportDocumentButton.addEventListener("click", async () => {
  exportDocumentButton.disabled = true;
  exportMessage.textContent = "";
  exportMessage.classList.remove("error");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab?.url || "");
    if (!/^https?:$/.test(url.protocol) || !/^\/(docx|wiki)\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)) {
      throw new Error("请先切换到一篇飞书新版文档或知识库文档，再打开扩展");
    }
    const query = new URLSearchParams({ tab: String(tab.id), url: url.origin + url.pathname });
    await chrome.tabs.create({ url: chrome.runtime.getURL("export.html?") + query, openerTabId: tab.id });
  } catch (error) {
    exportMessage.textContent = error.message;
    exportMessage.classList.add("error");
  } finally { exportDocumentButton.disabled = false; }
});

grantButton.addEventListener("click", async () => {
  const domains = readDomains();
  const origins = await missingPatterns(domains);
  if (!origins.length) return updatePermissionState();
  try {
    const granted = await chrome.permissions.request({ origins });
    showMessage(granted ? "域名权限已授予" : "未授予域名权限", !granted);
    await updatePermissionState();
    await updateDomainStatus();
  } catch (error) {
    showMessage("授权失败：" + error.message, true);
  }
});

document.getElementById("reset").addEventListener("click", async () => {
  clearTimeout(saveTimer);
  const { domains: previousDomains = DEFAULT_DOMAINS } = await chrome.storage.sync.get({ domains: DEFAULT_DOMAINS });
  const customOrigins = customPatterns(previousDomains);
  if (customOrigins.length) await chrome.permissions.remove({ origins: customOrigins });
  domainsInput.value = DEFAULT_DOMAINS.join("\n");
  domainsInput.classList.remove("invalid");
  domainsInput.setAttribute("aria-invalid", "false");
  replaceCopyInput.checked = true;
  markdownPasteInput.checked = true;
  await chrome.storage.sync.set({ domains: DEFAULT_DOMAINS, replaceCtrlC: true, convertMarkdownPaste: true });
  showMessage("已恢复并保存默认设置");
  await updatePermissionState();
  await updateDomainStatus(DEFAULT_DOMAINS);
});

load();
chrome.tabs.onActivated.addListener(() => updateDomainStatus());
