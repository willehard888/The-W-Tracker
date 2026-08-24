import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const shareMock = vi.fn();
const writeFileMock = vi.fn();
let native = false;

vi.mock("@capacitor/core", () => ({ Capacitor: {} }));
vi.mock("@capacitor/share", () => ({ Share: { share: (...a: unknown[]) => shareMock(...a) } }));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { writeFile: (...a: unknown[]) => writeFileMock(...a) },
  Directory: { Cache: "CACHE" },
}));
vi.mock("@/lib/platform", () => ({ isNativePlatform: () => native }));

import { shareImage, saveImage, shareText } from "../share-image";

const blob = new Blob(["png-bytes"], { type: "image/png" });

describe("share-image", () => {
  beforeEach(() => {
    native = false;
    shareMock.mockReset().mockResolvedValue(undefined);
    writeFileMock.mockReset().mockResolvedValue({ uri: "file:///cache/card.png" });
    // jsdom has no createObjectURL; the download fallback needs both.
    globalThis.URL.createObjectURL = vi.fn(() => "blob:x");
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("native: writes the PNG to cache and hands the file URI to the share sheet", async () => {
    native = true;
    const out = await shareImage(blob, { filename: "card.png", text: "caption" });
    expect(out).toBe("shared");
    expect(writeFileMock).toHaveBeenCalledWith(expect.objectContaining({ path: "card.png", directory: "CACHE" }));
    const b64 = (writeFileMock.mock.calls[0][0] as { data: string }).data;
    expect(atob(b64)).toBe("png-bytes");
    expect(shareMock).toHaveBeenCalledWith(expect.objectContaining({ files: ["file:///cache/card.png"], text: "caption" }));
  });

  it("native: closing the sheet reads as cancelled, not an error", async () => {
    native = true;
    shareMock.mockRejectedValue(new Error("Share canceled"));
    await expect(shareImage(blob, { filename: "c.png" })).resolves.toBe("cancelled");
  });

  it("web without file-share support: falls back to a download", async () => {
    const out = await shareImage(blob, { filename: "card.png" });
    expect(out).toBe("downloaded");
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("web with Web Share Level 2: shares the file", async () => {
    const navShare = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { canShare: () => true, share: navShare });
    const out = await shareImage(blob, { filename: "card.png", title: "W" });
    expect(out).toBe("shared");
    expect(navShare).toHaveBeenCalledWith(expect.objectContaining({ title: "W" }));
    delete (navigator as { canShare?: unknown }).canShare;
    delete (navigator as { share?: unknown }).share;
  });

  it("saveImage: web downloads, native routes through the share sheet", async () => {
    await expect(saveImage(blob, "c.png")).resolves.toBe("downloaded");
    native = true;
    await expect(saveImage(blob, "c.png")).resolves.toBe("shared");
  });

  it("web share cancel and native hard-failure paths", async () => {
    const navShare = vi.fn().mockRejectedValue(new Error("abort"));
    Object.assign(navigator, { canShare: () => true, share: navShare });
    await expect(shareImage(blob, { filename: "c.png" })).resolves.toBe("cancelled");
    delete (navigator as { canShare?: unknown }).canShare;
    delete (navigator as { share?: unknown }).share;

    native = true;
    shareMock.mockRejectedValue(new Error("plugin exploded"));
    await expect(shareImage(blob, { filename: "c.png" })).rejects.toThrow("plugin exploded");
  });

  it("shareText: web navigator.share success, user-abort, and native plugin failure", async () => {
    const navShare = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share: navShare });
    await expect(shareText({ text: "hi" })).resolves.toBe(true);
    navShare.mockRejectedValue(new Error("abort"));
    await expect(shareText({ text: "hi" })).resolves.toBe(false);
    delete (navigator as { share?: unknown }).share;

    native = true;
    shareMock.mockRejectedValue(new Error("nope"));
    await expect(shareText({ text: "hi" })).resolves.toBe(false);
  });

  it("shareText: native uses the plugin; web without navigator.share reports false", async () => {
    native = true;
    await expect(shareText({ text: "hi", url: "https://x" })).resolves.toBe(true);
    expect(shareMock).toHaveBeenCalledWith(expect.objectContaining({ url: "https://x" }));
    native = false;
    await expect(shareText({ text: "hi" })).resolves.toBe(false);
  });
});
