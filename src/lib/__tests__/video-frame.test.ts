import { describe, expect, it } from "vitest";
import { firstVideoFrame } from "@/lib/video-frame";

/**
 * jsdom has no video decoder, so what is testable is the contract the caller
 * depends on: the promise always settles (so a pick can never hang the
 * composer), and it rejects rather than resolving something unscreened.
 */
const withObjectUrl = async <T,>(run: (created: string[], revoked: string[]) => Promise<T>): Promise<T> => {
  const created: string[] = [];
  const revoked: string[] = [];
  const url = globalThis.URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown };
  const origCreate = url.createObjectURL;
  const origRevoke = url.revokeObjectURL;
  url.createObjectURL = () => { const u = `blob:${created.length}`; created.push(u); return u; };
  url.revokeObjectURL = (u: string) => { revoked.push(u); };
  try { return await run(created, revoked); } finally { url.createObjectURL = origCreate; url.revokeObjectURL = origRevoke; }
};

describe("firstVideoFrame", () => {
  it("rejects, quickly, when the frame cannot be read", async () => {
    const file = new File([new Uint8Array([0, 1, 2])], "clip.mp4", { type: "video/mp4" });
    await withObjectUrl(() =>
      expect(firstVideoFrame(file, 50)).rejects.toThrow(/video_unreadable|frame_timeout|no_canvas|no_blob/),
    );
  });

  it("rejects instead of throwing when the platform cannot make an object URL", async () => {
    await expect(firstVideoFrame(new File([new Uint8Array([1])], "c.mp4", { type: "video/mp4" }), 50)).rejects.toThrow("no_object_url");
  });

  it("cleans up after itself (no object URL left behind)", async () => {
    await withObjectUrl(async (created, revoked) => {
      await firstVideoFrame(new File([new Uint8Array([9])], "c.mp4", { type: "video/mp4" }), 50).catch(() => null);
      expect(created).toHaveLength(1);
      expect(revoked).toEqual(created);
    });
  });
});
