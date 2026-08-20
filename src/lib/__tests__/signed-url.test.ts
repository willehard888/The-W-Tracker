// Signed-URL resolution guards the S7 storage flip: proof-photos and
// feed-images are private buckets, and every historical DB row still holds a
// full /object/public/ URL as its bucket+key pointer. These tests lock the
// URL parsing (which era/endpoint forms resolve), the private-bucket
// classification, and the sign-with-transform → plain-sign fallback chain.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  storageKey,
  getSignedUrl,
  parseStorageUrl,
  isPrivateStorageUrl,
  useSignedMediaUrl,
} from "@/lib/signed-url";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: vi.fn() } },
}));

const BASE = "https://proj.supabase.co/storage/v1";

const mockCreateSignedUrl = (impl: (...args: unknown[]) => unknown) => {
  const createSignedUrl = vi.fn(impl);
  (supabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue({ createSignedUrl });
  return createSignedUrl;
};

beforeEach(() => vi.clearAllMocks());

describe("storageKey", () => {
  it("extracts the key from public/sign/authenticated object URLs", () => {
    expect(storageKey("proof-photos", `${BASE}/object/public/proof-photos/uid/a.jpg`)).toBe("uid/a.jpg");
    expect(storageKey("proof-photos", `${BASE}/object/sign/proof-photos/uid/a.jpg?token=x`)).toBe("uid/a.jpg");
    expect(storageKey("proof-photos", `${BASE}/object/authenticated/proof-photos/uid/a.jpg`)).toBe("uid/a.jpg");
  });

  it("passes bare keys through, stripping leading slashes", () => {
    expect(storageKey("proof-photos", "uid/a.jpg")).toBe("uid/a.jpg");
    expect(storageKey("proof-photos", "/uid/a.jpg")).toBe("uid/a.jpg");
  });

  it("decodes percent-encoded keys", () => {
    expect(storageKey("proof-photos", `${BASE}/object/public/proof-photos/uid/my%20pic.jpg`)).toBe("uid/my pic.jpg");
  });
});

describe("parseStorageUrl", () => {
  it("parses object and render/image endpoints across access modes", () => {
    expect(parseStorageUrl(`${BASE}/object/public/feed-images/uid/b.png`)).toEqual({ bucket: "feed-images", key: "uid/b.png" });
    expect(parseStorageUrl(`${BASE}/render/image/public/avatars/uid/c.webp?width=80`)).toEqual({ bucket: "avatars", key: "uid/c.webp" });
    expect(parseStorageUrl(`${BASE}/render/image/sign/proof-photos/uid/d.jpg?token=t`)).toEqual({ bucket: "proof-photos", key: "uid/d.jpg" });
  });

  it("returns null for non-storage URLs", () => {
    expect(parseStorageUrl("https://example.com/pic.jpg")).toBeNull();
    expect(parseStorageUrl("uid/bare-key.jpg")).toBeNull();
  });
});

describe("isPrivateStorageUrl", () => {
  it("flags only the private buckets", () => {
    expect(isPrivateStorageUrl(`${BASE}/object/public/proof-photos/uid/a.jpg`)).toBe(true);
    expect(isPrivateStorageUrl(`${BASE}/object/public/feed-images/uid/a.jpg`)).toBe(true);
    expect(isPrivateStorageUrl(`${BASE}/object/public/avatars/uid/a.jpg`)).toBe(false);
    expect(isPrivateStorageUrl("https://example.com/pic.jpg")).toBe(false);
    expect(isPrivateStorageUrl(null)).toBe(false);
    expect(isPrivateStorageUrl(undefined)).toBe(false);
  });
});

describe("getSignedUrl", () => {
  it("signs once and serves repeats from the module cache", async () => {
    const spy = mockCreateSignedUrl(async () => ({ data: { signedUrl: "https://signed/x" }, error: null }));
    const first = await getSignedUrl("proof-photos", "uid/cached.jpg");
    const second = await getSignedUrl("proof-photos", "uid/cached.jpg");
    expect(first).toBe("https://signed/x");
    expect(second).toBe("https://signed/x");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("returns null on signing failure and on empty input", async () => {
    mockCreateSignedUrl(async () => ({ data: null, error: { message: "denied" } }));
    expect(await getSignedUrl("proof-photos", "uid/fail.jpg")).toBeNull();
    expect(await getSignedUrl("proof-photos", "")).toBeNull();
  });
});

describe("useSignedMediaUrl", () => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
      children,
    );

  it("passes public-bucket and external URLs through untouched", () => {
    const pub = `${BASE}/object/public/avatars/uid/a.jpg`;
    const { result } = renderHook(() => useSignedMediaUrl(pub), { wrapper });
    expect(result.current).toBe(pub);
    const ext = renderHook(() => useSignedMediaUrl("https://example.com/p.jpg"), { wrapper });
    expect(ext.result.current).toBe("https://example.com/p.jpg");
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it("returns null for empty input", () => {
    const { result } = renderHook(() => useSignedMediaUrl(null), { wrapper });
    expect(result.current).toBeNull();
  });

  it("signs private-bucket URLs with the transform baked in", async () => {
    const spy = mockCreateSignedUrl(async () => ({ data: { signedUrl: "https://signed/t" }, error: null }));
    const { result } = renderHook(
      () => useSignedMediaUrl(`${BASE}/object/public/proof-photos/uid/a.jpg`, { width: 100, quality: 60 }),
      { wrapper },
    );
    expect(result.current).toBeNull(); // resolving
    await waitFor(() => expect(result.current).toBe("https://signed/t"));
    // Retina 2× width travels inside the signature options.
    expect(spy).toHaveBeenCalledWith("uid/a.jpg", expect.any(Number), {
      transform: { width: 200, quality: 60, resize: "cover" },
    });
  });

  it("falls back to a plain signature when the transform sign fails", async () => {
    const spy = mockCreateSignedUrl(async (...args: unknown[]) =>
      args[2]
        ? { data: null, error: { message: "transform failed" } }
        : { data: { signedUrl: "https://signed/plain" }, error: null },
    );
    const { result } = renderHook(
      () => useSignedMediaUrl(`${BASE}/object/public/feed-images/uid/v.jpg`, { width: 50 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current).toBe("https://signed/plain"));
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
