export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof text !== 'string') return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("Clipboard API non disponibile, uso il fallback...", err);
  }

  let textArea: HTMLTextAreaElement | null = null;
  try {
    textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.setAttribute("aria-hidden", "true");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    return document.execCommand("copy");
  } catch (err) {
    console.error("Fallito anche il fallback della copia:", err);
    return false;
  } finally {
    textArea?.remove();
  }
};
