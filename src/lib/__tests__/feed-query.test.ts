import { describe, expect, it, vi, beforeEach } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { fetchFeedPosts } from "@/lib/feed-query";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

/** Thenable query-builder stub: every method chains, awaiting resolves. */
const chain = (result: unknown) => {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "gt", "in", "or", "not", "order", "limit"]) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  (b as { then?: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return b;
};

beforeEach(() => vi.clearAllMocks());

describe("fetchFeedPosts", () => {
  it("joins author profiles onto posts and hides reported by default", async () => {
    const posts = [
      { id: "p1", user_id: "u1", content: "a" },
      { id: "p2", user_id: "u2", content: "b" },
    ];
    const profiles = [
      { user_id: "u1", username: "one" },
      { user_id: "u2", username: "two" },
    ];
    const postsChain = chain({ data: posts });
    const profilesChain = chain({ data: profiles });
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) =>
      table === "feed_posts" ? postsChain : profilesChain,
    );

    const out = await fetchFeedPosts(false);
    expect(out).toHaveLength(2);
    expect(out[0].profile.username).toBe("one");
    expect(out[1].profile.username).toBe("two");
    // reported=false filter applied on the posts query
    expect(postsChain.eq).toHaveBeenCalledWith("reported", false);
  });

  it("skips the reported filter for admins viewing reported posts", async () => {
    const postsChain = chain({ data: [] });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);

    const out = await fetchFeedPosts(true);
    expect(out).toEqual([]);
    expect(postsChain.eq).not.toHaveBeenCalledWith("reported", false);
  });

  it("returns [] when the posts query yields nothing", async () => {
    const postsChain = chain({ data: null });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);
    expect(await fetchFeedPosts(false)).toEqual([]);
  });
});
