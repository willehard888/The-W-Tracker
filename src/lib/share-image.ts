import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { isNativePlatform } from "@/lib/platform";

/**
 * Sharing that actually works inside the Capacitor WKWebView.
 *
 * The old path used `navigator.share` (text + URL only — Instagram never
 * appears without a FILE) and `<a download>` (a no-op in WKWebView). Native
 * now writes the PNG to the app cache and hands a real file URI to the iOS
 * share sheet — Instagram / WhatsApp / Messages / "Save Image" all show up.
 * Web keeps the Web Share API (Level 2, with files) and falls back to a
 * plain download.
 */

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const s = String(reader.result);
      resolve(s.slice(s.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

interface ShareImageOpts {
  filename: string;
  /** Caption offered alongside the image (receivers that support text). */
  text?: string;
  title?: string;
}

/** Share a PNG blob through the native share sheet (or web equivalent).
 *  Returns "shared" | "downloaded" | "cancelled". */
export const shareImage = async (blob: Blob, opts: ShareImageOpts): Promise<"shared" | "downloaded" | "cancelled"> => {
  if (isNativePlatform()) {
    const base64 = await blobToBase64(blob);
    const { uri } = await Filesystem.writeFile({
      path: opts.filename,
      data: base64,
      directory: Directory.Cache,
    });
    try {
      await Share.share({ title: opts.title, text: opts.text, files: [uri] });
      return "shared";
    } catch (e) {
      // User closed the sheet — not an error.
      if (String((e as Error)?.message ?? e).toLowerCase().includes("cancel")) return "cancelled";
      throw e;
    }
  }
  const file = new File([blob], opts.filename, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: opts.title, text: opts.text });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  downloadBlob(blob, opts.filename);
  return "downloaded";
};

/** Save the PNG: web downloads it; native opens the share sheet, where the
 *  system "Save Image" action writes to Photos (sandbox-safe, no extra
 *  permission plumbing). */
export const saveImage = async (blob: Blob, filename: string): Promise<"shared" | "downloaded" | "cancelled"> => {
  if (isNativePlatform()) return shareImage(blob, { filename });
  downloadBlob(blob, filename);
  return "downloaded";
};

/** Text/link share that works on native too (Referrals "Share link" etc.). */
export const shareText = async (opts: { title?: string; text: string; url?: string }): Promise<boolean> => {
  if (isNativePlatform()) {
    try {
      await Share.share({ title: opts.title, text: opts.text, url: opts.url });
      return true;
    } catch {
      return false;
    }
  }
  if (navigator.share) {
    try {
      await navigator.share(opts);
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

// Capacitor import kept explicit so tree-shaking never drops the plugin
// registration on native builds.
void Capacitor;
