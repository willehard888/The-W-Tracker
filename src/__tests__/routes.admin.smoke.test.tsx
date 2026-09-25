import { auth, fakeProfile } from "@/test/route-mocks";
import { chain, supabase } from "@/test/supabase-stub";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { setMode, STUB_ERROR, type StubMode } from "@/test/supabase-stub";
import { mountRoute, watchConsole } from "@/test/mount-route";

import AdminMetrics from "@/pages/AdminMetrics";
import AdminModeration from "@/pages/AdminModeration";
import AdminLegendInvites from "@/pages/AdminLegendInvites";

// The three admin pages. Each asks has_role first; an admin sees the page,
// anybody else is sent home. Both answers must mount without a console error.
type Row = { path: string; pattern: string; page: React.ComponentType; expect: RegExp | string; admin: boolean };

const ROWS: Row[] = [
  { path: "/admin/metrics", pattern: "/admin/metrics", page: AdminMetrics, expect: /metrics/i, admin: true },
  { path: "/admin/metrics", pattern: "/admin/metrics", page: AdminMetrics, expect: "redirected", admin: false },
  { path: "/admin/moderation", pattern: "/admin/moderation", page: AdminModeration, expect: /moderation queue/i, admin: true },
  { path: "/admin/moderation", pattern: "/admin/moderation", page: AdminModeration, expect: "redirected", admin: false },
  { path: "/admin/legend-invites", pattern: "/admin/legend-invites", page: AdminLegendInvites, expect: /legend invites/i, admin: true },
  { path: "/admin/legend-invites", pattern: "/admin/legend-invites", page: AdminLegendInvites, expect: "redirected", admin: false },
];

describe.each<StubMode>(["empty", "error"])("admin routes mount cleanly (%s data)", (mode) => {
  let watch: ReturnType<typeof watchConsole>;
  beforeEach(() => { setMode(mode); auth.isElite = true; auth.profile = fakeProfile(); watch = watchConsole(); });
  afterEach(() => { watch.stop(); cleanup(); });

  it.each(ROWS)("$path (admin: $admin)", async ({ path, pattern, page, expect: expected, admin }) => {
    // has_role answers first; every later rpc falls back to the stub's mode.
    supabase.rpc.mockImplementationOnce(() => chain({ data: admin, error: null }));
    mountRoute(pattern, path, page);
    await waitFor(() => {
      const found =
        screen.queryAllByTestId(expected).length > 0 ||
        screen.queryAllByText(expected).length > 0 ||
        screen.queryAllByRole("heading", { name: expected }).length > 0;
      expect(found).toBe(true);
    }, { timeout: 4000 });
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(watch.errors.filter((e) => !(mode === "error" && e.includes(STUB_ERROR)))).toEqual([]);
  });
});
