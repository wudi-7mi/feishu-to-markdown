# Certification Notes

## Test steps

1. Install the extension and refresh an already-open Microsoft Edge tab.
2. Open the extension from the toolbar and verify that "启用飞书 To Markdown" is enabled.
3. Open a Feishu or Lark document page. If a test document is provided below, use that URL.
4. Select formatted content, such as a heading, bold text, a list, or a table.
5. Press Ctrl+C and wait for the "已复制为 Markdown" confirmation.
6. Paste into a plain-text editor and verify that the clipboard contains Markdown.
7. To test a custom domain, add the domain in extension settings, wait for automatic validation, click "授权域名", grant access, refresh the target page, and repeat steps 4-6.

## Test document

Public test document URL: `SUBMISSION_OWNER_TO_PROVIDE`

No account credentials are included in the extension. If the test document requires authentication, provide a reviewer-accessible account or a public read-only document in Partner Center.

## Expected behavior

- The extension remains silent on domains that aren't configured and authorized.
- Clipboard content is processed locally and isn't sent to a server.
- The extension contains no remote code.
