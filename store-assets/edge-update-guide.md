# Edge 商店更新指南：0.6.11

本次提交继续使用已有的“飞书 To Markdown”商店条目。0.6.11 已移除直接全文导出功能，请使用这个版本替代 0.6.10。商店扩展 ID：`jpholmfajdccoondgolpcgmckmehoaef`。按微软的更新流程，在原条目上传更高版本的软件包，然后提交审核。[微软官方更新说明](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/update-extension)

## 1. 选择发布包

上传 `dist/feishu-to-markdown-edge-0.6.11.zip`。ZIP 根目录直接包含 `manifest.json`，包内版本号为 `0.6.11`。也可以从本仓库的 [v0.6.11 GitHub Release](https://github.com/wudi-7mi/feishu-to-markdown/releases/tag/v0.6.11) 下载同名文件，使用旁边的 `SHA256SUMS` 校验。

重新构建命令：

```powershell
.\scripts\validate.ps1
$env:CHROME_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node .\scripts\test-browser.js
.\scripts\package-browser.ps1 -Browser edge
```

只有所有命令都通过才使用生成的软件包。提交前核对后台已有版本低于 `0.6.11`；已经提交过相同或更高版本时，需要另行提高版本号并重新构建。[版本号要求](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/update-extension)

## 2. 更新已有扩展的软件包

1. 登录 [Partner Center 的 Edge 开发者后台](https://partner.microsoft.com/dashboard/microsoftedge/overview)。
2. 打开已有的“飞书 To Markdown”条目，核对商店扩展 ID。
3. 打开 **Packages / 程序包**，上传 `feishu-to-markdown-edge-0.6.11.zip`。
4. 等待自动校验通过，核对显示的版本号为 `0.6.11`，保存并继续。保留原条目的公开范围、市场和开发者身份设置。[软件包上传流程](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension#step-3-upload-the-package-for-the-extension)

## 3. 同步隐私和商店文案

本次已移除直接全文导出功能，仅保留复制、粘贴和显式转换剪贴板，请同步更新以下材料，使后台披露与实际行为一致。[隐私披露要求](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension#step-6-enter-privacy-information)

| 后台字段 | 对应材料或填写内容 |
| --- | --- |
| Single purpose | [英文表单稿](partner-center-privacy-form.md)中的 Single purpose description |
| Permission justification | 同一文件中的五项权限说明和 Host permission justification；`scripting` 仅用于授权企业域名的脚本注册，`activeTab` 用于域名状态显示 |
| Remote code | No；所有运行代码随软件包提供 |
| Data usage | 按当前实际实现填写不向开发者收集用户数据，并确认页面要求的相关声明；仅处理本次复制、粘贴提供的内容，不请求文档正文接口，不下载文档文件 |
| Privacy policy URL | `https://github.com/wudi-7mi/feishu-to-markdown/blob/main/PRIVACY.md` |
| Store listings / 简体中文描述 | [listing-zh-CN.md](listing-zh-CN.md)开头的产品描述，不包含末尾“商店字段建议” |
| Notes for certification | 参照下方审核备注；更多测试步骤见 [certification-notes.md](certification-notes.md) |

提交前打开隐私政策的公开链接，确认能看到新版关于复制、粘贴、本地临时处理及权限用途的说明。

## 4. 填写更新说明和审核备注

如果后台提供更新说明字段，可以填写：

```text
0.6.11 更新：移除直接全文导出 Markdown 功能及相关页面和文档接口请求代码。保留代码块正文和嵌套围栏修复、编辑器语法着色 HTML 中的 Markdown 源码识别、默认文档表格和嵌套列表内容保留。仅在用户复制、粘贴或点击“转换剪贴板”时进行本地转换，权限清单未新增。
```

**Notes for certification** 可以填写以下英文，并补上审查人员可用的测试文档和账号访问说明。微软建议提供审查所需的测试步骤和测试账号信息。[审核备注说明](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension#step-8-enter-certification-testing-notes-and-submit-the-extension)

```text
Version 0.6.11 removes direct full-document export, including its UI, pages, Worker and document API request code. Only user-initiated copy, paste and explicit Convert Clipboard actions remain. Code blocks, nested Markdown fences, syntax-highlighted Markdown source and document tables remain supported. The permission list is unchanged.

To test copy, select formatted text in an accessible Feishu/Lark document, press Ctrl+C, and paste into a plain-text editor. To test paste, enable Markdown paste conversion, copy a heading, fenced code block and pipe table from a text editor, and paste into an editable document. Code contents should remain inside a populated code block; the table should be a document table. The Convert Clipboard button provides explicit conversion.

Processing is local and temporary. The extension does not request document content APIs, automatically read complete documents, download document files, or send document contents to the developer or third parties. No cookies or tokens are extracted.
```

已有测试文档地址记录在 `certification-notes.md` 中。请在提交前核对其访问权限：只读文档只能测试复制；粘贴需要可编辑文档。

## 5. 提交、查看审核状态并验证更新

1. 检查各表单的校验结果，点击 **Publish / 发布** 提交审核。
2. 在扩展概览查看状态。提交后的认证可能需要最多 7 个工作日；显示 **In the store** 后，更新才在商店可用。[官方审核状态说明](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/update-extension)
3. 如果审核期间需要重交，先核对后台状态；取消并重新提交会重新开始审核。[审核期间修改的影响](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/update-extension#update-your-extension-during-the-certification-step)
4. 上架后核对[现有商店页面](https://microsoftedge.microsoft.com/addons/detail/jpholmfajdccoondgolpcgmckmehoaef)的版本。在 Edge 的 `edge://extensions` 检查商店版是否已更新到 `0.6.11`，然后刷新已打开的飞书页面。
5. 用商店版验证代码块正文、含嵌套围栏的 Markdown、文档表格和显式剪贴板转换。测试商店版时停用本地开发版副本，确保操作由商店版处理。

GitHub Release 的发布与 Edge 商店审核是两个独立步骤；GitHub 上出现下载包不代表 Edge 商店已经更新。
