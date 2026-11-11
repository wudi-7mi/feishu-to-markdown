# 飞书 To Markdown

飞书 To Markdown 是一个浏览器扩展，支持飞书与 Markdown 双向转换。在飞书文档中选中内容并按下 `Ctrl+C`，扩展会读取飞书生成的富文本剪贴板，在浏览器本地转换为 Markdown，然后将 Markdown 与飞书原始富文本一同写回剪贴板。把 Markdown 从其他应用复制后，也可以直接粘贴到飞书编辑区，扩展会自动转换为飞书格式。

除飞书和 Lark 官方域名外，扩展也支持购买飞书服务并使用企业专属域名的文档系统。用户可以在设置页添加自己的企业域名，并通过 Edge 的按需授权机制，仅向该域名授予扩展访问权限。

## 从 Edge 商店安装

扩展已上架 Microsoft Edge Add-ons：

**[在 Microsoft Edge 中获取「飞书 To Markdown」](https://microsoftedge.microsoft.com/addons/detail/%E9%A3%9E%E4%B9%A6-to-markdown/jpholmfajdccoondgolpcgmckmehoaef)**

安装后刷新已经打开的飞书文档页面，选中内容并按 `Ctrl+C`，即可将内容复制为 Markdown。点击 Edge 工具栏中的扩展图标，可以开启或关闭功能，并为使用飞书服务的企业配置专属文档域名。

发布版本见 [GitHub Releases](https://github.com/wudi-7mi/feishu-to-markdown/releases)。维护者更新已有 Edge 商店条目时，可参考 [Edge 商店更新指南](store-assets/edge-update-guide.md)。

Markdown 转飞书有两种使用方式：

1. 从 Markdown 编辑器复制文本，在飞书文档编辑区直接按 `Ctrl+V`；扩展识别到 Markdown 结构后会自动转换。支持 VS Code 等编辑器同时附带的语法着色 HTML。
2. 点击扩展图标，再点击“转换剪贴板”，回到飞书文档按 `Ctrl+V`。该方式适合剪贴板中同时包含其他富文本格式，或内容没有明显 Markdown 标记的情况。

自动粘贴转换会把生成的 HTML 交给飞书的原生粘贴处理器，将代码块等内容导入文档模型。代码块保留缩进、空行和语言标记；粘贴到已有代码块或纯文本输入区时保留原文。

代码块的剪贴板 HTML 按飞书原生复制样本生成，包含 `data-lark-language` 语言属性和保存正文的 `code > div` 结构；直接粘贴和“转换剪贴板”共用这一格式。

Markdown 表格默认生成飞书文档表格（`table`），使用原生的 `ace-table` 标记、列宽和单元格段落结构。直接粘贴和“转换剪贴板”使用相同的默认表格类型。

## 功能

- 使用 `Ctrl+C` 直接复制 Markdown，不需要打开中间转换页面。
- 同时保留飞书富文本：粘贴回飞书时维持原生格式，粘贴到纯文本或 Markdown 编辑器时得到 Markdown。
- 将剪贴板中的 Markdown 直接粘贴到飞书，自动转换为标题、列表、任务项、引用、代码块、表格等富文本。
- 设置页提供“转换剪贴板”按钮，可先将当前 Markdown 剪贴板写成 HTML，再回到飞书粘贴。
- 支持标题、粗体、斜体、删除线、链接、图片、列表、任务列表、引用、代码块和表格等常见格式。
- 默认支持飞书和 Lark 官方域名。
- 支持购买飞书服务企业使用的专属自定义域名，并采用按需授权，不申请全站必选访问权限。
- 所有转换均在浏览器本地完成，仅处理用户本次复制或粘贴提供的内容，不请求文档正文接口，不上传或持久化保存文档内容。

## 开发者模式安装

先在项目目录运行：

```powershell
.\scripts\package-browser.ps1 -Browser edge
.\scripts\prepare-unpacked.ps1 -Browser edge
```

准备脚本将当前版本的运行文件复制到固定目录 `%LOCALAPPDATA%\FeishuToMarkdown\edge`。安装和更新统一使用此目录。

1. 在 Edge 地址栏打开 `edge://extensions/`。
2. 打开「开发人员模式」。
3. 若原先加载了仓库目录，先停用旧条目，避免同时启用两个副本。
4. 点击「加载解压缩的扩展」，选择准备脚本输出的 `%LOCALAPPDATA%\FeishuToMarkdown\edge` 目录。
5. 刷新已经打开的飞书文档页面。
6. 选中内容并按 `Ctrl+C`。

改变加载路径会产生不同的扩展 ID，旧副本的开关、企业域名和授权需要在新副本重新配置。之后更新时重复运行两个脚本，保持此固定目录不变，再点击新条目的「重新加载」，即可继续保留该副本的设置。

点击 Edge 工具栏中的扩展图标可以开启或关闭插件、转换剪贴板，并配置生效域名。域名输入会自动校验和防抖保存。新增企业自定义域名后，还需要点击「授权域名」并确认 Edge 的网站访问权限。

## 权限说明

- `storage`：保存插件开关和域名列表。
- `clipboardRead`：在用户主动按下 `Ctrl+C` 后读取飞书生成的富文本剪贴板，或在用户主动粘贴 Markdown / 点击“转换剪贴板”时读取纯文本剪贴板。
- `clipboardWrite`：将转换后的 Markdown 与飞书原始富文本一同写回剪贴板，或将 Markdown 转换后的 HTML 写回剪贴板。
- `activeTab`：在打开弹窗时读取当前标签页地址，用于显示域名是否生效。
- `scripting`：在用户主动授权的企业自定义域名中动态注册扩展内置的复制和粘贴处理脚本。
- 默认网站权限：仅限飞书和 Lark 官方域名。
- 可选网站权限：仅在用户添加企业自定义域名并点击授权后申请。

详细说明见 [隐私政策](PRIVACY.md)。

## 打包

在 PowerShell 中运行：

```powershell
.\scripts\validate.ps1
.\scripts\package.ps1
```

按浏览器生成发布包：

```powershell
.\scripts\package-browser.ps1 -Browser chrome
.\scripts\package-browser.ps1 -Browser edge
.\scripts\package-browser.ps1 -Browser firefox
```

生成文件位于 `dist`，命名格式为 `feishu-to-markdown-<browser>-<version>.zip`。Firefox 包使用独立的 Gecko Manifest 配置，Chrome 和 Edge 使用根目录 Manifest。

先运行校验脚本检查 Manifest、JavaScript、资源和图标尺寸，再运行打包脚本生成上传包。生成的 ZIP 位于 `dist`，`manifest.json` 位于 ZIP 根目录。

校验包含 Manifest、运行脚本、图标资源和 Markdown 转换测试。可另外运行浏览器集成测试：

```powershell
node .\scripts\test-browser.js
```

该测试使用临时浏览器配置和本机文档，不访问真实飞书账户；覆盖隔离环境中的粘贴事件、代码块正文和语言、文档表格、撤销、避免重复插入和普通编辑区的回退行为。浏览器支持时还验证真实 MV3 扩展加载、工具栏弹窗、开关持久化及含代码块和表格的剪贴板转换。默认使用 Windows 上的 Google Chrome，可通过 `CHROME_PATH` 环境变量指定其他 Chromium 浏览器。

测试还覆盖飞书嵌套列表中的正文、代码块、表格和图片转换。排查实际复制内容时，可主动添加 `--clipboard-sample` 参数，检查当前 Windows 剪贴板中的富文本；文档仅在内存中处理，只输出检查计数，不写入文档文件或打印正文。该检查验证已进入剪贴板的内容，不读取原网页中尚未复制的数据。

## 致谢与来源

本扩展的 HTML 与 Markdown 转换逻辑基于 [blackblue1/feishu-markdown-converter](https://github.com/blackblue1/feishu-markdown-converter) 项目进行适配和扩展。感谢原作者 [blackblue1](https://github.com/blackblue1) 开源飞书文档与 Markdown 双向转换器，为本扩展提供了转换逻辑和实现基础。

原项目采用 MIT License，本项目继续依照 MIT License 发布。

## 非官方声明

飞书 To Markdown 是独立开发的第三方工具，并非飞书或 Lark 官方产品，也未获得其背书。

## License

[MIT](LICENSE)
