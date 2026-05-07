import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
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

    await supabase.from("profiles").upsert(
      {
        user_id: authUser.id,
        username,
        referral_code: `${username}_${authUser.id.slice(0, 6)}`.slice(0, 20),
      },
      { onConflict: "user_id" },
    );
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

  const fetchProfile = async (authUser: User) => {
    // Deduplicate concurrent calls for the same user.
    if (fetchingProfileFor.current === authUser.id) return;
    fetchingProfileFor.current = authUser.id;

    try {
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
      clearAppleUsernameSelectionPending();
    } finally {
      fetchingProfileFor.current = null;
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user);
  };

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
    // getSession resolves synchronously from storage most of the time.
    // onAuthStateChange also fires with the initial session.
    // We call fetchProfile from onAuthStateChange only and let getSession
    // just set the sync state so loading turns off fast.
    let initialised = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!initialised) {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user);
        setLoading(false);
        initialised = true;
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // defer to avoid calling Supabase inside the onAuthStateChange callback
          setTimeout(() => fetchProfile(session.user), 0);
        } else {
          setProfile(null);
          setIsElite(false);
          setSubscriptionEnd(null);
        }
        setLoading(false);
        initialised = true;
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  // Check subscription on login and periodically (every 5 minutes).
  // The immediate call on login is intentional — it syncs is_elite fast.
  // The interval is kept long to avoid hammering the edge function.
  useEffect(() => {
    if (!user) return;
    checkSubscription();
    const interval = setInterval(checkSubscription, 5 * 60_000);
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
    setSubscriptionEnd(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, isElite, subscriptionEnd, checkSubscription, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
