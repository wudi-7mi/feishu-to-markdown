# Partner Center Privacy 表单填写稿

以下英文内容可直接粘贴到 Microsoft Edge Partner Center。所有描述均与 `0.4.2` 版本代码和公开隐私政策一致。

## Single purpose description

```text
Feishu To Markdown converts rich-text content selected in Feishu or Lark documents into Markdown when the user presses Ctrl+C, and then writes the Markdown back to the clipboard. It supports official Feishu/Lark domains and enterprise custom domains that the user explicitly adds and authorizes. All document conversion is performed locally in the browser.
```

## Permission justification

### storage justification

```text
The storage permission is used only to save the extension's enabled/disabled setting and the list of domains configured by the user through chrome.storage.sync. The extension does not store document or clipboard content. Microsoft Edge may sync these settings through the user's own Microsoft account, but the extension developer does not receive them.
```

### scripting justification

```text
The scripting permission is used to dynamically register the extension's bundled content scripts only on enterprise custom domains that the user explicitly adds and authorizes. This is necessary because organizations that purchase Feishu services may access documents through their own custom domains. The extension does not download or execute remote code.
```

### clipboardRead justification

```text
The clipboardRead permission is used only after the user presses Ctrl+C on an enabled and authorized Feishu/Lark document domain. It reads the HTML or plain text that the page placed on the clipboard for that specific copy action so it can be converted locally to Markdown. The extension does not continuously monitor, upload, transmit, or persist clipboard content.
```

### clipboardWrite justification

```text
The clipboardWrite permission is used to replace the result of the user's Ctrl+C action with the locally converted Markdown text. Clipboard content is written only in direct response to the user's copy action on an enabled and authorized domain, and is not sent to any server or retained by the extension.
```

### Host permission justification

```text
Required host permissions are limited to official Feishu and Lark domains. On these domains, the bundled content script listens for a user-initiated Ctrl+C action and performs the Markdown conversion locally. The optional *://*/* declaration does not grant default access to all websites; it only allows Edge to show a permission prompt for an exact enterprise custom domain entered by the user. A dynamic content script is registered only after the user explicitly grants that domain. No other websites are accessed.
```

## Are you using remote code?

选择：

```text
No
```

### Remote code justification

```text
All JavaScript, CSS, localization files, and image assets are included in the submitted extension package. The extension does not use external scripts, CDN-hosted code, eval(), remotely imported modules, downloaded executable code, or WebAssembly.
```

## Data usage

### What user data do you plan to collect?

选择“不收集用户数据”。如果页面显示数据类别复选框，则所有数据类别都不勾选。

审核解释：扩展会在用户设备上临时处理用户主动复制的网页富文本，但不会将其传输给开发者或第三方，不会上传、出售或持久化保存，因此不属于开发者收集的用户数据。扩展也不使用服务器、统计分析、广告或跟踪服务。

### Privacy policy URL

```text
https://github.com/wudi-7mi/feishu-to-markdown/blob/main/PRIVACY.md
```

## Required certifications

将 **I certify that the following disclosures are true** 下方的三个认证项全部勾选。当前扩展符合这些声明：

- 不向第三方出售或转移用户数据；
- 不将用户数据用于与扩展单一用途无关的目的；
- 不将用户数据用于信用评估或借贷目的。

如果 Partner Center 显示的英文措辞有所调整，以页面上的实际三项为准，但三项都应勾选。

## Consistency check

- Single purpose 与商店描述一致：Ctrl+C 将飞书文档转换为 Markdown。
- 权限理由与 `manifest.json` 一致。
- 数据声明与 `PRIVACY.md` 一致。
- Remote code 选择 No。
- 开发者不运营数据接收服务器，也没有统计分析或用户数据收集计划。
