/**
 * 剪贴板工具 - 兼容 HTTP 和 HTTPS 环境
 *
 * navigator.clipboard API 仅在安全上下文 (HTTPS/localhost) 中可用
 * 此工具提供 fallback 方案，在 HTTP 环境下使用 document.execCommand
 */

/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 * @returns Promise<boolean> 是否成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // 优先使用现代 Clipboard API (HTTPS 环境)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("[Clipboard] Modern API failed, falling back:", err);
    }
  }

  // Fallback: 使用 document.execCommand (兼容 HTTP 环境)
  return fallbackCopyToClipboard(text);
}

/**
 * Fallback 复制方法 - 使用 document.execCommand
 * 兼容非 HTTPS 环境
 */
function fallbackCopyToClipboard(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;

  // 避免滚动到文本框
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "2em";
  textarea.style.height = "2em";
  textarea.style.padding = "0";
  textarea.style.border = "none";
  textarea.style.outline = "none";
  textarea.style.boxShadow = "none";
  textarea.style.background = "transparent";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const successful = document.execCommand("copy");
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.error("[Clipboard] Fallback copy failed:", err);
    document.body.removeChild(textarea);
    return false;
  }
}

/**
 * 检查剪贴板 API 是否可用
 */
export function isClipboardAvailable(): boolean {
  return !!(navigator.clipboard && window.isSecureContext);
}
