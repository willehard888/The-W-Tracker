import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Flame, Crown, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackAnon } from "@/lib/analytics";
import { toast } from "sonner";
import { nativeAppleSignIn } from "@/lib/native-auth";
import BrandLogo from "@/components/BrandLogo";
import AppleSignInButton from "@/components/AppleSignInButton";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { isNativePlatform } from "@/lib/platform";

const Auth = () => {
  const isNative = isNativePlatform();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  // Live availability so a collision is visible BEFORE submit — the server
  // used to silently suffix a taken name (mogger -> mogger2), which broke the
  // "your name is fully yours" promise.
  const [nameStatus, setNameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  useEffect(() => {
    if (mode !== "signup" || username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
      setNameStatus("idle");
      return;
    }
    let active = true;
    setNameStatus("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .ilike("username", username)
        .limit(1);
      if (!active) return;
      setNameStatus(((data ?? []).length > 0) ? "taken" : "available");
    }, 400);
    return () => { active = false; clearTimeout(t); };
  }, [username, mode]);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  // On native iOS, Apple Sign-In is the primary one-tap path. The email/password
  // form is collapsed behind an explicit "Continue with email" toggle so we don't
  // wall first-time users behind a verification flow. On web (no native Apple
  // sheet) email stays the default and is shown immediately.
  const [showEmailForm, setShowEmailForm] = useState(!isNative);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");
  const appleSignInRequested = searchParams.get("apple_sign_in") === "1";
  const modeParam = searchParams.get("mode");

  const invitedBy = searchParams.get("from");

  // Start in signup mode when requested via ?mode=signup
  useEffect(() => {
    if (modeParam === "signup") setMode("signup");
    else if (modeParam === "login") setMode("login");
  }, [modeParam]);

  // Anonymous funnel: landing → auth screen → signup submit.
  useEffect(() => { void trackAnon("auth_viewed"); }, []);

  // Auto-switch to signup if referral link + persist code for post-auth claim
  useEffect(() => {
    if (refCode) {
      setMode("signup");
      // Referral signups need the username + trial-info form visible.
      setShowEmailForm(true);
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
      if (nameStatus === "taken") {
        setError("That username is taken — pick another.");
        hapticNotification("error");
        setLoading(false);
        return;
      }
      void trackAnon("signup_submitted"); // pre-auth: fires whether or not signUp succeeds
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
      <div className="min-h-full gradient-dark flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm animate-reveal text-center">
          <div className="h-14 w-14 mx-auto rounded-xl gradient-gold flex items-center justify-center glow-gold mb-6">
            <Mail size={24} className="text-primary-foreground" strokeWidth={2.4} />
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
    <div className="min-h-full gradient-dark flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-reveal">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <BrandLogo size={56} priority className="rounded-xl glow-gold mb-4" />
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {mode === "login" ? "Welcome back" : "Claim your username"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" ? "Your streak is waiting." : "Free to start. Yours forever."}
          </p>
        </div>

        {/* Apple Sign-In first on native — fastest one-tap path, no email wall. */}
        {isNative && (
          <div className="mb-4">
            <AppleSignInButton externalLoading={appleLoading} />
          </div>
        )}

        {/* On native, email is a secondary collapsed option. */}
        {isNative && !showEmailForm && (
          <button
            type="button"
            onClick={() => setShowEmailForm(true)}
            className="w-full text-center text-sm text-muted-foreground hover:text-gold transition-colors py-2"
          >
            Continue with <span className="text-gold font-semibold">email</span> instead
          </button>
        )}

        {showEmailForm && (
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
                  onChange={(e) => setUsername(e.target.value.trim().toLowerCase())}
                  placeholder="your_handle"
                  maxLength={20}
                  className={
                    "w-full h-12 pl-8 pr-4 rounded-xl border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 transition-all " +
                    (nameStatus === "taken"
                      ? "border-destructive/60"
                      : nameStatus === "available"
                      ? "border-xp-green/60"
                      : "border-border focus:border-gold/40")
                  }
                />
              </div>
              {nameStatus === "taken" ? (
                <p className="text-[11px] text-destructive mt-1 font-bold">@{username} is taken — pick another.</p>
              ) : nameStatus === "available" ? (
                <p className="text-[11px] text-xp-green mt-1 font-bold">@{username} is yours ✓</p>
              ) : nameStatus === "checking" ? (
                <p className="text-[11px] text-muted-foreground mt-1">Checking availability…</p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Flame size={12} className="text-gold" /> Locked permanently once set
                </p>
              )}
              {refCode ? (
                <div className="mt-2 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2">
                  <p className="text-[12px] text-gold font-bold">
                    {invitedBy ? `@${invitedBy} invited you` : "You were invited"} → 14-day free trial
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Full access, cancel anytime. Your referrer earns +50 XP when you verify.
                  </p>
                </div>
              ) : (
                <div className="mt-2 rounded-lg border border-gold/25 bg-gold/[0.04] px-3 py-2 flex items-center gap-2">
                  <Crown size={13} className="text-gold shrink-0" />
                  <p className="text-[11px] text-foreground/85 leading-snug">
                    <span className="text-gold font-bold">14-day free trial</span> — full access to
                    coach, training, recipes &amp; recovery. Cancel anytime.
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

          <Button variant="ember" size="xl" className="w-full" type="submit" disabled={loading}>
            {loading ? "Loading..." : mode === "login" ? "Log In" : "Create Account"}
            <ArrowRight size={18} />
          </Button>
        </form>
        )}

        {/* On web, Apple sits below the email form behind an "or" divider.
            Apple shows its native "Share My Email / Hide My Email" toggle in the
            system sheet automatically because we request the email scope. */}
        {!isNative && (
          <>
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div>
              <AppleSignInButton externalLoading={appleLoading} />
            </div>
          </>
        )}

        <div className="mt-4 text-center space-y-3">
          {mode === "login" && showEmailForm && (
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
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setShowEmailForm(true); }}
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
