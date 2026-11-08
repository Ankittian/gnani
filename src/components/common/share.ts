/** Share an audio note (+ text) via the OS share sheet → WhatsApp; falls back to download + wa.me text link. */
export async function shareVoiceNote(blob: Blob, text: string, filename: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const ext = blob.type.includes("wav") ? "wav" : "mp3";
  const file = new File([blob], `${filename}.${ext}`, { type: blob.type || "audio/mpeg" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text, title: "Dukaan Dost" });
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  // No phone number is ever stored (synthetic-data rule) — open WhatsApp with just the text.
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  return "downloaded";
}
