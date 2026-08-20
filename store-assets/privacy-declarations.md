# Partner Center 隐私表单建议

## Single Purpose Description

在用户主动按下 Ctrl+C 时，将飞书文档选中的富文本内容在浏览器本地转换为 Markdown，并写回剪贴板。

## Permission Justification

- `storage`：保存用户设置的插件开关和生效域名列表。
- `clipboardRead`：仅在用户主动按下 Ctrl+C 后，读取飞书为该次复制操作生成的 HTML 或纯文本，以便转换为 Markdown。
- `clipboardWrite`：将本地转换完成的 Markdown 写回用户剪贴板。
- `scripting`：在用户为企业自定义域名授予网站访问权限后，动态注册扩展内置的内容脚本。
- `https://*.feishu.cn/*`、`https://*.feishuapp.cn/*`、`https://*.larksuite.com/*`：在飞书和 Lark 文档页面监听用户主动发起的 Ctrl+C，并执行本地格式转换。
- 可选网站访问权限：只在用户通过设置页主动添加并授权企业自定义域名时申请，用于在该域名运行相同的本地转换功能。

## Remote Code

选择：No, I am not using remote code.

所有 JavaScript、CSS 和图片资源均包含在扩展包内，不下载或执行远程代码。

## Data Usage

扩展会在本地临时处理用户主动复制的网页内容，但不收集、上传、出售或持久化保存该内容。插件开关和域名列表保存在 `chrome.storage.sync` 中。

开发者没有接入服务器、数据统计或用户数据收集的计划。

## Privacy Policy URL

https://github.com/wudi-7mi/feishu-to-markdown/blob/main/PRIVACY.md

## Developer and Support

- 开发者：wudi7mi
- 项目：https://github.com/wudi-7mi/feishu-to-markdown
- 支持邮箱：wudi7mi@gmail.com

提交时应确保 Partner Center 的勾选项与公开的 `PRIVACY.md` 完全一致。
