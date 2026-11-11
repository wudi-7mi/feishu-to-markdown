# Partner Center Privacy 表单填写稿

以下英文内容可直接粘贴到 Microsoft Edge Partner Center。所有描述均与 `0.6.11` 版本代码和公开隐私政策一致。

## Single purpose description

```text
Feishu To Markdown locally converts rich text copied from Feishu/Lark documents into Markdown, and converts pasted Markdown into editable rich text. An explicit Convert Clipboard action is also available. Results are written only to the clipboard or active editor. It supports official Feishu/Lark domains and explicitly authorized enterprise custom domains.
```

## Permission justification

### storage justification

```text
The storage permission is used only to save the copy-conversion setting, Markdown paste-conversion setting, and the list of domains configured by the user through chrome.storage.sync. The extension does not store document or clipboard content. Microsoft Edge may sync these settings through the user's own Microsoft account, but the extension developer does not receive them.
```

### scripting justification

```text
The scripting permission dynamically registers the extension's bundled content scripts on enterprise custom domains explicitly added and authorized by the user. These scripts handle user-initiated copy and paste conversions. The extension does not call document content APIs, read complete documents automatically, or download and execute remote code.
```

### activeTab justification

```text
The activeTab permission reads the active tab's URL when the user opens the extension popup, to show whether its domain is configured and authorized. The extension does not inspect browsing history, read unrelated tabs, or use this permission to request document contents.
```

### clipboardRead justification

```text
The clipboardRead permission is used only after the user copies or pastes on an enabled and authorized Feishu/Lark document domain, or clicks Convert Clipboard in the extension popup. It reads HTML or plain text for that specific user action so it can be converted locally between Feishu rich text and Markdown. The extension does not continuously monitor, upload, transmit, or persist clipboard content.
```

### clipboardWrite justification

```text
The clipboardWrite permission is used to write locally converted Markdown together with the original Feishu/Lark HTML, or to write rich-text HTML generated from Markdown after the user clicks Convert Clipboard. Clipboard content is written only in direct response to an explicit user action and is not sent to any server or retained by the extension.
```

### Host permission justification

```text
Required host permissions are limited to official Feishu/Lark domains for user-initiated copy and paste conversion. The optional *://*/* declaration only allows a permission prompt for an exact enterprise custom domain entered by the user; bundled content scripts are registered after that grant. No unrelated websites or document content APIs are accessed.
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

审核解释：仅在用户复制、粘贴或显式转换剪贴板时处理本次操作提供的内容。内容在浏览器内临时处理，不会传给开发者或第三方，不下载、出售、持久化保存或用于统计、广告、跟踪。扩展不调用文档正文接口，不提取 Cookie 或令牌。

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

- Single purpose 与商店描述一致：在用户主动复制或粘贴时完成飞书富文本与 Markdown 的本地格式转换。
- 权限理由与 `manifest.json` 一致。
- 数据声明与 `PRIVACY.md` 一致。
- Remote code 选择 No。
- 开发者不运营数据接收服务器，也没有统计分析或用户数据收集计划。
