import "@/test/route-mocks";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { setMode, STUB_ERROR, type StubMode } from "@/test/supabase-stub";
import { mountRoute, watchConsole } from "@/test/mount-route";

import Leaderboard from "@/pages/Leaderboard";
import Battles from "@/pages/Battles";
import Profile from "@/pages/Profile";
import BadgeCompare from "@/pages/BadgeCompare";
import BlockedUsers from "@/pages/BlockedUsers";
import NotificationSettings from "@/pages/NotificationSettings";

// Ranks, profile, settings — see routes.home-squad for what a row asserts.
type Row = { path: string; pattern: string; page: React.ComponentType; expect: RegExp | string };

const ROWS: Row[] = [
  { path: "/leaderboard", pattern: "/leaderboard", page: Leaderboard, expect: /board/i },
  { path: "/battles", pattern: "/battles", page: Battles, expect: /battles/i },
  { path: "/profile", pattern: "/profile", page: Profile, expect: /account menu/i },
  { path: "/badges/compare", pattern: "/badges/compare", page: BadgeCompare, expect: /badge/i },
  { path: "/badges/compare?with=u2", pattern: "/badges/compare", page: BadgeCompare, expect: /badge/i },
  { path: "/settings/blocked", pattern: "/settings/blocked", page: BlockedUsers, expect: /blocked/i },
  { path: "/settings/notifications", pattern: "/settings/notifications", page: NotificationSettings, expect: /notification/i },
];

describe.each<StubMode>(["empty", "error"])("profile and ranks routes mount cleanly (%s data)", (mode) => {
  let watch: ReturnType<typeof watchConsole>;
  beforeEach(() => { setMode(mode); watch = watchConsole(); });
  afterEach(() => { watch.stop(); cleanup(); });

  it.each(ROWS)("$path", async ({ path, pattern, page, expect: expected }) => {
    mountRoute(pattern, path, page);
    await waitFor(() => {
      const found =
        screen.queryAllByLabelText(expected).length > 0 ||
        screen.queryAllByText(expected).length > 0 ||
        screen.queryAllByRole("button", { name: expected }).length > 0;
      expect(found).toBe(true);
    }, { timeout: 4000 });
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(watch.errors.filter((e) => !(mode === "error" && e.includes(STUB_ERROR)))).toEqual([]);
  });
});
