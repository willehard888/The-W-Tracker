import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/platform";
import { track, FUNNEL } from "@/lib/analytics";
import { identifyUser, resetIdentity, captureException } from "@/lib/observability";
import { uniqueChannelName } from "@/lib/realtime";
import { clearAppleAuthStarted, clearAppleUsernameSelectionPending, isAppleAuthStarted, markAppleUsernameSelectionPending } from "@/lib/apple-username";
import { clearIosDebug } from "@/lib/ios-debug";
import { queryClient } from "@/lib/query-client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
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
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isElite, setIsElite] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);

  // Guards against concurrent fetchProfile calls for the same user.
  const fetchingProfileFor = useRef<string | null>(null);
  // Shared in-flight promise so concurrent callers (getSession +
  // onAuthStateChange both firing on boot) await the SAME fetch instead of
  // one returning instantly and settling `loading` before profile is set.
  const profilePromiseRef = useRef<Promise<void> | null>(null);

  const buildFallbackUsername = (authUser: User) => {
    const rawUsername = String(
      authUser.user_metadata?.username ?? authUser.email?.split("@")[0] ?? "user",
    )
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const base = rawUsername || "user";
    return `${base.slice(0, 13)}_${authUser.id.slice(0, 6)}`.slice(0, 20);
  };

  const ensureProfile = async (authUser: User) => {
    const username = buildFallbackUsername(authUser);

    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: authUser.id,
        username,
        referral_code: `${username}_${authUser.id.slice(0, 6)}`.slice(0, 20),
      },
      { onConflict: "user_id" },
    );
    // A silent failure here leaves profile null forever — the user is signed
    // in but locked out with no signal. Report it so it's visible in prod.
    if (error) captureException(error, { where: "ensureProfile" });
  };

  const isAppleUserProfile = (authUser: User) => {
    const provider = authUser.app_metadata?.provider;
    const providers = Array.isArray(authUser.app_metadata?.providers) ? authUser.app_metadata.providers : [];
    return provider === "apple" || providers.includes("apple");
  };

  const shouldForceAppleUsernameSetup = (authUser: User, nextProfile: any | null) => {
    if (!isAppleAuthStarted()) return false;

    const isAppleUser = isAppleUserProfile(authUser);
    const username = nextProfile?.username?.trim?.() || "";
    const fallbackUsername = buildFallbackUsername(authUser);

    return isAppleUser && (!username || username === fallbackUsername);
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

        setProfile(data);
        setIsElite(Boolean(data?.is_elite));

        if (shouldForceAppleUsernameSetup(authUser, data)) {
          if (!data?.username || data.username === buildFallbackUsername(authUser)) {
            clearAppleAuthStarted();
            markAppleUsernameSelectionPending();
            return;
          }
        }

        clearAppleAuthStarted();
        // Only dismiss the username picker once the user actually has a CHOSEN
        // (non-fallback) username. Without this guard, a follow-up auth event
        // fired right after Apple sign-in — e.g. the updateUser() that persists
        // Apple's name to metadata — would re-run this fetch with the started
        // flag already cleared, fall through here, and silently cancel a picker
        // we just queued, dumping the user in with an auto-generated name.
        const hasChosenUsername =
          !!data?.username && data.username !== buildFallbackUsername(authUser);
        if (hasChosenUsername || !isAppleUserProfile(authUser)) {
          clearAppleUsernameSelectionPending();
        }
      } finally {
        fetchingProfileFor.current = null;
        profilePromiseRef.current = null;
      }
    })();

    profilePromiseRef.current = run;
    return run;
  };

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user);
    // fetchProfile relies only on stable refs/setters; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const checkSubscription = useCallback(async () => {
    if (isNativePlatform()) {
      // On native, subscription state lives in RevenueCat; fetchProfile syncs it.
      if (user) await fetchProfile(user);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) {
        console.error("check-subscription error:", error);
        return;
      }
      // Update subscription state directly from the edge-function response —
      // no need to re-fetch the full profile here (fetchProfile was already
      // called on login and is called by the 5-minute refresh interval).
      if (data?.subscribed) {
        setIsElite(true);
        setSubscriptionEnd(data.subscription_end);
      } else if (data && !data.error) {
        setIsElite(false);
        setSubscriptionEnd(null);
      }
    } catch (e) {
      console.error("Failed to check subscription:", e);
    }
  }, [user]);

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
          const next = payload.new as Record<string, unknown>;
          setProfile((prev: any) => (prev ? { ...prev, ...next } : next));
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
    clearAppleAuthStarted();
    clearAppleUsernameSelectionPending();
    // SECURITY: purge all local identity/token-bearing state so a shared or
    // kiosk device doesn't leak the previous user's data to the next.
    clearIosDebug(); // held a refresh token in plaintext (localStorage)
    try {
      ["w_onboarding_done", "pending_referral_code", "w_coach_onboard_skipped"].forEach(
        (k) => localStorage.removeItem(k),
      );
      sessionStorage.removeItem("w_apple_name_suggestion");
    } catch { /* storage unavailable */ }
    queryClient.clear(); // drop cached profile/feed/tribe queries
    setProfile(null);
    setIsElite(false);
    setSubscriptionEnd(null);
  }, []);

  // PAYWALL REMOVED — every logged-in user with a loaded profile is treated
  // as Premium / Elite / Apex regardless of the underlying RevenueCat or DB
  // subscription state. The real `isElite` state is still tracked internally
  // for billing UI (e.g. "Manage subscription" on Paywall.tsx) and is
  // readable via the raw `profile` object, but every consumer of the
  // membership flags from this context sees true once profile is loaded.
  //
  // CRITICAL: we gate on `profile !== null` (not just `user !== null`)
  // because components that read `isElite` often pair it with profile data
  // reads (profile.xp, profile.username, etc.). If we said isElite=true
  // while profile was still null they would crash trying to render premium
  // content without the data backing it.
  //
  // To re-introduce the paywall later, change `effectiveMembership` back
  // to the underlying `isElite` state — every consumer reads through this
  // one source of truth so the toggle is a single line.
  // Real membership = an active paid entitlement (isElite, set from RevenueCat /
  // profile.is_elite by checkSubscription + the realtime sub), OR referral free
  // credits, OR an apex subscriber, OR a pinned Legend (Founders Circle).
  // This is what gates the whole app behind the 4.99 €/mo subscription.
  const _p = profile as
    | { membership_credits_until?: string | null; is_apex_subscriber?: boolean; legend_pinned?: boolean }
    | null;
  const creditsActive =
    !!_p?.membership_credits_until && new Date(_p.membership_credits_until).getTime() > Date.now();
  const effectiveMembership =
    profile !== null &&
    (isElite || creditsActive || _p?.is_apex_subscriber === true || _p?.legend_pinned === true);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      profile,
      loading,
      isElite: effectiveMembership,
      isPremium: effectiveMembership,
      isApexSubscriber: _p?.is_apex_subscriber === true,
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
