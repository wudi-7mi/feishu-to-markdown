"use strict";

const assert = require("node:assert/strict");

module.exports = async function testUnavailableContent(client, contextId) {
  const convert = html => client.evaluate('FeishuMarkdownConverter.fromHtml(' + JSON.stringify(html) + ')', contextId);
  const unavailable = '暂时无法在飞书文档外展示此内容';
  const marker = label => '[' + label + '：暂不支持转换为 Markdown，请在飞书原文中查看]';
  const unknown = '[未识别的飞书内容块：剪贴板未提供类型，请在飞书原文中查看]';

  // The actual copied sample has data-type="whiteboard" and a placeholder
  // span. Enterprise deployments can replace the product name in its message.
  const sample = '<h3>前文</h3><div data-type="whiteboard" class="old-record-id-synthetic">'
    + '<span class="block-paste-placeholder">暂时无法在企业文档外展示此内容</span></div><p>后文</p>';
  assert.equal(await convert(sample), '### 前文\n\n' + marker('画板') + '\n\n后文');
  assert.equal(await convert('<div data-type="whiteboard"><span>' + unavailable + '</span></div>'), marker('画板'),
    'A board must not be guessed to be a mind map without a subtype');

  // The remaining semantic type hints are synthetic compatibility fixtures;
  // opaque/numeric IDs and the document's surrounding prose are never types.
  for (const [type, label] of [['mindnote','思维导图'],['mind-map','思维导图'],['board','画板'],
    ['diagram','流程图/图表'],['sheet','电子表格'],['bitable','多维表格'],['file','附件'],
    ['video','视频'],['audio','音频'],['widget','文档小组件'],['synced_block','同步块'],['poll','投票']]) {
    assert.equal(await convert('<div data-type="' + type + '"><span>' + unavailable + '</span></div>'), marker(label));
  }
  assert.equal(await convert('<div data-block-type="mindnote"></div>'), marker('思维导图'));
  assert.equal(await convert('<div class="whiteboard-block">' + unavailable + '</div>'), marker('画板'));
  assert.equal(await convert('<div aria-label="思维导图">' + unavailable + '</div>'), marker('思维导图'));
  assert.equal(await convert('<p>' + unavailable + '</p>'), unknown);
  assert.equal(await convert(unavailable), unknown);
  assert.equal(await convert('<div data-block-type="43">' + unavailable + '</div>'), unknown,
    'Clipboard numeric identifiers must not be interpreted as server API block types');
  assert.equal(await convert('<p>思维导图</p><div>' + unavailable + '</div><div data-type="board">' + unavailable + '</div>'),
    '思维导图\n\n' + unknown + '\n\n' + marker('画板'), 'Do not borrow a type from neighboring text or blocks');
  assert.equal(await convert('<p>示例：' + unavailable + '</p>'), '示例：' + unavailable);
  assert.equal(await convert('<pre><code>' + unavailable + '</code></pre>'), '```\n' + unavailable + '\n```');
  assert.equal(await convert('<div data-type="board"><span>暂时无法在飞书</span><span>文档外展示此内容</span></div>'), marker('画板'));

  const preview = '<div data-type="board"><img src="https://example.invalid/preview.png" alt="预览"></div>';
  assert.equal(await convert(preview), '![预览](https://example.invalid/preview.png)', 'Keep an existing preview image');
  assert.equal(await convert('<div data-type="board"><a href="https://example.invalid/original">' + unavailable + '</a></div>'),
    '[' + marker('画板') + '](https://example.invalid/original)', 'Retain an original link already present in the copy');
  assert.equal(await convert('<video><a href="https://example.invalid/video">原视频</a></video>'),
    marker('视频') + ' [原视频](https://example.invalid/video)');
  assert.equal(await convert('<iframe title="画板"></iframe>'), marker('画板'));
  assert.equal(await convert('<audio></audio>'), marker('音频'));

  const inTable = await convert('<table><tr><th>内容</th><th>说明</th></tr><tr><td><div data-type="board">' + unavailable
    + '</div></td><td>保留正文</td></tr></table>');
  assert.ok(inTable.includes('| ' + marker('画板') + ' | 保留正文 |'));
  const richTable = await convert('<table style="width:200px"><tr><td><iframe title="画板"></iframe></td></tr></table>');
  assert.ok(await client.evaluate('new DOMParser().parseFromString(' + JSON.stringify(richTable) + ',"text/html").body.textContent.includes(' + JSON.stringify(marker('画板')) + ')', contextId), 'Rich HTML tables must also retain unavailable native component labels');
  const inList = await convert('<ul><li>列表<div data-type="mindnote">' + unavailable + '</div></li></ul>');
  assert.ok(inList.includes(marker('思维导图')));
  const once = await convert(sample);
  const twice = await client.evaluate('FeishuMarkdownConverter.fromHtml(FeishuMarkdownConverter.toClipboardHtml(' + JSON.stringify(once) + '))', contextId);
  assert.equal(twice, once, 'Do not duplicate labels when placeholder text is copied again');
  console.log('Unavailable content: native whiteboard sample, enterprise messages, typed/unknown placeholders, preserved previews/links, code, tables and no duplicate labels passed');
};
