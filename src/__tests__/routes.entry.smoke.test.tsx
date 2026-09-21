import { auth, fakeProfile } from "@/test/route-mocks";
import { chain, supabase } from "@/test/supabase-stub";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { setMode, STUB_ERROR, type StubMode } from "@/test/supabase-stub";
import { mountRoute, watchConsole } from "@/test/mount-route";

import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Onboarding from "@/pages/Onboarding";
import ChooseUsername from "@/pages/ChooseUsername";
import Paywall from "@/pages/Paywall";
import ResetPassword from "@/pages/ResetPassword";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfUse from "@/pages/TermsOfUse";
import NotFound from "@/pages/NotFound";
import PublicProfile from "@/pages/PublicProfile";

// Entry flows. Some of these only render for a member in a particular
// state (a member who already pays is sent home from the paywall, a member
// with a chosen name is sent home from the username screen), so a row can
// set the auth the page must see.
type Row = {
  path: string;
  pattern: string;
  page: React.ComponentType;
  expect: RegExp | string;
  as?: () => void;
};

const member = () => { auth.isElite = true; auth.profile = fakeProfile(); };

const ROWS: Row[] = [
  { path: "/landing", pattern: "/landing", page: Landing, expect: /legal/i },
  { path: "/auth", pattern: "/auth", page: Auth, expect: /password/i },
  { path: "/auth?mode=signup", pattern: "/auth", page: Auth, expect: /password/i },
  { path: "/onboarding", pattern: "/onboarding", page: Onboarding, expect: /welcome to whealth factory/i },
  {
    path: "/choose-username", pattern: "/choose-username", page: ChooseUsername, expect: /claim your name/i,
    as: () => { auth.profile = fakeProfile({ username_is_auto: true }); },
  },
  {
    path: "/paywall", pattern: "/paywall", page: Paywall, expect: /terms of use/i,
    as: () => { auth.isElite = false; auth.profile = fakeProfile({ is_elite: false, is_premium: false }); },
  },
  // A paying member has no business here and is sent home.
  { path: "/paywall", pattern: "/paywall", page: Paywall, expect: "redirected" },
  // Without a recovery token in the hash the page can only say the link is gone.
  { path: "/reset-password", pattern: "/reset-password", page: ResetPassword, expect: /link has expired/i },
  {
    // The public RPC answers one JSON object or null — never a list.
    path: "/u/someone", pattern: "/u/:username", page: PublicProfile, expect: /not found|couldn't load/i,
    as: () => { supabase.rpc.mockReturnValueOnce(chain({ data: null, error: null })); },
  },
  { path: "/privacy", pattern: "/privacy", page: PrivacyPolicy, expect: /privacy policy/i },
  { path: "/terms", pattern: "/terms", page: TermsOfUse, expect: /terms of use/i },
  { path: "/no/such/route", pattern: "*", page: NotFound, expect: /nothing here/i },
];

describe.each<StubMode>(["empty", "error"])("entry routes mount cleanly (%s data)", (mode) => {
  let watch: ReturnType<typeof watchConsole>;
  beforeEach(() => { setMode(mode); member(); watch = watchConsole(); });
  afterEach(() => { watch.stop(); cleanup(); });

  it.each(ROWS)("$path", async ({ path, pattern, page, expect: expected, as }) => {
    as?.();
    mountRoute(pattern, path, page);
    await waitFor(() => {
      const found =
        screen.queryAllByTestId(expected).length > 0 ||
        screen.queryAllByLabelText(expected).length > 0 ||
        screen.queryAllByText(expected).length > 0 ||
        screen.queryAllByRole("button", { name: expected }).length > 0;
      expect(found).toBe(true);
    }, { timeout: 4000 });
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(watch.errors.filter((e) => !(mode === "error" && e.includes(STUB_ERROR)))).toEqual([]);
  });
});
