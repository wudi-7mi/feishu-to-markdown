# 飞书 To Markdown

飞书 To Markdown 是一个 Microsoft Edge 扩展。在飞书文档中选中内容并按下 `Ctrl+C`，扩展会读取飞书生成的富文本剪贴板，在浏览器本地转换为 Markdown，然后写回剪贴板。

除飞书和 Lark 官方域名外，扩展也支持购买飞书服务并使用企业专属域名的文档系统。用户可以在设置页添加自己的企业域名，并通过 Edge 的按需授权机制，仅向该域名授予扩展访问权限。

## 从 Edge 商店安装

扩展已上架 Microsoft Edge Add-ons：

**[在 Microsoft Edge 中获取「飞书 To Markdown」](https://microsoftedge.microsoft.com/addons/detail/%E9%A3%9E%E4%B9%A6-to-markdown/jpholmfajdccoondgolpcgmckmehoaef)**

安装后刷新已经打开的飞书文档页面，选中内容并按 `Ctrl+C`，即可将内容复制为 Markdown。点击 Edge 工具栏中的扩展图标，可以开启或关闭功能，并为使用飞书服务的企业配置专属文档域名。

## 功能

- 使用 `Ctrl+C` 直接复制 Markdown，不需要打开中间转换页面。
- 支持标题、粗体、斜体、删除线、链接、图片、列表、任务列表、引用、代码块和表格等常见格式。
- 默认支持飞书和 Lark 官方域名。
- 支持购买飞书服务企业使用的专属自定义域名，并采用按需授权，不申请全站必选访问权限。
- 所有转换均在浏览器本地完成，不上传或保存文档内容。

## 开发者模式安装

1. 在 Edge 地址栏打开 `edge://extensions/`。
2. 打开「开发人员模式」。
3. 点击「加载解压缩的扩展」。
4. 选择本仓库根目录 `feishu-to-markdown`。
5. 刷新已经打开的飞书文档页面。
6. 选中内容并按 `Ctrl+C`。

点击 Edge 工具栏中的扩展图标可以开启或关闭插件，并配置生效域名。域名输入会自动校验和防抖保存。新增企业自定义域名后，还需要点击「授权域名」并确认 Edge 的网站访问权限。

## 默认域名

- `feishu.cn`
- `feishuapp.cn`
- `larksuite.com`

根域名会匹配自身及其子域名，例如 `feishu.cn` 会同时匹配 `example.feishu.cn`。

## 权限说明

- `storage`：保存插件开关和域名列表。
- `clipboardRead`：在用户主动按下 `Ctrl+C` 后读取飞书生成的富文本剪贴板。
- `clipboardWrite`：将转换后的 Markdown 写回剪贴板。
- `scripting`：在用户主动授权的企业自定义域名中动态注册扩展内置脚本。
- 默认网站权限：仅限飞书和 Lark 官方域名。
- 可选网站权限：仅在用户添加企业自定义域名并点击授权后申请。

详细说明见 [隐私政策](PRIVACY.md)。

## 打包

在 PowerShell 中运行：

```powershell
.\scripts\package.ps1
```

## 致谢与来源

本扩展的 HTML 与 Markdown 转换逻辑基于 [blackblue1/feishu-markdown-converter](https://github.com/blackblue1/feishu-markdown-converter) 项目进行适配和扩展。感谢原作者 [blackblue1](https://github.com/blackblue1) 开源飞书文档与 Markdown 双向转换器，为本扩展提供了转换逻辑和实现基础。

在原项目基础上，本项目增加了 Microsoft Edge 扩展形态、`Ctrl+C` 自动转换、企业专属自定义域名、按需网站授权、扩展设置和商店发布支持。原项目采用 MIT License，本项目继续依照 MIT License 发布。

## 非官方声明

飞书 To Markdown 是独立开发的第三方工具，并非飞书或 Lark 官方产品，也未获得其背书。

## License

[MIT](LICENSE)
