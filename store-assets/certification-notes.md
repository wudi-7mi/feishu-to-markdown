# Certification Notes

## Changes in version 0.6.10

Markdown paste now uses Feishu-compatible code blocks and document tables. Source text copied with syntax-highlighting HTML is recognized, including Markdown fences containing JSON code fences. Copying nested lists preserves paragraphs, code, tables, and images. The toolbar also includes an experimental Export Current Document action for supported document and wiki pages. The declared permission list is unchanged.

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

## Full-document export test

1. With a supported document or wiki page active, open the popup and click "导出当前文档". The source domain must be configured and authorized, and the account must have access to the document.
2. A separate extension task tab opens and downloads a local Markdown file after reading and converting the document. The source page remains open.
3. On a longer document, cancel an export and retry. Cancellation stops outstanding document requests. Failed or incomplete reads show an error instead of reporting a successful download.
4. Export is experimental. Images remain online references; unsupported components produce visible placeholders or warnings.

## Test document

Copy-test document URL: https://www.feishu.cn/docx/doxcnyzM1jOYaHHvJF6BtyrXpjb

No account credentials are included in the extension. The developer must verify this document's sharing settings before submission. A read-only document can cover copy testing; paste needs an editable document, and full export needs an accessible supported document. Provide reviewer-accessible documents and any necessary test-account instructions in Partner Center.

## Expected behavior

- The extension remains silent on domains that aren't configured and authorized.
- Copy, paste, and conversion run locally. Full export makes same-origin, read-only requests to the original document website using the browser's existing login state; document contents are not sent to the developer or third parties.
- Document contents are only saved when the user requests a local export. The extension does not extract cookies or access tokens.
- The extension contains no remote code.
