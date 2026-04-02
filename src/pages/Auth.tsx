import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Flame, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { nativeAppleSignIn } from "@/lib/native-auth";

const Auth = React.forwardRef<HTMLDivElement>((_props, ref) => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");

  // Auto-switch to signup if referral link
  useEffect(() => {
    if (refCode) setMode("signup");
  }, [refCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "signup") {
      if (username.length < 3) {
        setError("Username must be at least 3 characters");
        setLoading(false);
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setError("Username can only contain letters, numbers, and underscores");
        setLoading(false);
        return;
      }
      const { error: err } = await signUp(email, password, username);
      if (err) {
        setError(err.message);
      } else {
        setEmailSent(true);
      }
    } else {
      const { error: err } = await signIn(email, password);
      if (err) {
        setError(err.message);
      } else {
        navigate("/");
      }
    }
    setLoading(false);
  };

  if (emailSent) {
    return (
      <div ref={ref} className="min-h-screen gradient-dark flex flex-col items-center justify-center px-6">
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
    <div ref={ref} className="min-h-screen gradient-dark flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-reveal">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <img src="/app-icon.png" alt="The W Tracker" className="h-14 w-14 rounded-xl glow-gold mb-4" />
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
                <p className="text-[10px] text-gold/70 mt-1">
                  🎁 Referred by: <span className="font-bold">{refCode}</span>
                </p>
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

          <Button variant="gold" size="xl" className="w-full" type="submit" disabled={loading}>
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

        {/* Social Sign In */}
        <div className="space-y-3">
          <AppleSignInButton />
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
});


Auth.displayName = "Auth";

const AppleSignInButton = React.forwardRef<HTMLButtonElement>((_props, ref) => {
  const [loading, setLoading] = useState(false);

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await nativeAppleSignIn();
      if (error) throw error;
    } catch (e: any) {
      console.error("Apple sign in error:", e);
      toast.error(e?.message || "Apple sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      size="xl"
      className="w-full gap-3 bg-card border-border hover:bg-card/80"
      onClick={handleAppleSignIn}
      disabled={loading}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
        </svg>
      )}
      Continue with Apple
    </Button>
  );
});

AppleSignInButton.displayName = "AppleSignInButton";

export default Auth;
