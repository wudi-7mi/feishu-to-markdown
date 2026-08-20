const DEFAULT_DOMAINS = ["feishu.cn", "feishuapp.cn", "larksuite.com"];
const domainsInput = document.getElementById("domains");
const replaceCopyInput = document.getElementById("replace-copy");
const message = document.getElementById("message");
const permissionRow = document.getElementById("permission-row");
const permissionText = document.getElementById("permission-text");
const grantButton = document.getElementById("grant");
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

function permissionPattern(domain) {
  return "*://*." + normalizeDomain(domain).replace(/^\*\./, "") + "/*";
}

function customPatterns(domains) {
  return domains
    .map((domain) => normalizeDomain(domain).replace(/^\*\./, ""))
    .filter((domain) => domain && !DEFAULT_DOMAINS.includes(domain))
    .map(permissionPattern);
}

async function missingPatterns(domains) {
  const missing = [];
  for (const pattern of customPatterns(domains)) {
    if (!await chrome.permissions.contains({ origins: [pattern] })) missing.push(pattern);
  }
  return missing;
}

async function updatePermissionState() {
  const domains = readDomains();
  if (validate(domains)) {
    permissionRow.classList.add("hidden");
    return;
  }
  const missing = await missingPatterns(domains);
  permissionRow.classList.toggle("hidden", missing.length === 0);
  permissionText.textContent = missing.length === 1
    ? "新增的自定义域名需要授权后才能生效。"
    : missing.length + " 个自定义域名需要授权后才能生效。";
  grantButton.textContent = missing.length > 1 ? "授权这些域名" : "授权域名";
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
}

async function load() {
  const { domains = DEFAULT_DOMAINS, replaceCtrlC = true } = await chrome.storage.sync.get({
    domains: DEFAULT_DOMAINS,
    replaceCtrlC: true
  });
  domainsInput.value = domains.join("\n");
  replaceCopyInput.checked = replaceCtrlC;
  await updatePermissionState();
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
});

load();
