# Microsoft Edge Add-ons 提交清单

## 仓库内已完成

- [x] Manifest V3 扩展包
- [x] 中文名称与短描述国际化
- [x] 默认飞书/Lark 域名最小权限
- [x] 企业自定义域名按需授权
- [x] 无远程代码
- [x] 300×300 商店 Logo
- [x] 1280×800 商店截图
- [x] 250 字符以上中文详细描述
- [x] 权限理由草稿
- [x] 隐私政策草稿
- [x] 审核测试步骤草稿
- [x] PowerShell 打包脚本
- [x] MIT License

## 提交者需要填写

- [ ] Partner Center 开发者账号和公开的开发者/组织名称
- [ ] 公开项目主页 URL
- [ ] 公开支持邮箱或支持页面 URL
- [ ] 隐私政策的公开 HTTPS URL
- [ ] 审核人员可访问的飞书/Lark 测试文档 URL
- [ ] 如果测试文档需要登录，提供审核测试账号或改用公开只读文档
- [ ] 上架范围：Public 或 Hidden
- [ ] 上架市场范围
- [ ] 商店分类，建议选择 Productivity/生产力
- [ ] 数据使用声明最终确认
- [ ] 商标和非官方声明最终确认

## 上传文件

运行：

```powershell
.\scripts\package.ps1
```

上传生成的：

```text
dist/feishu-to-markdown-0.4.0.zip
```

商店详情页另行上传：

```text
store-assets/logo-300.png
store-assets/screenshot-settings-1280x800.png
```
