# 飞书 To Markdown 隐私政策

更新日期：2026 年 8 月 20 日

飞书 To Markdown 的单一用途，是在用户主动按下 Ctrl+C 时，将飞书文档中选中的富文本内容转换为 Markdown 并写回剪贴板。

## 数据处理

- 扩展只在用户配置并授权的域名中监听 Ctrl+C。
- 用户按下 Ctrl+C 后，扩展会读取该次复制操作写入剪贴板的 HTML 或纯文本，在浏览器本地将其转换为 Markdown，再写回剪贴板。
- 文档内容仅在当前浏览器内存中临时处理，不会由本扩展上传、发送、出售或持久化保存。
- 扩展不使用分析服务、广告服务、远程代码或第三方跟踪器。
- 当前没有接入服务器、数据统计或用户数据收集的计划。如果未来的数据处理方式发生变化，本政策和商店披露会在功能发布前同步更新。

## 保存的设置

扩展使用 `chrome.storage.sync` 保存以下设置：

- 插件总开关状态；
- 用户配置的生效域名列表。

这些设置可能由 Microsoft Edge 根据用户的浏览器同步配置同步到用户自己的 Microsoft 账户。扩展开发者不会接收这些设置。

## 权限用途

- `storage`：保存插件开关和域名列表。
- `clipboardRead`：在用户主动按下 Ctrl+C 后，读取飞书产生的富文本剪贴板内容。
- `clipboardWrite`：将转换后的 Markdown 写回剪贴板。
- `scripting`：仅在用户主动授权的企业自定义域名中注册本地内容脚本。
- 网站访问权限：默认仅包含飞书和 Lark 域名；其他域名必须由用户在设置页单独授权。

## 联系方式

开发者：wudi7mi

- 邮箱：[wudi7mi@gmail.com](mailto:wudi7mi@gmail.com)
- 项目主页：[github.com/wudi-7mi/feishu-to-markdown](https://github.com/wudi-7mi/feishu-to-markdown)

## 非官方声明

飞书 To Markdown 是独立开发的第三方工具，并非飞书或 Lark 官方产品，也未获得其背书。
