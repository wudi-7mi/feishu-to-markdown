const SCRIPT_ID = "feishu-to-markdown-custom-domains";
const DEFAULT_DOMAINS = new Set(["feishu.cn", "feishuapp.cn", "larksuite.com"]);
let syncQueue = Promise.resolve();

function normalizeDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^\*\./, "")
    .replace(/\.$/, "");
}

function domainPatterns(domain) {
  const normalized = normalizeDomain(domain);
  return ["*://" + normalized + "/*", "*://*." + normalized + "/*"];
}

async function syncCustomDomainScripts() {
  const { domains = [...DEFAULT_DOMAINS] } = await chrome.storage.sync.get({ domains: [...DEFAULT_DOMAINS] });
  const candidates = domains
    .map(normalizeDomain)
    .filter((domain) => domain && !DEFAULT_DOMAINS.has(domain))
    .flatMap(domainPatterns);
  const uniqueCandidates = [...new Set(candidates)];
  const granted = await Promise.all(uniqueCandidates.map((pattern) => chrome.permissions.contains({ origins: [pattern] })));
  const matches = uniqueCandidates.filter((_, index) => granted[index]).sort();
  const [existing] = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });

  if (!matches.length) {
    if (existing) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    return;
  }

  const existingMatches = [...(existing?.matches || [])].sort();
  const registrationUnchanged = existing
    && JSON.stringify(existingMatches) === JSON.stringify(matches)
    && JSON.stringify(existing.js || []) === JSON.stringify(["converter.js", "content.js"])
    && existing.runAt === "document_idle"
    && existing.allFrames === true;
  if (registrationUnchanged) return;

  if (existing) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  await chrome.scripting.registerContentScripts([{
    id: SCRIPT_ID,
    matches: [...new Set(matches)],
    js: ["converter.js", "content.js"],
    runAt: "document_idle",
    allFrames: true,
    persistAcrossSessions: true
  }]);
}

function scheduleSync() {
  syncQueue = syncQueue
    .catch(() => undefined)
    .then(syncCustomDomainScripts)
    .catch((error) => console.error("[Feishu MD][background] script sync failed", error));
}

chrome.runtime.onInstalled.addListener(scheduleSync);
chrome.runtime.onStartup.addListener(scheduleSync);
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.domains) scheduleSync();
});
chrome.permissions.onAdded.addListener(scheduleSync);
chrome.permissions.onRemoved.addListener(scheduleSync);
