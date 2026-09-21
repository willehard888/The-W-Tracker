// What a page needs to believe in order to mount in jsdom: a signed-in
// member with an active membership, a Supabase that answers, and no native
// side effects. Imported by the route smoke tests; per-page tests keep their
// own narrower mocks.
//
// Imports here are hoisted by vitest, so this file must be imported before
// the page under test.
import { vi } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { supabase, fakeUser, fakeSession } from "./supabase-stub";

export const fakeProfile = (over: Partial<Tables<"profiles">> = {}): Tables<"profiles"> => ({
  id: "p1",
  user_id: "u1",
  username: "qa_member",
  username_is_auto: false,
  display_name: "QA Member",
  avatar_url: null,
  ai_consent_at: "2026-09-01T00:00:00Z",
  ai_consent_version: 1,
  apex_credits_until: null,
  apex_subscription_started_at: null,
  checkin_habits: null,
  created_at: "2026-07-01T00:00:00Z",
  featured_badge_id: null,
  is_apex_subscriber: false,
  is_elite: true,
  is_premium: true,
  last_active_at: null,
  last_rank_snapshot: null,
  legend_pinned: false,
  level: 3,
  longest_streak: 4,
  membership_credits_until: null,
  notification_prefs: {},
  nutrition_prefs: {},
  onboarded_at: "2026-07-01T00:00:00Z",
  onboarding_state: { status: "done" },
  rank_score: 42,
  rank_score_updated_at: "2026-09-20T00:00:00Z",
  referral_code: "QA1234",
  referral_count: 0,
  referral_milestones_hit: [],
  referred_by: null,
  status_tier: "recruit" as Tables<"profiles">["status_tier"],
  streak: 2,
  streak_shields: 0,
  tier_division: 1,
  timezone: "Europe/Helsinki",
  trial_started_at: "2026-07-01T00:00:00Z",
  trust_multiplier: 1,
  updated_at: "2026-09-20T00:00:00Z",
  utc_offset_minutes: 180,
  xp: 1200,
  ...over,
});

/** Mutable so a single route row can flip membership or the username gate. */
export const auth = {
  profile: fakeProfile(),
  isElite: true,
};

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: fakeUser,
    session: fakeSession,
    profile: auth.profile,
    loading: false,
    isElite: auth.isElite,
    isPremium: auth.isElite,
    isApexSubscriber: false,
    subscriptionLoading: false,
    checkSubscription: async () => {},
    signOut: async () => {},
    refreshProfile: async () => {},
  }),
  AuthProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/contexts/RevenueCatContext", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/contexts/RevenueCatContext")>();
  return {
    ...real,
    useRevenueCat: () => ({
      rcElite: false,
      rcLoading: false,
      rcReady: true,
      monthlyPriceLabel: "8,99 €",
      yearlyPriceLabel: "89,99 €",
      yearlyAvailable: true,
      packages: [],
      purchase: async () => ({ cancelled: true, sandbox: null }),
      purchaseProduct: async () => ({ cancelled: true, sandbox: null }),
      purchasePremiumPlan: async () => ({ cancelled: true, sandbox: null }),
      restorePurchases: async () => ({ restored: false }),
    }),
  };
});

vi.mock("@/lib/haptics", () => ({
  hapticImpact: () => {},
  hapticSelection: () => {},
  hapticNotification: () => {},
}));

vi.mock("@/lib/analytics", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...real, track: async () => {}, trackAnon: async () => {} };
});

vi.mock("@/lib/observability", () => ({
  captureException: () => {},
  captureEvent: () => {},
  identifyUser: () => {},
  resetIdentity: () => {},
  initObservability: () => {},
}));
