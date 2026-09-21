import "@/test/route-mocks";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { setMode, STUB_ERROR, type StubMode } from "@/test/supabase-stub";
import { mountRoute, watchConsole } from "@/test/mount-route";

import Index from "@/pages/Index";
import DailyCheckin from "@/pages/DailyCheckin";
import Squad from "@/pages/Squad";
import TribeNew from "@/pages/TribeNew";
import TribeLeaderboard from "@/pages/TribeLeaderboard";
import TribeDetail from "@/pages/TribeDetail";
import TribeBattles from "@/pages/TribeBattles";
import Notifications from "@/pages/Notifications";
import Messages from "@/pages/Messages";
import Friends from "@/pages/Friends";
import Chat from "@/pages/Chat";
import UserProfile from "@/pages/UserProfile";
import Referrals from "@/pages/Referrals";

/**
 * Every member-facing route, mounted the way the app mounts it, in the two
 * states the network can put it in: an empty account, and a failed load.
 *
 * A page passes when it renders the thing it is for and stays silent — no
 * thrown render, no React warning, no rejected promise from an effect. This
 * is the guard the app never had: seventy routes and nothing that opened
 * them all, so a page could crash on mount for weeks before anyone with the
 * right data reached it.
 */

type Row = { path: string; pattern: string; page: React.ComponentType; expect: RegExp | string };

const ROWS: Row[] = [
  { path: "/", pattern: "/", page: Index, expect: "Open Ranks" },
  { path: "/checkin", pattern: "/checkin", page: DailyCheckin, expect: "Customize habits" },
  { path: "/squad", pattern: "/squad", page: Squad, expect: /^messages$/i },
  { path: "/squad?tab=tribes", pattern: "/squad", page: Squad, expect: /^messages$/i },
  { path: "/tribes/new", pattern: "/tribes/new", page: TribeNew, expect: /back/i },
  { path: "/tribes/leaderboard", pattern: "/tribes/leaderboard", page: TribeLeaderboard, expect: /back/i },
  { path: "/tribes/t1", pattern: "/tribes/:id", page: TribeDetail, expect: /back/i },
  { path: "/tribes/t1/battles", pattern: "/tribes/:id/battles", page: TribeBattles, expect: /back/i },
  { path: "/notifications", pattern: "/notifications", page: Notifications, expect: /back/i },
  { path: "/messages", pattern: "/messages", page: Messages, expect: /back/i },
  { path: "/friends", pattern: "/friends", page: Friends, expect: /back/i },
  { path: "/chat/u2", pattern: "/chat/:partnerId", page: Chat, expect: /back/i },
  { path: "/user/u2", pattern: "/user/:userId", page: UserProfile, expect: /back/i },
  { path: "/referrals", pattern: "/referrals", page: Referrals, expect: /back/i },
];

describe.each<StubMode>(["empty", "error"])("routes mount cleanly (%s data)", (mode) => {
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
    // Let effects that fire after first paint settle before judging silence.
    await act(() => new Promise((r) => setTimeout(r, 50)));
    // A page is allowed to log the failed load it was handed; anything else
    // — a thrown render, a React warning, a rejected effect — is a defect.
    expect(watch.errors.filter((e) => !(mode === "error" && e.includes(STUB_ERROR)))).toEqual([]);
  });
});
