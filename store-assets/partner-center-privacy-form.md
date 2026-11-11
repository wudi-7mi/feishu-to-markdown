# Partner Center Privacy 表单填写稿

以下英文内容可直接粘贴到 Microsoft Edge Partner Center。所有描述均与 `0.6.10` 版本代码和公开隐私政策一致。

## Single purpose description

```text
Feishu To Markdown converts between Feishu/Lark documents and Markdown locally. It converts user-initiated copies and pastes, provides an explicit Convert Clipboard action, and exports the selected document to a local Markdown file when requested. Results go to the clipboard, active editor, or user-selected local file. It supports official Feishu/Lark domains and explicitly authorized enterprise custom domains.
```

## Permission justification

### storage justification

```text
The storage permission is used only to save the copy-conversion setting, Markdown paste-conversion setting, and the list of domains configured by the user through chrome.storage.sync. The extension does not store document or clipboard content. Microsoft Edge may sync these settings through the user's own Microsoft account, but the extension developer does not receive them.
```

### scripting justification

```text
The scripting permission registers bundled content scripts on enterprise custom domains explicitly authorized by the user. When the user clicks Export Current Document, bundled code also runs in the selected, configured and authorized document tab to make same-origin, read-only requests for document content and pagination. Cancellation aborts those requests. The browser supplies the current login state; the extension does not extract cookies or tokens, or execute downloaded code.
```

### activeTab justification

```text
The activeTab permission identifies the tab selected when the user opens the extension popup. Its URL is used to display whether the current domain is configured and authorized; its URL and title identify the source document for an explicit Export Current Document action. The extension does not inspect browsing history or other unrelated tabs.
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
Required host permissions are limited to official Feishu/Lark domains for user-initiated copy, paste, and document export. Export reads content only through same-origin requests from the selected authorized document tab. The optional *://*/* declaration only allows a permission prompt for an exact enterprise custom domain entered by the user; content scripts are registered after that grant. No unrelated websites are accessed.
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

审核解释：复制、粘贴和导出内容在用户浏览器内临时处理，不会传给开发者或第三方，不出售或用于统计、广告、跟踪。全文导出只向文档原网站发送读取正文所需的同源请求，使用浏览器已有登录状态，不提取 Cookie 或令牌；仅按用户要求将结果保存为本地文件。

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

- Single purpose 与商店描述一致：在用户主动复制、粘贴或导出时完成飞书文档与 Markdown 的本地格式转换。
- 权限理由与 `manifest.json` 一致。
- 数据声明与 `PRIVACY.md` 一致。
- Remote code 选择 No。
- 开发者不运营数据接收服务器，也没有统计分析或用户数据收集计划。
