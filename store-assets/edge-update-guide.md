# Edge 商店更新指南：0.6.15

本次提交继续使用已有的“飞书 To Markdown”商店条目。当前版本补充颜色、背景色、下划线、布局和合并表格等 Markdown 内嵌 HTML，以及代码语言、公式源码和已有静态链接转换，并包含此前的特殊块提示与开关修复。目标应用可能过滤 HTML 样式，公式粘贴保留源码；完整限制见 [0.6.15 发布说明](release-notes-0.6.15.md)。商店扩展 ID：`jpholmfajdccoondgolpcgmckmehoaef`。按微软的更新流程，在原条目上传更高版本的软件包，然后提交审核。[微软官方更新说明](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/update-extension)

## 1. 选择发布包

上传本地生成的 `dist/feishu-to-markdown-edge-0.6.15.zip`。ZIP 根目录直接包含 `manifest.json`，包内版本号为 `0.6.15`。本地生成软件包与发布 GitHub Release 是独立步骤；提交前确认公开隐私政策也已同步。

重新构建命令：

```powershell
.\scripts\validate.ps1
$env:CHROME_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node .\scripts\test-browser.js
.\scripts\package-browser.ps1 -Browser edge
```

只有所有命令都通过才使用生成的软件包。提交前核对后台已有版本低于 `0.6.15`；已经提交过相同或更高版本时，需要另行提高版本号并重新构建。[版本号要求](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/update-extension)

## 2. 更新已有扩展的软件包

1. 登录 [Partner Center 的 Edge 开发者后台](https://partner.microsoft.com/dashboard/microsoftedge/overview)。
2. 打开已有的“飞书 To Markdown”条目，核对商店扩展 ID。
3. 打开 **Packages / 程序包**，上传 `feishu-to-markdown-edge-0.6.15.zip`。
4. 等待自动校验通过，核对显示的版本号为 `0.6.15`，保存并继续。保留原条目的公开范围、市场和开发者身份设置。[软件包上传流程](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension#step-3-upload-the-package-for-the-extension)

## 3. 同步隐私和商店文案

本次补充本地富文本格式转换，权限和数据处理范围没有变化。公式库随包提供，不加载远程代码。当前版本同时包含为已打开且已授权的页面加载内置转换脚本的修复，请同步以下材料，使后台披露与实际行为一致。[隐私披露要求](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension#step-6-enter-privacy-information)

| 后台字段 | 对应材料或填写内容 |
| --- | --- |
| Single purpose | [英文表单稿](partner-center-privacy-form.md)中的 Single purpose description |
| Permission justification | 同一文件中的五项权限说明和 Host permission justification；`scripting` 用于注册内置脚本，并向已配置且已授权的现有页面加载脚本，`activeTab` 用于域名状态显示 |
| Remote code | No；所有运行代码随软件包提供 |
| Data usage | 按当前实际实现填写不向开发者收集用户数据，并确认页面要求的相关声明；仅处理本次复制、粘贴提供的内容，不请求文档正文接口，不下载文档文件 |
| Privacy policy URL | `https://github.com/wudi-7mi/feishu-to-markdown/blob/main/PRIVACY.md` |
| Store listings / 简体中文描述 | [listing-zh-CN.md](listing-zh-CN.md)开头的产品描述，不包含末尾“商店字段建议” |
| Notes for certification | 参照下方审核备注；更多测试步骤见 [certification-notes.md](certification-notes.md) |

提交前打开隐私政策的公开链接，确认能看到新版关于复制、粘贴、本地临时处理及权限用途的说明。

## 4. 填写更新说明和审核备注

如果后台提供更新说明字段，可以填写：

```text
0.6.15 更新：补充 Markdown 内嵌 HTML，保留复制内容已有的颜色、背景色、下划线、对齐、分栏、折叠和合并表格等信息，并提取代码语言、公式源码及静态链接。目标应用可能过滤样式或降级布局，公式粘贴明确保留源码。内嵌 HTML 经过允许列表过滤，公式库随包提供。包含此前的特殊块类型提示、表格转换及开关修复，权限和数据处理范围没有新增。
```

**Notes for certification** 可以填写以下英文，并补上审查人员可用的测试文档和账号访问说明。微软建议提供审查所需的测试步骤和测试账号信息。[审核备注说明](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension#step-8-enter-certification-testing-notes-and-submit-the-extension)

```text
Version 0.6.15 preserves styles, layouts and merged tables using sanitized embedded HTML where the copied clipboard provides them. It also extracts code languages, formula sources and existing reference links. Copy colored, highlighted or underlined text and a merged table, then inspect the Markdown. Test a Markdown renderer that permits HTML/CSS; some renderers filter styles. The tested enterprise editor accepts text color/background/underline, centered paragraphs, merged cells, column widths and populated code blocks, but flattens columns, details, higher heading levels and HTML lists inside tables. Formula paste explicitly retains source and surrounding text rather than promising native equation restoration. KaTeX is bundled under MIT for local MathML output; no remote code or additional permissions are used. Existing descriptive placeholders for unavailable components remain included.

To test copy, select formatted text in an accessible Feishu/Lark document, press Ctrl+C, and paste into a plain-text editor. To test paste, enable Markdown paste conversion, copy a heading, fenced code block and pipe table from a text editor, and paste into an editable document. Code contents should remain inside a populated code block; the table should be a document table. The Convert Clipboard button provides explicit conversion.

Processing is local and temporary. The extension does not request document content APIs, automatically read complete documents, download document files, or send document contents to the developer or third parties. No cookies or tokens are extracted.
```

已有测试文档地址记录在 `certification-notes.md` 中。请在提交前核对其访问权限：只读文档只能测试复制；粘贴需要可编辑文档。

## 5. 提交、查看审核状态并验证更新

1. 检查各表单的校验结果，点击 **Publish / 发布** 提交审核。
2. 在扩展概览查看状态。提交后的认证可能需要最多 7 个工作日；显示 **In the store** 后，更新才在商店可用。[官方审核状态说明](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/update-extension)
3. 如果审核期间需要重交，先核对后台状态；取消并重新提交会重新开始审核。[审核期间修改的影响](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/update-extension#update-your-extension-during-the-certification-step)
4. 上架后核对[现有商店页面](https://microsoftedge.microsoft.com/addons/detail/jpholmfajdccoondgolpcgmckmehoaef)的版本。在 Edge 的 `edge://extensions` 检查商店版是否已更新到 `0.6.15`；旧页面若仍运行旧脚本，可刷新一次。
5. 用商店版检查文字颜色、背景与下划线、合并单元格、代码语言及公式源码和相邻正文，再检查开启无需刷新、代码块正文、文档表格和显式剪贴板转换。表格列表、分栏、折叠等是否恢复原生结构取决于目标文档导入器，应按格式支持清单核对。测试商店版时停用本地开发版副本，确保操作由商店版处理。

GitHub Release 的发布与 Edge 商店审核是两个独立步骤；GitHub 上出现下载包不代表 Edge 商店已经更新。
