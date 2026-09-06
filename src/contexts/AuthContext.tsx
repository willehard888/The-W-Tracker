import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { track, FUNNEL } from "@/lib/analytics";
import { identifyUser, resetIdentity, captureException } from "@/lib/observability";
import { uniqueChannelName } from "@/lib/realtime";
import { sameProfile } from "@/lib/profile-diff";
import { clearIosDebug } from "@/lib/ios-debug";
import { HEALTH_CONSENT_KEY, MEAL_WRITE_CONSENT_KEY } from "@/lib/health/health-consent";
import { queryClient } from "@/lib/query-client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Tables<"profiles"> | null;
  loading: boolean;
  isElite: boolean;
  /** Alias of isElite — some legacy call sites read `isPremium`. */
  isPremium: boolean;
  /** Always true for any logged-in user after the paywall removal. */
  isApexSubscriber: boolean;
  /** Mirrors `loading` so legacy `subscriptionLoading` reads keep working. */
  subscriptionLoading: boolean;
  subscriptionEnd: string | null;
  checkSubscription: () => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isElite, setIsElite] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);

  // Guards against concurrent fetchProfile calls for the same user.
  const fetchingProfileFor = useRef<string | null>(null);
  // Shared in-flight promise so concurrent callers (getSession +
  // onAuthStateChange both firing on boot) await the SAME fetch instead of
  // one returning instantly and settling `loading` before profile is set.
  const profilePromiseRef = useRef<Promise<void> | null>(null);

  const ensureProfile = async (authUser: User) => {
    // Safety net for the (should-never-happen) case where handle_new_user
    // didn't create a profile. NEVER derive a name from the email — a neutral
    // placeholder + the auto flag routes the user to the username picker.
    const username = `athlete_${authUser.id.slice(0, 6)}`;

    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: authUser.id,
        username,
        username_is_auto: true,
        referral_code: `${username}_${authUser.id.slice(0, 6)}`.slice(0, 20),
      },
      { onConflict: "user_id" },
    );
    // A silent failure here leaves profile null forever — the user is signed
    // in but locked out with no signal. Report it so it's visible in prod.
    if (error) captureException(error, { where: "ensureProfile" });
  };

  const fetchProfile = (authUser: User): Promise<void> => {
    // Deduplicate concurrent calls for the same user — return the SAME
    // in-flight promise so every caller awaits the actual completion.
    if (fetchingProfileFor.current === authUser.id && profilePromiseRef.current) {
      return profilePromiseRef.current;
    }
    fetchingProfileFor.current = authUser.id;

    const run = (async () => {
      try {
        const first = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", authUser.id)
          .maybeSingle();
        if (first.error) captureException(first.error, { where: "fetchProfile" });
        let data = first.data;

        if (!data) {
          // Zombie-session guard: if the stored JWT points at an auth user
          // that no longer exists (account deleted on another device, or via
          // the dashboard), every query 401s, profile stays null forever and
          // the app renders black screens. Detect it and sign out so the
          // user lands on /landing instead of a void.
          const { error: userErr } = await supabase.auth.getUser();
          if (userErr) {
            await supabase.auth.signOut().catch(() => null);
            return;
          }
          await ensureProfile(authUser);
          const retry = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", authUser.id)
            .maybeSingle();

          data = retry.data ?? null;
        }

        // Funnel step 1 — fire on the user's FIRST session, detected from the
        // auth user's created_at (the old "!data" branch never fired: the
        // handle_new_user trigger guarantees the profile exists, so the funnel
        // had no denominator). localStorage-deduped like trial_started.
        try {
          const createdAt = new Date(authUser.created_at ?? 0).getTime();
          if (Number.isFinite(createdAt) && Date.now() - createdAt < 10 * 60_000) {
            const key = `signup_tracked_${authUser.id}`;
            if (!localStorage.getItem(key)) {
              localStorage.setItem(key, "1");
              void track(FUNNEL.signup, undefined, authUser.id);
            }
          }
        } catch { /* analytics is never load-bearing */ }

        // Keep the previous object when nothing rendered changed — the
        // 5-minute refetch and heartbeat columns used to re-render every
        // profile consumer on Home for no visible reason.
        setProfile((prev) => (prev && data && sameProfile(prev, data) ? prev : data));
        setIsElite(Boolean(data?.is_elite));
        // The username picker gate is DB-driven now: ProtectedRoute reads
        // profiles.username_is_auto straight off this profile — no
        // sessionStorage flags, no fallback-string comparisons.
      } finally {
        fetchingProfileFor.current = null;
        profilePromiseRef.current = null;
      }
    })();

    profilePromiseRef.current = run;
    return run;
  };

  // Stable identities: both read the CURRENT user through a ref, so the
  // context value (and every consumer memo keyed on it) survives the hourly
  // token refresh that mints a new `user` object.
  const userRef = useRef(user);
  userRef.current = user;
  const refreshProfile = useCallback(async () => {
    if (userRef.current) await fetchProfile(userRef.current);
    // fetchProfile relies only on stable refs/setters; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSubscription = useCallback(async () => {
    // Subscription state lives in RevenueCat and lands on the profile row via
    // revenuecat-webhook — a profile refetch IS the subscription check, on
    // every platform. (The old web branch called the Stripe-only
    // check-subscription edge function; it was removed with the dormant
    // Stripe path, which also ended its eternal 5-minute error loop in web
    // sessions.)
    if (userRef.current) await fetchProfile(userRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;

    // Apply a session and settle `loading` ONLY after the profile fetch has
    // resolved. Otherwise consumers briefly see loading=false with a null
    // profile, which makes `effectiveMembership` (user && profile) flash false
    // and flickers premium UI as locked on every cold start.
    const applySession = async (session: Session | null) => {
      if (!active) return;
      setSession(session);
      setUser(session?.user ?? null);
      // Tie analytics + error reports to the user (no-op until observability configured).
      if (session?.user) identifyUser(session.user.id);
      else resetIdentity();
      try {
        if (session?.user) {
          // Never let a hung network request keep the splash up forever.
          // fetchProfile keeps running in the background and updates the
          // profile when it eventually resolves; the race only unblocks the UI.
          await Promise.race([
            fetchProfile(session.user),
            new Promise((resolve) => setTimeout(resolve, 8000)),
          ]);
        } else {
          setProfile(null);
          setIsElite(false);
          setSubscriptionEnd(null);
        }
      } catch (e) {
        // CRITICAL: never let a profile-fetch failure leave loading=true
        // forever — that strands the app on a blank splash (white/black screen
        // of death). Log it and fall through so the UI still renders; the user
        // lands on the app shell / paywall / login instead of an empty screen.
        console.error("[Auth] applySession failed — proceeding so the app can render:", e);
      } finally {
        if (active) setLoading(false);
      }
    };

    // Subscribe FIRST so no auth event between subscribe and getSession is
    // missed. Defer the async work out of the callback (Supabase guidance:
    // never await Supabase calls directly inside onAuthStateChange).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setTimeout(() => { void applySession(session); }, 0);
      },
    );

    // Then hydrate the persisted session for the first paint.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        void applySession(session);
      })
      .catch((e) => {
        // Cold-start network failure: don't leave an unhandled rejection or a
        // stuck splash — render the app shell. onAuthStateChange will still
        // deliver the real session if/when it arrives.
        console.error("[Auth] getSession failed on cold start — rendering shell:", e);
        void applySession(null);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Real-time status: when the server updates THIS user's profile (status_tier,
  // xp, streak, level after a check-in or tier recompute), reflect it instantly
  // everywhere — header, gates, gold name — with no manual refresh. Falls back
  // silently if `profiles` isn't in the realtime publication.
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    const channel = supabase
      // uniqueChannelName: a duplicate static name at the app ROOT throws
      // "cannot add postgres_changes callbacks after subscribe()" and takes
      // down the whole app through ErrorBoundary (see lib/realtime docblock).
      .channel(uniqueChannelName("profile-rt", uid))
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${uid}` },
        (payload) => {
          // An UPDATE payload on `profiles` carries the full row.
          const next = payload.new as Tables<"profiles">;
          setProfile((prev) => {
            if (!prev) return next;
            const merged = { ...prev, ...next };
            return sameProfile(prev, merged) ? prev : merged;
          });
          if ("is_elite" in next) setIsElite(Boolean(next.is_elite));
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  // Check subscription on login and periodically (every 5 minutes).
  // The immediate call on login is intentional — it syncs is_elite fast.
  // The interval is kept long to avoid hammering the edge function.
  // Keyed on the stable user ID, not the user OBJECT — Supabase mints a new
  // object identity on every token refresh (~hourly), which reset this
  // interval and fired an immediate extra check-subscription each time.
  // checkSubscription is intentionally omitted from deps: its identity churns
  // with `user` but its behavior only depends on user.id.
  const checkSubUserId = user?.id;
  useEffect(() => {
    if (!checkSubUserId) return;
    checkSubscription();
    const interval = setInterval(checkSubscription, 5 * 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkSubUserId]);

  // Referral capture — /auth?ref= stores the code in localStorage, and THIS
  // is the only place that ever claims it (the code used to be written and
  // then forgotten: no referrals row was ever created through the product).
  // Runs once per user per session, after the profile has loaded, so it works
  // for email AND Apple sign-in and survives OAuth redirects.
  const claimAttemptedFor = useRef<string | null>(null);
  useEffect(() => {
    const uid = user?.id;
    if (!uid || !profile) return;
    if (claimAttemptedFor.current === uid) return;
    let code: string | null = null;
    try { code = localStorage.getItem("pending_referral_code"); } catch { return; }
    if (!code) return;
    claimAttemptedFor.current = uid;
    if (profile.referred_by || code === profile.referral_code) {
      try { localStorage.removeItem("pending_referral_code"); } catch { /* noop */ }
      return;
    }
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("claim_referral", { p_referrer_code: code! });
        // Terminal outcomes (claimed / invalid / already referred) clear the
        // key; a network error keeps it so the next session retries.
        if (!error) {
          try { localStorage.removeItem("pending_referral_code"); } catch { /* noop */ }
          if ((data as { success?: boolean } | null)?.success) {
            // referral_joined analytics + the referrer push both come from the
            // DB trigger on the referrals INSERT — nothing more to log here.
            await fetchProfile(user!);
          }
        }
      } catch { /* retry next session */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile]);

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // SECURITY: purge all local identity/token-bearing state so a shared or
    // kiosk device doesn't leak the previous user's data to the next.
    clearIosDebug(); // held a refresh token in plaintext (localStorage)
    try {
      [
        "w_onboarding_done", "pending_referral_code", "w_coach_onboard_skipped",
        // Health/mood data and the offline check-in payload are per-user but
        // stored under global keys — clear them so the next account on a shared
        // device never inherits the previous user's data.
        "w_coach_messages_v1", "w_coach_messages_v1_ts",
        "w_coach_onboarding_draft_v2", "w_coach_onboarding_step_v2",
        "pending_checkin_v1",
        // Health consent is device-scoped like the iOS permission itself, but
        // it must not survive a sign-out: otherwise the next account on a
        // shared device silently background-syncs the previous owner's health
        // data under their own name.
        HEALTH_CONSENT_KEY,
        MEAL_WRITE_CONSENT_KEY,
      ].forEach(
        (k) => localStorage.removeItem(k),
      );
      sessionStorage.removeItem("w_apple_name_suggestion");
    } catch { /* storage unavailable */ }
    queryClient.clear(); // drop cached profile/feed/tribe queries
    setProfile(null);
    setIsElite(false);
    setSubscriptionEnd(null);
  }, []);

  // Real membership = an active paid entitlement (isElite, set from RevenueCat /
  // profile.is_elite by checkSubscription + the realtime sub), OR referral free
  // credits, OR an apex subscriber, OR a pinned Legend (Founders Circle).
  // This is what gates the whole app behind the 8,99 €/mo subscription
  // (ProtectedRoute in App.tsx: membership OR live 14-day trial passes).
  //
  // CRITICAL: gate on `profile !== null` (not just `user !== null`) —
  // consumers that read `isElite` pair it with profile data reads, and
  // isElite=true with a null profile crashes premium renders.
  const creditsActive =
    !!profile?.membership_credits_until &&
    new Date(profile.membership_credits_until).getTime() > Date.now();
  const effectiveMembership =
    profile !== null &&
    (isElite || creditsActive || profile.is_apex_subscriber === true || profile.legend_pinned === true);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      profile,
      loading,
      isElite: effectiveMembership,
      isPremium: effectiveMembership,
      isApexSubscriber: profile?.is_apex_subscriber === true,
      subscriptionLoading: loading,
      subscriptionEnd,
      checkSubscription,
      signUp,
      signIn,
      signOut,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      loading,
      effectiveMembership,
      subscriptionEnd,
      checkSubscription,
      signUp,
      signIn,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
