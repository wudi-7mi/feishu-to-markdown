"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

module.exports = async function testLiveToggle(client, frameId) {
  const contextId = (await client.send("Page.createIsolatedWorld", {
    frameId, worldName: "live-toggle-fixture"
  })).executionContextId;
  await client.evaluate(fs.readFileSync(path.join(__dirname, "..", "converter.js"), "utf8"), contextId);
  const content = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
  await client.evaluate(`(() => {
    const target = document.createElement('div'); target.id = 'toggle-target';
    target.contentEditable = 'true'; target.textContent = '原生复制内容'; document.body.appendChild(target);
    window.__nativeCopyKeys = 0;
    window.__nativeCopyKeyListener = event => {
      if (event.target === target && event.ctrlKey && event.key === 'c') {
        window.__nativeCopyKeys++; event.stopImmediatePropagation();
      }
    };
    document.addEventListener('keydown', window.__nativeCopyKeyListener, true);
    window.__triggerToggleCopy = () => target.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'c', ctrlKey: true, bubbles: true, cancelable: true
    }));
  })()`);
  await client.evaluate(`window.__toggleSettings = {domains:['127.0.0.1'],replaceCtrlC:false,convertMarkdownPaste:false};
    window.__toggleListeners = new Set(); window.__toggleWrites = []; window.__toggleReads = 0;
    window.__holdToggleRead = false; window.__resolveToggleRead = null;
    window.chrome = {storage:{sync:{get: async defaults => {
      const snapshot = {...defaults,...window.__toggleSettings};
      if (window.__holdToggleRead) {
        window.__holdToggleRead = false;
        return new Promise(resolve => {window.__resolveToggleRead = () => resolve(snapshot);});
      }
      return snapshot;
    }},onChanged:{addListener:listener=>window.__toggleListeners.add(listener),removeListener:listener=>window.__toggleListeners.delete(listener)}},
      runtime:{getManifest:()=>({version:'fixture'})}};
    window.__toggleSettingsChanged = async values => {
      Object.assign(window.__toggleSettings, values);
      for (const listener of window.__toggleListeners) listener(Object.fromEntries(Object.keys(values).map(key=>[key,{}])), 'sync');
      await Promise.resolve(); await Promise.resolve();
    };
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
      read:async()=>{window.__toggleReads++;return [new ClipboardItem({
        'text/plain':new Blob(['原生复制内容'],{type:'text/plain'}),
        'text/html':new Blob(['<h2>原生复制内容</h2>'],{type:'text/html'})
      })];},
      write:async items=>window.__toggleWrites.push(await(await items[0].getType('text/plain')).text()),
      writeText:async value=>window.__toggleWrites.push(value)
    }});`, contextId);
  const configure = values => client.evaluate("__toggleSettingsChanged(" + JSON.stringify(values) + ")", contextId);
  const copy = async () => {
    await client.evaluate("__triggerToggleCopy()");
    await delay(250);
    return client.evaluate("({writes:__toggleWrites.slice(),reads:__toggleReads})", contextId);
  };
  try {
    await client.evaluate(content, contextId);
    await client.evaluate("Promise.resolve()", contextId);
    let result = await copy();
    assert.equal(result.reads, 0, "Disabled pages must not read the clipboard");
    await configure({ replaceCtrlC: true });
    result = await copy();
    assert.deepEqual(result.writes, ["## 原生复制内容"], "Enabling on an already-open page must work before native document handlers without reloading");

    await configure({ replaceCtrlC: false });
    const disabledReads = result.reads;
    result = await copy();
    assert.equal(result.reads, disabledReads, "Turning off must take effect immediately");
    await configure({ replaceCtrlC: true });
    await client.evaluate(content, contextId);
    await client.evaluate(content, contextId);
    result = await copy();
    assert.deepEqual(result.writes, ["## 原生复制内容", "## 原生复制内容"], "Repeated script injection must not duplicate copy handlers");
    assert.equal(await client.evaluate("__toggleListeners.size", contextId), 1);

    // Let an earlier disabled-settings read finish after a newer enable event.
    await configure({ replaceCtrlC: false });
    await client.evaluate("__holdToggleRead=true; for(const listener of __toggleListeners) listener({replaceCtrlC:{}},'sync')", contextId);
    await configure({ replaceCtrlC: true });
    await client.evaluate("__resolveToggleRead(); Promise.resolve()", contextId);
    result = await copy();
    assert.equal(result.writes.length, 3, "A stale settings read must not undo the latest enable event");
    const readsBeforeDisable = result.reads;
    await client.evaluate("__triggerToggleCopy()");
    await configure({ replaceCtrlC: false });
    await delay(250);
    assert.equal(await client.evaluate("__toggleWrites.length", contextId), 3, "Disabling must cancel a pending conversion before it writes");
    assert.equal(await client.evaluate("__toggleReads", contextId), readsBeforeDisable, "A pending retry must not read after disabling");
    assert.equal(await client.evaluate("__nativeCopyKeys"), 6, "Native copy key handlers must still receive every key");
    console.log("Live toggle: disabled page -> enable -> copy, disable/re-enable, native capture listeners, duplicate injection and settings race passed");
  } finally {
    await configure({ replaceCtrlC: false, convertMarkdownPaste: false });
    await client.evaluate("document.removeEventListener('keydown',__nativeCopyKeyListener,true);document.getElementById('toggle-target').remove();document.getElementById('feishu-md-toast')?.remove()");
  }
};
