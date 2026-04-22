import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/platform";
import { clearAppleAuthStarted, clearAppleUsernameSelectionPending, isAppleAuthStarted, markAppleUsernameSelectionPending } from "@/lib/apple-username";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
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
  const [isElite, setIsElite] = useState(false);
  const [isApexSubscriber, setIsApexSubscriber] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);

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

  const fetchProfile = async (authUser: User) => {
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
    setIsElite(Boolean(data?.is_elite));
    setIsApexSubscriber(Boolean((data as any)?.is_apex_subscriber));

    if (shouldForceAppleUsernameSetup(authUser, data)) {
      if (!data?.username || data.username === buildFallbackUsername(authUser)) {
        clearAppleAuthStarted();
        markAppleUsernameSelectionPending();
        return;
      }
    }

    clearAppleAuthStarted();
    clearAppleUsernameSelectionPending();
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user);
  };

  const checkSubscription = useCallback(async () => {
    if (isNativePlatform()) {
      if (user) await fetchProfile(user);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) {
        console.error("check-subscription error:", error);
        return;
      }
      if (data?.subscribed) {
        setIsElite(true);
        setSubscriptionEnd(data.subscription_end);
      } else if (data && !data.error) {
        setIsElite(false);
        setSubscriptionEnd(null);
      }
      // Refresh profile to get synced is_elite
      if (user) await fetchProfile(user);
    } catch (e) {
      console.error("Failed to check subscription:", e);
    }
  }, [user]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user), 0);
        } else {
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

  // Check subscription on login and periodically
  useEffect(() => {
    if (!user) return;
    checkSubscription();
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

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
    <AuthContext.Provider value={{ user, session, profile, loading, isElite, isApexSubscriber, subscriptionEnd, checkSubscription, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
