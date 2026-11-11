# Partner Center 隐私表单建议

## Single Purpose Description

在用户主动复制、粘贴或导出时，在浏览器本地完成飞书文档与 Markdown 的格式转换，并将结果写回剪贴板、当前编辑器或用户选择的本地文件。

## Permission Justification

- `storage`：保存用户设置的复制开关、Markdown 粘贴转换开关和生效域名列表。
- `clipboardRead`：仅在用户主动复制、粘贴或点击“转换剪贴板”后读取 HTML 或纯文本，以便在本地转换。
- `clipboardWrite`：将本地转换完成的 Markdown 与原始富文本一同写回剪贴板，或将 Markdown 转换后的 HTML 写回剪贴板。
- `scripting`：在用户授权的企业自定义域名注册内置脚本；在用户主动全文导出时，在选定且已授权的文档标签页发起同源只读请求，并在取消时停止请求。
- `activeTab`：用户打开弹窗时读取当前标签页地址和标题，用于显示域名生效状态和确定导出源文档。
- `https://*.feishu.cn/*`、`https://*.feishuapp.cn/*`、`https://*.larksuite.com/*`：在飞书和 Lark 文档页面监听用户主动发起的复制与粘贴，并执行本地格式转换。
- 可选网站访问权限：只在用户通过设置页主动添加并授权企业自定义域名时申请，用于在该域名运行相同的本地转换功能。

## Remote Code

选择：No, I am not using remote code.

所有 JavaScript、CSS 和图片资源均包含在扩展包内，不下载或执行远程代码。

## Data Usage

扩展在本地临时处理用户主动复制、粘贴或导出的内容，不向开发者或第三方上传或出售内容。仅按用户要求保存导出的本地文件。全文导出通过原文档标签页向原网站发起同源请求，使用浏览器已有登录状态，不提取 Cookie 或令牌。开关和域名列表保存在 `chrome.storage.sync` 中。

开发者没有接入服务器、数据统计或用户数据收集的计划。

## Privacy Policy URL

https://github.com/wudi-7mi/feishu-to-markdown/blob/main/PRIVACY.md

## Developer and Support

- 开发者：wudi7mi
- 项目：https://github.com/wudi-7mi/feishu-to-markdown
- 支持邮箱：wudi7mi@gmail.com

提交时应确保 Partner Center 的勾选项与公开的 `PRIVACY.md` 完全一致。
