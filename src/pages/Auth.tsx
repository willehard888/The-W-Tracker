import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Flame, Loader2 } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isNativePlatform } from "@/lib/platform";

const Auth = () => {
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
          <GoogleSignInButton />
          <AppleSignInButton />
        </div>

        <div className="mt-4 text-center space-y-3">
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

const GoogleSignInButton = () => {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result?.error) throw result.error;
    } catch (e: any) {
      console.error("Google sign in error:", e);
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="xl"
      className="w-full gap-3 bg-card border-border hover:bg-card/80"
      onClick={handleGoogleSignIn}
      disabled={loading}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      )}
      Continue with Google
    </Button>
  );
};

const AppleSignInButton = () => {
  const [loading, setLoading] = useState(false);

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result?.error) throw result.error;
    } catch (e: any) {
      console.error("Apple sign in error:", e);
      setLoading(false);
    }
  };

  return (
    <Button
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
};

export default Auth;
