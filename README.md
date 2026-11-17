# 飞书 To Markdown

飞书 To Markdown 是一个浏览器扩展，支持飞书与 Markdown 双向转换。在飞书文档中选中内容并按下 `Ctrl+C`，扩展会读取飞书生成的富文本剪贴板，在浏览器本地转换为 Markdown，然后将 Markdown 与飞书原始富文本一同写回剪贴板。把 Markdown 从其他应用复制后，也可以直接粘贴到飞书编辑区，扩展会自动转换为飞书格式。

除飞书和 Lark 官方域名外，扩展也支持购买飞书服务并使用企业专属域名的文档系统。用户可以在设置页添加自己的企业域名，并通过 Edge 的按需授权机制，仅向该域名授予扩展访问权限。

## 从 Edge 商店安装

扩展已上架 Microsoft Edge Add-ons：

**[在 Microsoft Edge 中获取「飞书 To Markdown」](https://microsoftedge.microsoft.com/addons/detail/%E9%A3%9E%E4%B9%A6-to-markdown/jpholmfajdccoondgolpcgmckmehoaef)**

安装后刷新已经打开的飞书文档页面，选中内容并按 `Ctrl+C`，即可将内容复制为 Markdown。点击 Edge 工具栏中的扩展图标，可以开启或关闭功能，并为使用飞书服务的企业配置专属文档域名。

功能开关会立即应用到已经打开的页面。即使打开页面时功能处于关闭状态，之后从弹窗开启也无需刷新页面；重复开关不会重复转换。

发布版本见 [GitHub Releases](https://github.com/wudi-7mi/feishu-to-markdown/releases)。维护者更新已有 Edge 商店条目时，可参考 [Edge 商店更新指南](store-assets/edge-update-guide.md)。

Markdown 转飞书有两种使用方式：

1. 从 Markdown 编辑器复制文本，在飞书文档编辑区直接按 `Ctrl+V`；扩展识别到 Markdown 结构后会自动转换。支持 VS Code 等编辑器同时附带的语法着色 HTML。
2. 点击扩展图标，再点击“转换剪贴板”，回到飞书文档按 `Ctrl+V`。该方式适合剪贴板中同时包含其他富文本格式，或内容没有明显 Markdown 标记的情况。

自动粘贴转换会把生成的 HTML 交给飞书的原生粘贴处理器，将代码块等内容导入文档模型。代码块保留缩进、空行和语言标记；粘贴到已有代码块或纯文本输入区时保留原文。

代码块的剪贴板 HTML 按飞书原生复制样本生成，包含 `data-lark-language` 语言属性和保存正文的 `code > div` 结构；直接粘贴和“转换剪贴板”共用这一格式。

Markdown 表格默认生成飞书文档表格（`table`），使用原生的 `ace-table` 标记、列宽和单元格段落结构。直接粘贴和“转换剪贴板”使用相同的默认表格类型。

表格单元格中的段落、有序列表、无序列表和嵌套列表在 Markdown 中保留编号、换行和层级。普通表格使用 `<br>` 表示单元格换行、`&nbsp;` 保留列表缩进；合并或带外观的表格使用 HTML。粘贴时提供对应列表结构，代码中的字面量 `<br>` 保持原样。目标文档的 HTML 导入器可能将单元格列表降为普通段落；已提供的企业文档站点存在此限制，即使使用其原生复制的表格 HTML 也不能恢复编号。

0.6.15 补充 Markdown 内嵌 HTML：文字颜色、背景色、下划线、上下标、对齐与缩进、提示块、分栏、折叠及合并表格等信息，会在剪贴板提供对应结构时保留。代码块语言和已有公式源码也会提取。粘贴 HTML 前仅保留允许的标签、样式和链接，移除脚本、事件属性和活动嵌入。

## 功能

- 使用 `Ctrl+C` 直接复制 Markdown，不需要打开中间转换页面。
- 同时保留飞书富文本：粘贴回飞书时维持原生格式，粘贴到纯文本或 Markdown 编辑器时得到 Markdown。
- 将剪贴板中的 Markdown 直接粘贴到飞书，自动转换为标题、列表、任务项、引用、代码块、表格等富文本。
- 设置页提供“转换剪贴板”按钮，可先将当前 Markdown 剪贴板写成 HTML，再回到飞书粘贴。
- 支持标题、粗体、斜体、删除线、链接、图片、列表、任务列表、引用、代码块和表格等常见格式。
- 默认支持飞书和 Lark 官方域名。
- 支持购买飞书服务企业使用的专属自定义域名，并采用按需授权，不申请全站必选访问权限。
- 所有转换均在浏览器本地完成，仅处理用户本次复制或粘贴提供的内容，不请求文档正文接口，不上传或持久化保存文档内容。

## 格式支持盘点

2026-11-16 按 **31 组常见格式与组件**核查了飞书富文本到 Markdown 的转换路径：11 组有基础 Markdown 输出，原有 13 组缺口补充了 HTML、公式源码或静态链接转换，7 组特殊组件仍不能完整还原。补充支持以本次剪贴板已有信息为前提。这里统计的是下列分组，不是飞书全部格式的总数；结论基于代码、浏览器测试、原生剪贴板样本，以及企业文档测试页的实际粘贴结果，并非所有飞书组件都经过真实账户实测。复制时原始富文本 HTML 仍会保留，本表描述的是 Markdown 结果。

格式分类参考飞书的[文本样式说明](https://www.feishu.cn/hc/zh-CN/articles/299406656534-在文档中设置文本样式)和[画板说明](https://www.feishu.cn/hc/en-US/articles/094832636759-create-or-insert-a-board)，支持状态以本项目代码为准。

| 有转换路径的 11 组 | 范围与条件 |
| --- | --- |
| 正文与换行 | 段落、软换行 |
| 一级至六级标题 | 输出 `#` 至 `######` |
| 加粗、斜体、删除线 | 标签和常见内联样式 |
| 超链接 | 保留标签中已有的文字和地址 |
| 图片 | 保留已有图片 URL 和说明；不下载图片，目标应用仍可能需要原站访问权限 |
| 行内代码 | 转为反引号代码标记 |
| 代码块正文 | 保留空行、缩进和围栏；语言见下表 |
| 有序、无序与嵌套列表 | 保留编号、项目符号和层级 |
| 任务勾选 | 保留复选框状态，不包含任务系统的负责人和提醒等信息 |
| 引用与分割线 | 转为引用和分割线标记 |
| 基础文档表格与单元格列表 | 包括单元格内段落、列表、嵌套与任务项 |

| 补充支持的 13 组 | 输出方式与剩余限制 |
| --- | --- |
| 七级至九级标题 | HTML `role="heading"`、`aria-level` 和字重字号；目标应用可能降为正文，测试站点未恢复原生层级 |
| 代码块语言 | 从 `data-language`、`data-lark-language` 或 `language-*` 类提取围栏语言，支持常用语言别名；缺少元数据时不猜语言 |
| 文字颜色 | `<span style="color:…">`；需目标渲染器允许样式 |
| 文字背景色 | `<span style="background-color:…">` 或 `<mark>`；需剪贴板提供颜色 |
| 下划线 | `<u>` 或受限的下划线样式 |
| 段落对齐与缩进 | HTML 的对齐、首行缩进和左边距；粘贴回文档是否接受由其导入器决定，测试站点接受居中 |
| 高亮块/提示块 | 有明确 `callout` 结构时保留已有内容、图标和安全样式，无样式时提供默认边框与底色；不恢复组件交互 |
| 分栏布局 | 有明确 grid/columns 结构时输出 CSS Grid，保留已有列比例；测试站点粘贴后变为顺序段落 |
| 折叠状态 | `<details>` / `<summary>` 及 `open`；只包含本次剪贴板已有正文，缺失时明确提示；测试站点粘贴后展开为普通内容 |
| 表格合并与外观 | HTML 表格保留跨行跨列、列宽、对齐、底色与允许的边框样式；测试站点接受合并与列宽，但未完整接受单元格底色等外观 |
| @提及与链接卡片 | 从明确的语义属性提取已有名称和安全链接，转为静态文字/链接；不恢复人员身份、通知、权限或动态卡片 |
| 文件附件 | 从已有文件名和安全链接生成静态链接；只有名称时标注缺少链接，不读取或下载附件正文 |
| 数学公式 | 已有 LaTeX 转 `$…$` / `$$…$$`；仅有 MathML 时保留安全 MathML。兼容的 HTML 预览可本地渲染；粘贴回飞书明确显示公式源码，不保证恢复原生公式 |

内嵌 HTML 能保存的格式，仍取决于目标 Markdown 渲染器是否允许标签、CSS 和 MathML。GitHub 会过滤内联样式，因此不能保证颜色、列布局等在那里展示；参见 [GitHub Markup 说明](https://github.com/github/markup#github-markup)。本地转换预览使用随包提供的 [KaTeX](https://katex.org/)（MIT，[许可证](vendor/katex.LICENSE)、[来源与校验值](vendor/katex.VERSION.json)），仅生成 MathML，不加载 CDN、字体或远程脚本。公式粘贴使用明确的源码占位：单独的原生公式 HTML 会被测试站点丢弃，部分原生剪贴板属性池还会覆盖相邻正文，因此不生成或复用文档的私有属性池。

| 不能完整还原的 7 组 | 有明确类型线索时的占位提示 |
| --- | --- |
| 思维导图/思维笔记 | 思维导图 |
| 画板/白板 | 画板 |
| 流程图/UML/图表 | 流程图/图表 |
| 嵌入式电子表格 | 电子表格；若剪贴板另有普通 HTML 表格，可转换其中提供的单元格，但不保留公式和交互 |
| 多维表格 | 多维表格 |
| 音视频 | 音频或视频 |
| 第三方嵌入与小组件 | 嵌入内容、文档小组件、投票、同步块或群名片等已知类型 |

例如：`[画板：暂不支持转换为 Markdown，请在飞书原文中查看]`。已确认的原生样本使用 `data-type="whiteboard"`，也支持企业文档名称替换后的通用提示文案。其他类型规则按明确的语义属性、组件类名或标签识别，仍需更多原生样本核验；不会用正文中出现的“思维导图”等词或不明数字编号猜类型。画板中绘制的思维导图在只有 `whiteboard` 标记时仍标为画板。

若剪贴板只剩通用提示且没有类型线索，则显示 `[未识别的飞书内容块：剪贴板未提供类型，请在飞书原文中查看]`。原有预览图和链接会尽量保留；类型标注不代表能恢复组件内部内容，也不尝试请求其数据接口。

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
- `scripting`：为用户授权的企业自定义域名注册内置转换脚本，并在开启功能或授权域名后，向已配置且已授权的现有页面加载相同脚本，使其无需刷新即可生效。
- 默认网站权限：仅限飞书和 Lark 官方域名。
- 可选网站权限：仅在用户添加企业自定义域名并点击授权后申请。

详细说明见 [隐私政策](PRIVACY.md)。

## 项目结构与开发工具

| 路径 | 用途 |
| --- | --- |
| `manifest.json`、`manifests/` | Chromium 与 Firefox 扩展清单，版本号保持一致 |
| `background.js`、`content.js` | 域名授权、脚本加载和页面复制粘贴处理 |
| `converter.js`、`rich-html.js` | Markdown 双向转换与富文本 HTML 过滤 |
| `options.*`、`_locales/`、`icon*` | 工具栏弹窗、界面文案和图标 |
| `vendor/` | 随包提供的第三方库、许可证和校验信息 |
| `scripts/` | 校验、浏览器测试、打包及本地调试工具 |
| `store-assets/` | 商店文案、审核材料、图片和历次发布说明 |
| `dist/` | 本地生成的安装包，不纳入 Git |

`scripts/test-browser.js` 统一运行 `*-browser-fixture.js` 中的浏览器回归样例。`scripts/preview-formats.js` 提供仅含合成内容的本地格式预览，运行 `node .\scripts\preview-formats.js` 后打开输出的本机地址，按 Enter 关闭服务。

`scripts/read-clipboard.ps1` 将当前 Windows 剪贴板的原始 HTML、纯文本和格式列表输出为 JSON，供主动诊断使用；`scripts/write-test-clipboard.ps1` 从标准输入接收合成测试 JSON，并写入剪贴板。日常回归测试使用内存中的模拟剪贴板。

源码文本统一使用 LF；`vendor/katex.min.js` 按原始字节保存，避免 Git 换行转换破坏记录的 SHA-256。浏览器自动化日志、截图及误生成的 `%SystemDrive%/` 缓存目录已加入忽略规则。

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

校验包含 Manifest、运行脚本、图标资源、第三方库校验值、Markdown 转换测试和后台脚本授权范围测试。可另外运行浏览器集成测试：

```powershell
node .\scripts\test-browser.js
```

该测试使用临时浏览器配置和本机文档，不访问真实飞书账户；覆盖隔离环境中的粘贴事件、代码块正文和语言、文档表格、撤销、避免重复插入和普通编辑区的回退行为。浏览器支持时还验证真实 MV3 扩展加载、工具栏弹窗、开关持久化、已打开页面无需刷新即可开启功能，以及含代码块和表格的剪贴板转换。默认使用 Windows 上的 Google Chrome，可通过 `CHROME_PATH` 环境变量指定其他 Chromium 浏览器。

测试还覆盖飞书嵌套列表中的正文、代码块、表格和图片转换，以及表格单元格中的编号列表、嵌套列表、任务项、段落和多次往返转换。排查实际复制内容时，可主动添加 `--clipboard-sample` 参数，检查当前 Windows 剪贴板中的富文本；文档仅在内存中处理，只输出检查计数，不写入文档文件或打印正文。该检查验证已进入剪贴板的内容，不读取原网页中尚未复制的数据。

## 致谢与来源

本扩展的 HTML 与 Markdown 转换逻辑基于 [blackblue1/feishu-markdown-converter](https://github.com/blackblue1/feishu-markdown-converter) 项目进行适配和扩展。感谢原作者 [blackblue1](https://github.com/blackblue1) 开源飞书文档与 Markdown 双向转换器，为本扩展提供了转换逻辑和实现基础。

原项目采用 MIT License，本项目继续依照 MIT License 发布。

## 非官方声明

飞书 To Markdown 是独立开发的第三方工具，并非飞书或 Lark 官方产品，也未获得其背书。

## License

[MIT](LICENSE)
