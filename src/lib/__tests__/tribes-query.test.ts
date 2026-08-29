import { describe, expect, it, vi, beforeEach } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { fetchTribesPage, EMPTY_TRIBES_PAGE } from "@/lib/tribes-query";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

const chain = (result: unknown) => {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "gt", "in", "order", "limit", "not"]) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  (b as { then?: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return b;
};

beforeEach(() => vi.clearAllMocks());

const tribe = (over: Record<string, unknown>) => ({
  id: "t1",
  name: "T",
  slug: "t",
  description: null,
  cover_url: null,
  visibility: "public",
  member_count: 3,
  member_cap: 100,
  owner_id: "o",
  primary_activity: null,
  collective_streak: 0,
  weekly_xp: 0,
  fire_tier: -1,
  created_at: "2026-01-01",
  ...over,
});

describe("fetchTribesPage", () => {
  it("browse: filters paused tribes, marks memberships, picks the momentum-featured tribe", async () => {
    const list = [
      tribe({ id: "t1", weekly_xp: 10 }),
      tribe({ id: "t2", weekly_xp: 900, member_count: 5 }),
      tribe({ id: "t3", is_paused: true }),
    ];
    const tables: Record<string, unknown> = {
      tribes: { data: list },
      tribe_members: { data: [{ tribe_id: "t1", role: "owner", status: "active" }] },
      tribe_events: { data: [] },
      tribe_event_rsvps: { data: [] },
      profiles: { data: [{ user_id: "m1", username: "m", avatar_url: null }] },
    };
    let memberCalls = 0;
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "tribe_members") {
        // 1st: my membership rows · 2nd: featured avatar previews
        memberCalls += 1;
        return chain(memberCalls === 1 ? tables.tribe_members : { data: [{ user_id: "m1" }] });
      }
      return chain(tables[table] ?? { data: [] });
    });
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ tribe_id: "t1", checked: 2, total: 3 }],
    });

    const out = await fetchTribesPage("browse", null, "me");
    expect(out.tribes.map((t) => t.id)).toEqual(["t1", "t2"]); // paused dropped
    expect(out.joinedIds.has("t1")).toBe(true);
    expect(out.ownedIds.has("t1")).toBe(true);
    expect(out.featuredId).toBe("t2"); // highest weekly_xp among unjoined
    expect(out.featuredPreviews).toHaveLength(1);
    expect(out.pulse.get("t1")).toEqual({ checked: 2, total: 3 });
  });

  it("mine: returns an empty page shape when the user has no memberships", async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chain({ data: [] }),
    );
    const out = await fetchTribesPage("mine", null, "me");
    expect(out.tribes).toEqual([]);
    expect(out.joinedIds.size).toBe(0);
  });

  it("throws when my membership rows fail to load (browse)", async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "tribes") return chain({ data: [tribe({ id: "t1" })] });
      if (table === "tribe_members") return chain({ error: new Error("boom") });
      return chain({ data: [] });
    });
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    await expect(fetchTribesPage("browse", null, "me")).rejects.toThrow();
  });

  it("EMPTY_TRIBES_PAGE is a stable empty shape", () => {
    expect(EMPTY_TRIBES_PAGE.tribes).toEqual([]);
    expect(EMPTY_TRIBES_PAGE.pulse.size).toBe(0);
  });
});
