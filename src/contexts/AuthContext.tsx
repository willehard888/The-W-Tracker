import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/platform";
import { clearAppleAuthStarted, clearAppleUsernameSelectionPending, isAppleAuthStarted, markAppleUsernameSelectionPending } from "@/lib/apple-username";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  subscriptionLoading: boolean;
  isElite: boolean;
  isApexSubscriber: boolean;
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
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [isElite, setIsElite] = useState(false);
  const [isApexSubscriber, setIsApexSubscriber] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const lastFetchedProfileUserId = useRef<string | null>(null);
  const inFlightProfileFetch = useRef<Promise<void> | null>(null);

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

    // IMPORTANT: Use insert (not upsert) so we never overwrite an existing
    // username/referral_code. If a profile row already exists, ignore the
    // duplicate-key error — fetchProfile will re-read whatever is stored.
    const { error } = await supabase.from("profiles").insert({
      user_id: authUser.id,
      username,
      referral_code: `${username}_${authUser.id.slice(0, 6)}`.slice(0, 20),
    });

    if (error && error.code !== "23505") {
      console.warn("ensureProfile insert error:", error);
    }
  };

  const shouldForceAppleUsernameSetup = (authUser: User, nextProfile: any | null) => {
    if (!isAppleAuthStarted()) return false;

    const provider = authUser.app_metadata?.provider;
    const providers = Array.isArray(authUser.app_metadata?.providers) ? authUser.app_metadata.providers : [];
    const isAppleUser = provider === "apple" || providers.includes("apple");
    const username = nextProfile?.username?.trim?.() || "";
    const fallbackUsername = buildFallbackUsername(authUser);

    return isAppleUser && (!username || username === fallbackUsername);
  };

  const tryClaimPendingReferral = async (authUser: User, currentProfile: any | null) => {
    try {
      const code = typeof localStorage !== "undefined" ? localStorage.getItem("pending_referral_code") : null;
      if (!code) return false;
      if (currentProfile?.referred_by) {
        localStorage.removeItem("pending_referral_code");
        return false;
      }
      const { data, error } = await supabase.functions.invoke("claim-referral", {
        body: { code },
      });
      if (error) {
        console.warn("claim-referral invoke error:", error);
        return false;
      }
      const reason = (data as any)?.reason;
      const definitive = (data as any)?.success
        || reason === "self_referral"
        || reason === "already_referred"
        || reason === "duplicate"
        || reason === "invalid_code"
        || reason === "empty_code";
      if (definitive) localStorage.removeItem("pending_referral_code");
      return Boolean((data as any)?.success);
    } catch (e) {
      console.warn("claim-referral failed:", e);
      return false;
    }
  };

  const fetchProfile = async (authUser: User, force = false) => {
    if (!force && lastFetchedProfileUserId.current === authUser.id && inFlightProfileFetch.current) {
      await inFlightProfileFetch.current;
      return;
    }

    const run = (async () => {
    let { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (!data) {
      await ensureProfile(authUser);

      const retry = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", authUser.id)
        .maybeSingle();

      data = retry.data ?? null;
    }

    const claimed = await tryClaimPendingReferral(authUser, data);
    if (claimed) {
      const refreshed = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", authUser.id)
        .maybeSingle();
      data = refreshed.data ?? data;
    }

    setProfile(data);
    // BROADER ELITE DETECTION: any signal of an active paid membership counts.
    // Prevents showing the paywall to users who already paid via Stripe (is_elite),
    // RevenueCat / Apex (is_apex_subscriber), tier promotion (status_tier elite/apex/legend),
    // or admin-granted credits (membership_credits_until / apex_credits_until in the future).
    const now = Date.now();
    const tier = (data as any)?.status_tier;
    const tierIsPaid = tier === "elite" || tier === "apex" || tier === "legend";
    const membershipUntil = (data as any)?.membership_credits_until;
    const apexUntil = (data as any)?.apex_credits_until;
    const hasMembershipCredits = membershipUntil && new Date(membershipUntil).getTime() > now;
    const hasApexCredits = apexUntil && new Date(apexUntil).getTime() > now;
    const nextElite = Boolean(
      data?.is_elite ||
      (data as any)?.is_apex_subscriber ||
      tierIsPaid ||
      hasMembershipCredits ||
      hasApexCredits
    );
    setIsElite(nextElite);
    setIsApexSubscriber(Boolean((data as any)?.is_apex_subscriber) || tier === "apex" || tier === "legend" || hasApexCredits);

    if (shouldForceAppleUsernameSetup(authUser, data)) {
      if (!data?.username || data.username === buildFallbackUsername(authUser)) {
        clearAppleAuthStarted();
        markAppleUsernameSelectionPending();
        return;
      }
    }

    clearAppleAuthStarted();
    clearAppleUsernameSelectionPending();
    lastFetchedProfileUserId.current = authUser.id;
    })();

    inFlightProfileFetch.current = run;
    try {
      await run;
    } finally {
      inFlightProfileFetch.current = null;
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user);
  };

  // Refs hold latest state so checkSubscription identity doesn't change
  // every time isElite/isApexSubscriber updates (which would re-trigger
  // the polling useEffect and cause an infinite request loop on /paywall).
  const isEliteRef = useRef(isElite);
  const isApexRef = useRef(isApexSubscriber);
  const userRef = useRef(user);
  useEffect(() => { isEliteRef.current = isElite; }, [isElite]);
  useEffect(() => { isApexRef.current = isApexSubscriber; }, [isApexSubscriber]);
  useEffect(() => { userRef.current = user; }, [user]);

  const checkSubscription = useCallback(async () => {
    const currentUser = userRef.current;
    if (isNativePlatform()) {
      if (currentUser) await fetchProfile(currentUser);
      return;
    }

    try {
      setSubscriptionLoading(true);

      // Retry once on transient edge-runtime cold-start (503 SUPABASE_EDGE_RUNTIME_ERROR).
      // The function itself returns 200 on Stripe failures — a 503 means the runtime
      // hadn't booted yet, which resolves on the next call.
      let data: any = null;
      let error: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await supabase.functions.invoke("check-subscription");
        data = res.data;
        error = res.error;
        const isTransient =
          error &&
          (error.status === 503 ||
            /temporarily unavailable|EDGE_RUNTIME_ERROR/i.test(String(error.message ?? "")));
        if (!isTransient) break;
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }

      if (error) {
        // Silently tolerate transient runtime errors — UI keeps last-known state.
        const transient =
          error.status === 503 ||
          /temporarily unavailable|EDGE_RUNTIME_ERROR/i.test(String(error.message ?? ""));
        if (!transient) console.error("check-subscription error:", error);
        return;
      }
      // Only trust subscribed:true when a real tier is returned.
      const nextElite = Boolean(data?.subscribed) && data?.tier !== null && data?.tier !== undefined;
      const nextApex = data?.tier === "apex";

      if (data && !data.error) {
        setIsElite(nextElite);
        setSubscriptionEnd(nextElite ? data.subscription_end ?? null : null);
      }

      if (currentUser && (nextElite !== isEliteRef.current || nextApex !== isApexRef.current)) {
        await fetchProfile(currentUser, true);
      }
    } catch (e) {
      console.error("Failed to check subscription:", e);
    } finally {
      setSubscriptionLoading(false);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          if (_event !== "TOKEN_REFRESHED") {
            setTimeout(() => fetchProfile(session.user), 0);
          }
        } else {
          lastFetchedProfileUserId.current = null;
          setProfile(null);
          setIsElite(false);
          setIsApexSubscriber(false);
          setSubscriptionEnd(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check subscription on login and periodically.
  // Only depend on user.id — checkSubscription is now stable (empty deps),
  // and depending on its identity here previously caused an infinite refetch
  // loop on /paywall (Stripe returned subscribed:true → setIsElite → identity
  // change → effect re-ran → new request → repeat).
  useEffect(() => {
    if (!user) return;
    checkSubscription();
    const interval = setInterval(checkSubscription, 300000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const signUp = async (email: string, password: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearAppleAuthStarted();
    clearAppleUsernameSelectionPending();
    setProfile(null);
    setIsElite(false);
    setIsApexSubscriber(false);
    setSubscriptionEnd(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, subscriptionLoading, isElite, isApexSubscriber, subscriptionEnd, checkSubscription, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
