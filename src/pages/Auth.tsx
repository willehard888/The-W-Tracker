import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { nativeAppleSignIn } from "@/lib/native-auth";
import BrandLogo from "@/components/BrandLogo";
import AppleSignInButton from "@/components/AppleSignInButton";
import { hapticImpact, hapticNotification } from "@/lib/haptics";

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");
  const appleSignInRequested = searchParams.get("apple_sign_in") === "1";

  const invitedBy = searchParams.get("from");

  // Auto-switch to signup if referral link + persist code for post-auth claim
  useEffect(() => {
    if (refCode) {
      setMode("signup");
      try {
        localStorage.setItem("pending_referral_code", refCode);
      } catch {}
    }
  }, [refCode]);

  useEffect(() => {
    if (!appleSignInRequested) return;

    let cancelled = false;

    const startAppleSignIn = async () => {
      setAppleLoading(true);
      setError("");

      try {
        const { error } = await nativeAppleSignIn();
        if (error && !cancelled) {
          const message = error.message === "APPLE_CANCELLED" ? "" : error.message;
          setError(message);
          if (message) toast.error(message);
        }
      } catch (e: any) {
        if (!cancelled) {
          const message = e?.message === "APPLE_CANCELLED" ? "" : e?.message || "Apple sign-in failed. Please try again.";
          setError(message);
          if (message) toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setAppleLoading(false);
        }
      }
    };

    void startAppleSignIn();

    return () => {
      cancelled = true;
    };
  }, [appleSignInRequested]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    hapticImpact("light");

    if (mode === "signup") {
      if (username.length < 3) {
        setError("Username must be at least 3 characters");
        hapticNotification("error");
        setLoading(false);
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setError("Username can only contain letters, numbers, and underscores");
        hapticNotification("error");
        setLoading(false);
        return;
      }
      const { error: err } = await signUp(email, password, username);
      if (err) {
        setError(err.message);
        hapticNotification("error");
      } else {
        setEmailSent(true);
        hapticNotification("success");
      }
    } else {
      const { error: err } = await signIn(email, password);
      if (err) {
        setError(err.message);
        hapticNotification("error");
      } else {
        hapticNotification("success");
        navigate("/");
      }
    }
    setLoading(false);
  };

  if (emailSent) {
    return (
      <div className="min-h-screen gradient-dark flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm animate-reveal text-center">
          <div className="h-14 w-14 mx-auto rounded-xl gradient-gold flex items-center justify-center glow-gold mb-6">
            <span className="text-xl font-black text-primary-foreground">✉️</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Check your email</h1>
          <p className="text-sm text-muted-foreground mb-6">
            We sent a verification link to <span className="text-gold font-semibold">{email}</span>. Click the link to activate your account.
          </p>
          <button
            onClick={() => { setEmailSent(false); setMode("login"); }}
            className="text-sm text-gold hover:text-gold/80 transition-colors font-semibold"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-dark flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-reveal">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <BrandLogo size={56} priority className="rounded-xl glow-gold mb-4" />
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {mode === "login" ? "Welcome Back" : "Join the Movement"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" ? "Log in to continue your grind" : "Create your account. Lock in your username."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="animate-reveal">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="your_handle"
                  maxLength={20}
                  className="w-full h-12 pl-8 pr-4 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 transition-all"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <Flame size={10} className="text-gold" /> Locked permanently once set
              </p>
              {refCode && (
                <div className="mt-2 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2">
                  <p className="text-[11px] text-gold font-bold">
                    {invitedBy ? `@${invitedBy} invited you` : "You were invited"} → 14-day free trial
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Normally 7 days. Your referrer earns +50 XP when you verify.
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 transition-all"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="w-full h-12 px-4 pr-12 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              {error}
            </div>
          )}

          <Button variant="coal" size="xl" className="w-full" type="submit" disabled={loading}>
            {loading ? "Loading..." : mode === "login" ? "Log In" : "Create Account"}
            <ArrowRight size={18} />
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Social Sign In — Apple shows its native "Share My Email / Hide My Email"
            toggle in the system sheet automatically because we request the email scope. */}
        <div>
          <AppleSignInButton externalLoading={appleLoading} />
        </div>

        <div className="mt-4 text-center space-y-3">
          <button
            onClick={() => navigate("/ios-debug")}
            className="text-xs text-muted-foreground hover:text-gold transition-colors"
          >
            Open iOS Debug
          </button>
          {mode === "login" && (
            <button
              onClick={async () => {
                if (!email) { toast.error("Enter your email first"); return; }
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) toast.error(error.message);
                else toast.success("Password reset link sent! Check your email.");
              }}
              className="text-xs text-muted-foreground hover:text-gold transition-colors"
            >
              Forgot password?
            </button>
          )}
          <button
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
            className="text-sm text-muted-foreground hover:text-gold transition-colors"
          >
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <span className="text-gold font-semibold">
              {mode === "login" ? "Sign Up" : "Log In"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
