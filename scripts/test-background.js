"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");

async function fixture(overrides = {}, failTab = null) {
  const settings = { domains: ["corp.example", "blocked.example"], replaceCtrlC: false, convertMarkdownPaste: false, ...overrides };
  const allowed = new Set(["*://corp.example/*", "*://*.corp.example/*", "https://corp.example/*", "https://*.corp.example/*", "https://docs.corp.example/*", "https://unrelated.example/*"]);
  const injections = [], queries = [], errors = [];
  let registered = [];
  const event = () => ({ listeners: [], addListener(listener) { this.listeners.push(listener); } });
  const chrome = {
    runtime: { onInstalled: event(), onStartup: event() },
    storage: { sync: { get: async defaults => ({ ...defaults, ...settings }) }, onChanged: event() },
    permissions: { contains: async ({ origins }) => allowed.has(origins[0]), onAdded: event(), onRemoved: event() },
    tabs: { query: async query => {
      queries.push(query);
      // Return unrelated tabs too: activation must re-check scope itself.
      return [{ id: 1, url: "https://docs.corp.example/docx/a" }, { id: 2, url: "https://unrelated.example/docx/b" },
        { id: 3, url: "https://blocked.example/docx/c" }, { id: 4, url: "chrome://extensions" },
        { id: 5 }, { id: 6, url: "http://docs.corp.example/docx/d" }, { id: 7, url: "https://corp.example/docx/e" }];
    } },
    scripting: {
      getRegisteredContentScripts: async () => registered,
      registerContentScripts: async scripts => { registered = scripts; },
      unregisterContentScripts: async () => { registered = []; },
      executeScript: async request => {
        injections.push(JSON.parse(JSON.stringify(request)));
        if (request.target.tabId === failTab) throw new Error("Tab closed during activation");
        return [];
      }
    }
  };
  const context = vm.createContext({ chrome, URL, console: { error: (...args) => errors.push(args) } });
  vm.runInContext(source, context);
  const drain = () => vm.runInContext("syncQueue", context);
  await drain();
  const change = async values => {
    Object.assign(settings, values);
    for (const listener of chrome.storage.onChanged.listeners) listener(Object.fromEntries(Object.keys(values).map(key => [key, {}])), "sync");
    await drain();
  };
  return { settings, allowed, injections, queries, errors, chrome, drain, change };
}

test("opening with features disabled does not activate existing tabs", async () => {
  const state = await fixture();
  assert.equal(state.queries.length, 0);
  assert.equal(state.injections.length, 0);
  assert.equal(state.errors.length, 0);
});

test("enabling copy activates only configured and authorized existing pages", async () => {
  const state = await fixture();
  await state.change({ replaceCtrlC: true });
  assert.deepEqual(state.injections.map(request => request.target.tabId), [1, 7]);
  for (const request of state.injections) {
    assert.deepEqual(request.files, ["vendor/katex.min.js", "rich-html.js", "converter.js", "content.js"]);
    assert.equal(request.target.allFrames, true);
    assert.equal(request.func, undefined);
  }
  assert.equal(state.errors.length, 0);
});

test("enabling paste also activates existing pages, disabling both stops activation", async () => {
  const state = await fixture();
  await state.change({ convertMarkdownPaste: true });
  assert.equal(state.injections.length, 2);
  await state.change({ convertMarkdownPaste: false });
  assert.equal(state.injections.length, 2);
  assert.equal(state.queries.length, 1);
});

test("background startup activates existing pages when features are already enabled", async () => {
  const state = await fixture({ replaceCtrlC: true });
  assert.deepEqual(state.injections.map(request => request.target.tabId), [1, 7]);
});

test("one closing tab does not prevent other pages from activating", async () => {
  const state = await fixture({ replaceCtrlC: true }, 7);
  assert.deepEqual(state.injections.map(request => request.target.tabId), [1, 7]);
  assert.equal(state.errors.length, 0);
});

test("permission changes activate newly authorized configured pages", async () => {
  const state = await fixture({ replaceCtrlC: true });
  state.allowed.add("https://blocked.example/*");
  for (const listener of state.chrome.permissions.onAdded.listeners) listener();
  await state.drain();
  assert.deepEqual(state.injections.slice(2).map(request => request.target.tabId), [1, 3, 7]);
});
