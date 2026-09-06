import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackAnon } from "@/lib/analytics";
import { toast } from "sonner";
import { nativeAppleSignIn } from "@/lib/native-auth";
import BrandLogo from "@/components/BrandLogo";
import AppleSignInButton from "@/components/AppleSignInButton";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { isNativePlatform } from "@/lib/platform";
import { cn } from "@/lib/utils";

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
    const fail = (message: string) => { setError(message); hapticNotification("error"); setLoading(false); };

    if (mode === "signup") {
      if (username.length < 3) return fail("Username must be at least 3 characters");
      if (!/^[a-zA-Z0-9_]+$/.test(username)) return fail("Username can only contain letters, numbers, and underscores");
      if (nameStatus === "taken") return fail("That username is taken — pick another.");
      void trackAnon("signup_submitted"); // pre-auth: fires whether or not signUp succeeds
      const { error: err } = await signUp(email, password, username);
      if (err) return fail(err.message);
      setEmailSent(true);
      hapticNotification("success");
    } else {
      const { error: err } = await signIn(email, password);
      if (err) return fail(err.message);
      hapticNotification("success");
      navigate("/");
    }
    setLoading(false);
  };

  if (emailSent) {
    return (
      <div className="min-h-full gradient-dark flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm home-rise text-center">
          <h1 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">Check your email.</h1>
          <p className="text-sm text-muted-foreground mt-3">
            We sent a verification link to <span className="text-foreground font-semibold">{email}</span>. Click the link to activate your account.
          </p>
          <Button variant="ghost" size="lg" className="mt-6" onClick={() => { setEmailSent(false); setMode("login"); }}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full gradient-dark flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        {/* ── OPENING BEAT — the brand mark, then one line that knows why
               you are here. ── */}
        <header className="home-rise flex flex-col items-center text-center mb-8">
          <BrandLogo size={48} priority className="rounded-xl mb-5" />
          <h1 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">
            {mode === "login" ? "Welcome back." : "Earn your status."}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {mode === "login" ? "Your streak is waiting." : "Free to start. Yours forever."}
          </p>
        </header>

        {/* ── HERO on native: Apple, one tap, no email wall. ── */}
        {isNative && (
          <div className="home-rise home-rise-1 mb-3">
            <AppleSignInButton externalLoading={appleLoading} />
          </div>
        )}
        {isNative && !showEmailForm && (
          <div className="home-rise home-rise-2">
            <Button type="button" variant="ghost" size="lg" className="w-full text-sm text-muted-foreground" onClick={() => setShowEmailForm(true)}>
              Continue with email instead
            </Button>
          </div>
        )}

        {/* ── HERO on web: the form. ── */}
        {showEmailForm && (
        <form onSubmit={handleSubmit} className="home-rise home-rise-1 space-y-4">
          {mode === "signup" && (
            <div className="home-rise">
              <Label htmlFor="auth-username" className="mb-1.5 block text-muted-foreground">Username</Label>
              <div className="relative">
                <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input
                  id="auth-username"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.trim().toLowerCase())}
                  placeholder="your_handle"
                  maxLength={20}
                  className={cn(
                    "h-12 pl-8 rounded-xl text-sm",
                    nameStatus === "taken" && "border-destructive/60",
                    nameStatus === "available" && "border-xp-green/60",
                  )}
                />
              </div>
              {nameStatus === "taken" ? (
                <p className="text-[11px] text-destructive mt-1.5 font-bold">@{username} is taken — pick another.</p>
              ) : nameStatus === "available" ? (
                <p className="commit-pop origin-left text-[11px] text-xp-green mt-1.5 font-bold">@{username} is yours ✓</p>
              ) : nameStatus === "checking" ? (
                <p className="text-[11px] text-muted-foreground mt-1.5">Checking availability…</p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-1.5">Locked permanently once set.</p>
              )}
              {/* The trial, one line. The only gold on the screen is the number. */}
              <p className="text-[12px] text-muted-foreground mt-3 leading-snug">
                {refCode && (invitedBy ? `@${invitedBy} invited you. ` : "You were invited. ")}
                <span className="text-gold font-bold">14-day</span> free trial, full access. Cancel anytime.
                {refCode && " Your referrer earns +50 XP when you verify."}
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="auth-email" className="mb-1.5 block text-muted-foreground">Email</Label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-12 rounded-xl text-sm"
              required
            />
          </div>

          <div>
            <Label htmlFor="auth-password" className="mb-1.5 block text-muted-foreground">Password</Label>
            <div className="relative">
              <Input
                id="auth-password"
                type={showPass ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="h-12 rounded-xl pr-12 text-sm"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label={showPass ? "Hide password" : "Show password"}
                aria-pressed={showPass}
                onClick={() => setShowPass(!showPass)}
                className="absolute right-0 top-0 rounded-xl text-muted-foreground"
              >
                {showPass ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              {error}
            </p>
          )}

          <Button variant="ember" size="xl" className="w-full" type="submit" loading={loading}>
            {mode === "login" ? "Sign in" : "Create account"}
            <ArrowRight size={18} />
          </Button>
        </form>
        )}

        {/* On web, Apple sits below the email form behind an "or" divider.
            Apple shows its native "Share My Email / Hide My Email" toggle in the
            system sheet automatically because we request the email scope. */}
        {!isNative && (
          <div className="home-rise home-rise-2">
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <AppleSignInButton externalLoading={appleLoading} />
          </div>
        )}

        <div className="home-rise home-rise-3 mt-4 flex flex-col items-center">
          {mode === "login" && showEmailForm && (
            <button
              type="button"
              onClick={async () => {
                if (!email) { toast.error("Enter your email first"); return; }
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) toast.error(error.message);
                else toast.success("Password reset link sent! Check your email.");
              }}
              className="px-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot password?
            </button>
          )}
          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setShowEmailForm(true); }}
            className="px-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <span className="text-foreground font-semibold">
              {mode === "login" ? "Create account" : "Sign in"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
