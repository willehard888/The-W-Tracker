// transformImage's literal safety contract: "a transform can never break a
// non-Supabase image." Every pass-through case is locked, plus the DPR cap
// (2× max — the deliberate sharpness/size trade-off).
import { describe, it, expect, afterEach } from "vitest";
import { transformImage, avatarUrl } from "@/lib/img";

const SUPA = "https://xyz.supabase.co/storage/v1/object/public/avatars/me.jpg";

const setDpr = (v: number) =>
  Object.defineProperty(window, "devicePixelRatio", { value: v, configurable: true });

afterEach(() => setDpr(1));

describe("transformImage pass-through contract", () => {
  it("empty / null / undefined → empty string", () => {
    expect(transformImage(null, { width: 100 })).toBe("");
    expect(transformImage(undefined, { width: 100 })).toBe("");
    expect(transformImage("", { width: 100 })).toBe("");
  });

  it("non-Supabase URLs pass through untouched (OAuth avatars, data URIs)", () => {
    const external = "https://lh3.googleusercontent.com/a/photo.jpg";
    const dataUri = "data:image/png;base64,AAAA";
    expect(transformImage(external, { width: 100 })).toBe(external);
    expect(transformImage(dataUri, { width: 100 })).toBe(dataUri);
  });

  it("URLs that already carry params are never double-transformed", () => {
    const already = SUPA + "?width=64";
    expect(transformImage(already, { width: 100 })).toBe(already);
  });
});

describe("transformImage rewrite", () => {
  it("rewrites object → render endpoint with width/quality/resize", () => {
    setDpr(1);
    const out = transformImage(SUPA, { width: 100 });
    expect(out).toContain("/storage/v1/render/image/public/");
    expect(out).toContain("width=100");
    expect(out).toContain("quality=70");
    expect(out).toContain("resize=cover");
  });

  it("applies retina scale but caps DPR at 2 (3× phones still get 2×)", () => {
    setDpr(3);
    expect(transformImage(SUPA, { width: 100 })).toContain("width=200");
    setDpr(2);
    expect(transformImage(SUPA, { width: 100 })).toContain("width=200");
  });

  it("avatarUrl is square (width = height = px × dpr)", () => {
    setDpr(2);
    const out = avatarUrl(SUPA, 32);
    expect(out).toContain("width=64");
    expect(out).toContain("height=64");
  });
});
