import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/platform";
import { clearAppleUsernameSelectionPending, isAppleUsernameSelectionPending } from "@/lib/apple-username";

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

    setProfile(data);
    setIsElite(Boolean(data?.is_elite));

    if (data?.username && isAppleUsernameSelectionPending()) {
      const fallbackUsername = buildFallbackUsername(authUser);
      if (data.username !== fallbackUsername) {
        clearAppleUsernameSelectionPending();
      }
    }
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
