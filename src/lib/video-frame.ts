/**
 * The first frame of a video the member picked, as an image file.
 *
 * Videos went to storage with no moderation at all while every image and every
 * line of text was screened (App Review 1.2 is unforgiving about exactly this).
 * Screening the opening frame is the cheap 90 %: it catches what a thumbnail in
 * the feed would show anyway.
 *
 * ponytail: one frame, not a scan of the whole clip. A video whose first second
 * is innocent still gets through, and the report and block paths are what
 * catch that. Sample a few timestamps if it ever proves necessary.
 */
export const VIDEO_FRAME_TIMEOUT_MS = 8_000;

export const firstVideoFrame = (file: File, timeoutMs = VIDEO_FRAME_TIMEOUT_MS): Promise<File> =>
  new Promise((resolve, reject) => {
    // Every failure path must REJECT, never throw: the caller blocks the
    // upload on a rejection, and an exception here would leave the composer
    // broken instead of the post unscreened.
    if (typeof URL.createObjectURL !== "function") { reject(new Error("no_object_url")); return; }
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { URL.revokeObjectURL(url); } catch { /* nothing to revoke */ }
      video.removeAttribute("src");
      fn();
    };
    const timer = setTimeout(() => done(() => reject(new Error("frame_timeout"))), timeoutMs);

    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.onerror = () => done(() => reject(new Error("video_unreadable")));
    video.onloadeddata = () => {
      // A hair into the clip: at exactly 0 some encoders hand back a black frame.
      video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx || !canvas.width || !canvas.height) { done(() => reject(new Error("no_canvas"))); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => done(() => (blob ? resolve(new File([blob], "frame.jpg", { type: "image/jpeg" })) : reject(new Error("no_blob")))),
        "image/jpeg",
        0.8,
      );
    };
    video.src = url;
  });
