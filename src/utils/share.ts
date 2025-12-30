export async function shareLink(url: string, title?: string, text?: string) {
  const payload = { title, text, url };
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share(payload);
      return { shared: true, copied: false };
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      alert("Lien copié 📎");
      return { shared: false, copied: true };
    }
  } catch (err) {
    console.error("shareLink error", err);
  }
  window.prompt("Copie ce lien pour partager", url);
  return { shared: false, copied: false };
}
