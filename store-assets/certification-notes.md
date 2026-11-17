# Certification Notes

## Changes in version 0.6.15

This version preserves additional clipboard-provided styles and layouts through sanitized embedded HTML: color, background, underline, sub/superscripts, alignment/indent, higher heading semantics, callouts, columns, details, and merged/styled tables. Code languages, existing formula sources, and static reference links are also extracted. KaTeX (MIT) is bundled for local MathML output; no CDN, remote scripts, new permissions, or document/component APIs are used. Native formula paste is not promised: explicit source preserves both the formula and adjacent text. Existing unavailable-component placeholders, table export and live-toggle fixes remain included.

## Rich format test and limitations

1. Copy text with foreground/background colors and underline, a language-tagged code block, and a merged table. Inspect Markdown: styles/merges use embedded HTML and code fences include the available language. Test a renderer that permits HTML/CSS; renderers such as GitHub may remove styles.
2. Paste equivalent Markdown/HTML into an editable test document. In the provided enterprise editor, text colors/background/underline, centered paragraphs, merged cells, column widths and populated JavaScript code were verified through actual native paste. The importer flattens columns, folding, higher heading levels and HTML table lists, and may discard cell appearance. Matching its own copied table HTML without private metadata did not restore list numbering either.
3. Copy a native equation whose clipboard contains LaTeX and inspect the Markdown delimiters. Pasting formula Markdown back should explicitly show the source and preserve the paragraphs before and after it. Standalone native equation HTML can disappear and a partial attributed-text pool can override other text; the extension does not generate or reuse opaque document metadata.

## Unavailable component test

1. Copy a document section containing a whiteboard and an unavailable-content message. Paste into a Markdown editor. With a `whiteboard` type in the copied HTML, it should show a descriptive whiteboard placeholder instead of the generic message.
2. Repeat with other component types available to the reviewer, such as a mind map. A specific label requires an explicit type hint; content without one must say its type could not be identified. A mind map drawn inside a whiteboard remains a whiteboard if that is the only type provided.
3. Check that neighboring paragraphs, a copied preview image, and any original link are retained. An example message quoted inside a code block should remain code, and copying a generated placeholder again should not duplicate it.

## Table cell list test

1. Copy a document table with a paragraph followed by four numbered items inside one cell. Paste into a Markdown editor: the paragraph and each item should remain separated, with numbering preserved.
2. Copy that Markdown table and paste it into an editable Feishu/Lark paragraph. Cell text and item boundaries should remain; whether numbering and editable list structure survive depends on the target importer. The tested enterprise editor flattens HTML table lists to ordinary paragraphs.
3. Repeat with a nested bullet list, a checked task, and inline code containing the literal text `<br>` or a pipe. Inspect Markdown and generated HTML for nesting, task state and code text. Repeat to verify that header text and list items do not accumulate formatting or duplicate.

## Live toggle test

1. Turn off both conversion switches in the toolbar popup, then open a Feishu/Lark document.
2. Enable copy conversion in the popup without reloading the document. Select formatted content, press Ctrl+C, and paste into a plain-text editor; Markdown should be produced.
3. Disable copy conversion and repeat the copy; the extension should leave the clipboard unchanged. Enable it again and verify that conversion happens once per copy.
4. Enable Markdown paste conversion without reloading and paste Markdown into an editable paragraph; it should become rich text.

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
