/**
 * Clipboard utility — handles the Permissions Policy restriction
 * that blocks navigator.clipboard in iframes (Figma Make preview).
 * Falls back to the deprecated execCommand('copy') or shows a prompt.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Strategy 1: Modern Clipboard API
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Blocked by permissions policy — fall through
  }

  // Strategy 2: execCommand fallback
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (success) return true;
  } catch {
    // Also blocked — fall through
  }

  // Strategy 3: Return false so caller can show manual copy UI
  return false;
}
