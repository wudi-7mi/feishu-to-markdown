$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms

# CF_HTML is UTF-8. Windows Forms can decode it using the ANSI code page,
# corrupting Chinese text and even JSON metadata. Read its original bytes.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class FeishuClipboardReader {
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern uint RegisterClipboardFormat(string name);
    [DllImport("user32.dll")]
    private static extern bool OpenClipboard(IntPtr owner);
    [DllImport("user32.dll")]
    private static extern bool CloseClipboard();
    [DllImport("user32.dll")]
    private static extern IntPtr GetClipboardData(uint format);
    [DllImport("kernel32.dll")]
    private static extern IntPtr GlobalLock(IntPtr handle);
    [DllImport("kernel32.dll")]
    private static extern bool GlobalUnlock(IntPtr handle);
    [DllImport("kernel32.dll")]
    private static extern UIntPtr GlobalSize(IntPtr handle);
    public static string ReadHtml() {
        uint format = RegisterClipboardFormat("HTML Format");
        if (!OpenClipboard(IntPtr.Zero)) throw new InvalidOperationException("Clipboard is busy; copy again and retry.");
        try {
            IntPtr handle = GetClipboardData(format);
            if (handle == IntPtr.Zero) return "";
            ulong length = GlobalSize(handle).ToUInt64();
            if (length > 64 * 1024 * 1024) throw new InvalidOperationException("Clipboard HTML exceeds the diagnostic limit.");
            IntPtr data = GlobalLock(handle);
            if (data == IntPtr.Zero) throw new InvalidOperationException("Cannot read clipboard HTML.");
            try {
                byte[] bytes = new byte[(int)length];
                Marshal.Copy(data, bytes, 0, bytes.Length);
                int end = Array.IndexOf(bytes, (byte)0);
                return new UTF8Encoding(false, true).GetString(bytes, 0, end < 0 ? bytes.Length : end);
            } finally { GlobalUnlock(handle); }
        } finally { CloseClipboard(); }
    }
}
'@

$clipboardHtml = [FeishuClipboardReader]::ReadHtml()
$clipboardData = [Windows.Forms.Clipboard]::GetDataObject()
@{
    html = $clipboardHtml
    text = [string]$clipboardData.GetData([Windows.Forms.DataFormats]::UnicodeText)
    formats = $clipboardData.GetFormats()
} | ConvertTo-Json -Depth 3 -Compress
