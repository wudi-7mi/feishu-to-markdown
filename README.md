# 飞书 To Markdown

飞书 To Markdown 是一个 Microsoft Edge 扩展。在飞书文档中选中内容并按下 `Ctrl+C`，扩展会读取飞书生成的富文本剪贴板，在浏览器本地转换为 Markdown，然后写回剪贴板。

- 项目主页：https://github.com/wudi-7mi/feishu-to-markdown
- 支持邮箱：wudi7mi@gmail.com
- 隐私政策：https://github.com/wudi-7mi/feishu-to-markdown/blob/main/PRIVACY.md

## 功能

- 使用 `Ctrl+C` 直接复制 Markdown，不需要打开中间转换页面。
- 支持标题、粗体、斜体、删除线、链接、图片、列表、任务列表、引用、代码块和表格等常见格式。
- 默认支持飞书和 Lark 官方域名。
- 企业自定义域名采用按需授权，不申请全站必选访问权限。
- 所有转换均在浏览器本地完成，不上传或保存文档内容。

## 本地安装

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

脚本会读取 `manifest.json` 的版本号，并在 `dist` 中生成可上传到 Partner Center 的 ZIP。`manifest.json` 位于 ZIP 根目录，开发文件和商店素材不会包含在扩展包中。

## 商店发布材料

`store-assets` 目录包含：

- 中文商店详细描述；
- Partner Center 隐私声明与权限理由草稿；
- 审核测试说明；
- 300×300 商店 Logo；
- 1280×800 设置页截图；
- 提交前检查清单。

发布流程参考 [Microsoft Edge 官方文档](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)。

## 非官方声明

飞书 To Markdown 是独立开发的第三方工具，并非飞书或 Lark 官方产品，也未获得其背书。

## License

[MIT](LICENSE)
