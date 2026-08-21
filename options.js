const DEFAULT_DOMAINS = ["feishu.cn", "feishuapp.cn", "larksuite.com"];
const domainsInput = document.getElementById("domains");
const replaceCopyInput = document.getElementById("replace-copy");
const message = document.getElementById("message");
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
  let hostname = "";
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    hostname = new URL(tab?.url || "").hostname.toLowerCase();
  } catch (_) {
    hostname = "";
  }
  const inRange = hostname && domains.some((domain) => matchesDomain(hostname, domain));
  domainStatus.textContent = inRange ? "已生效" : "不在范围";
  domainStatus.classList.toggle("in-range", Boolean(inRange));
  domainStatus.classList.toggle("out-of-range", !inRange);
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
  const { domains = DEFAULT_DOMAINS, replaceCtrlC = true } = await chrome.storage.sync.get({
    domains: DEFAULT_DOMAINS,
    replaceCtrlC: true
  });
  domainsInput.value = domains.join("\n");
  replaceCopyInput.checked = replaceCtrlC;
  version.textContent = "版本 " + chrome.runtime.getManifest().version;
  updateFeatureStatus();
  await updatePermissionState();
  await updateDomainStatus(domains);
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
  await chrome.storage.sync.set({ domains: DEFAULT_DOMAINS, replaceCtrlC: true });
  showMessage("已恢复并保存默认设置");
  await updatePermissionState();
  await updateDomainStatus(DEFAULT_DOMAINS);
});

load();
chrome.tabs.onActivated.addListener(() => updateDomainStatus());
