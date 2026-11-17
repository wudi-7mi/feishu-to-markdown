"use strict";

const assert = require("node:assert/strict");
const { setTimeout: delay } = require("node:timers/promises");

module.exports = async function testExtensionToggle(source, options, tab, openPopup, waitFor) {
  const probe = func => options.evaluate("chrome.scripting.executeScript({target:{tabId:" + tab.id
    + "},func:" + func.toString() + "}).then(results=>results[0].result)");
  const before = await source.evaluate("performance.timeOrigin");
  await source.evaluate(`window.__liveCopyKeys=0;window.__liveCopyListener=event=>{
    if(event.ctrlKey&&event.key==='c'){window.__liveCopyKeys++;event.stopImmediatePropagation();}
  };document.addEventListener('keydown',window.__liveCopyListener,true);`);
  await probe(() => {
    globalThis.__liveWrites = [];
    globalThis.__liveReads = 0;
    globalThis.__liveClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      read: async () => {
        globalThis.__liveReads++;
        return [new ClipboardItem({
          "text/plain": new Blob(["即时复制"], { type: "text/plain" }),
          "text/html": new Blob(["<h2>即时复制</h2>"], { type: "text/html" })
        })];
      },
      write: async items => globalThis.__liveWrites.push(await (await items[0].getType("text/plain")).text()),
      writeText: async text => globalThis.__liveWrites.push(text)
    } });
  });
  let popup;
  const copy = async () => {
    await source.evaluate("document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'c',ctrlKey:true,bubbles:true,cancelable:true}))");
    await delay(250);
    return probe(() => ({ writes: globalThis.__liveWrites.slice(), reads: globalThis.__liveReads }));
  };
  try {
    assert.equal(await probe(() => Boolean(globalThis.__feishuMarkdownContentState)), false, "The existing disabled page starts without conversion scripts");
    assert.equal((await copy()).reads, 0);
    popup = await openPopup();
    assert.equal(await popup.evaluate("document.getElementById('replace-copy').checked"), false);
    await popup.evaluate("document.getElementById('replace-copy').click()");
    await waitFor(() => probe(() => Boolean(globalThis.__feishuMarkdownContentState)));
    let result = await copy();
    assert.deepEqual(result.writes, ["## 即时复制"], "The real toolbar switch must activate the already-open page");
    const reads = result.reads;
    await popup.evaluate("document.getElementById('replace-copy').click()");
    await waitFor(() => options.evaluate("chrome.storage.sync.get('replaceCtrlC').then(s=>s.replaceCtrlC===false)"));
    result = await copy();
    assert.equal(result.reads, reads);
    await popup.evaluate("document.getElementById('replace-copy').click()");
    await waitFor(() => options.evaluate("chrome.storage.sync.get('replaceCtrlC').then(s=>s.replaceCtrlC===true)"));
    result = await copy();
    assert.deepEqual(result.writes, ["## 即时复制", "## 即时复制"], "Re-enabling must not install duplicate handlers");
    assert.equal(await source.evaluate("performance.timeOrigin"), before, "Switching must not reload the document");
    assert.equal(await source.evaluate("__liveCopyKeys"), 4);
    console.log("Real MV3 live activation: pre-existing disabled page, toolbar enable/disable/re-enable, exactly one copy, no reload");
  } finally {
    await options.evaluate("chrome.storage.sync.set({replaceCtrlC:true,convertMarkdownPaste:true})");
    await probe(() => {
      if (globalThis.__liveClipboardDescriptor) Object.defineProperty(navigator, "clipboard", globalThis.__liveClipboardDescriptor);
      else delete navigator.clipboard;
    });
    await source.evaluate("document.removeEventListener('keydown',__liveCopyListener,true)");
    if (popup) { await popup.evaluate("window.close()"); popup.close(); }
  }
};
