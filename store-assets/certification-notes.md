# Certification Notes

## Changes in version 0.6.11

The direct full-document export feature has been removed, including its UI, pages, Worker and document API request code. The extension only converts user-initiated copies, pastes, and explicit Convert Clipboard actions. Code-block fixes, document tables, syntax-highlighted Markdown source detection and nested-list preservation remain available. The declared permission list is unchanged; scripting is used only to register bundled scripts for authorized custom domains, and activeTab displays the current domain status.

## Copy test

1. Install the extension and refresh an already-open Microsoft Edge tab.
2. Open the extension from the toolbar and verify that "启用飞书 To Markdown" is enabled.
3. Open a Feishu or Lark document page. If a test document is provided below, use that URL.
4. Select formatted content, such as a heading, bold text, a list, or a table.
5. Press Ctrl+C and wait for the "已复制为 Markdown" confirmation.
6. Paste into a plain-text editor and verify that the clipboard contains Markdown.
7. To test a custom domain, add the domain in extension settings, wait for automatic validation, click "授权域名", grant access, refresh the target page, and repeat steps 4-6.

## Markdown paste test

1. Enable "Markdown 粘贴转飞书" in the extension popup. Open an editable Feishu/Lark document with an account that can edit it.
2. Copy Markdown containing a heading, a fenced code block, and a pipe table from a text editor such as VS Code.
3. Paste into a blank document paragraph. The code must remain inside a populated code block, preserving indentation and blank lines. The table should become a document table.
4. Open the popup and click "转换剪贴板", then paste in the document to exercise explicit clipboard conversion.

## Test document

Copy-test document URL: https://www.feishu.cn/docx/doxcnyzM1jOYaHHvJF6BtyrXpjb

No account credentials are included in the extension. The developer must verify this document's sharing settings before submission. A read-only document can cover copy testing; paste needs an editable document. Provide reviewer-accessible documents and any necessary test-account instructions in Partner Center.

## Expected behavior

- The extension remains silent on domains that aren't configured and authorized.
- Copy, paste, and clipboard conversion run locally. No document content APIs are requested and document contents are not sent to the developer or third parties.
- The popup has no full-document export action. No export pages or Worker are packaged, and the extension does not download document files or extract cookies or access tokens.
- The extension contains no remote code.
