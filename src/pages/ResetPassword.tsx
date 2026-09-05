import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { applySessionFromUrl } from "@/lib/oauth-session";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Check } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    // Consume the recovery tokens from the URL hash. The Supabase client is
    // configured with `detectSessionInUrl: false` (see src/integrations/supabase/client.ts)
    // so we have to apply the session manually. Without this, the auth update
    // call below fails with "Auth session missing!" — which is exactly what
    // a freshly-clicked reset link from email surfaced on the first try.
    if (window.location.hash.includes("type=recovery")) {
      setIsRecovery(true);
      void applySessionFromUrl(window.location.href).then((ok) => {
        setSessionReady(ok);
        if (ok) {
          // Clear the tokens from the URL bar so a refresh doesn't try to
          // re-apply them and the user can't share the link by accident.
          window.history.replaceState({}, "", window.location.pathname);
        }
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!sessionReady) {
      // Make the "Auth session missing!" failure mode self-explanatory
      // instead of bouncing the user back with cryptic Supabase copy.
      setError(
        "Recovery link expired or already used. Request a new password reset email and click the most recent link.",
      );
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (!isRecovery && !success) {
    return (
      <div className="min-h-full gradient-dark flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center animate-reveal">
          <h1 className="font-display text-2xl font-bold mb-2">Invalid link</h1>
          <p className="text-sm text-muted-foreground mb-6">
            This password reset link is invalid or has expired.
          </p>
          <Button variant="gold-outline" onClick={() => navigate("/auth")}>
            <ArrowLeft size={14} />
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-full gradient-dark flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center animate-reveal">
          <div className="h-14 w-14 mx-auto rounded-xl bg-xp-green/20 border border-xp-green/30 flex items-center justify-center mb-6">
            <Check size={24} className="text-xp-green" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-2">Password updated</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your password has been successfully reset.
          </p>
          <Button variant="ember" size="xl" className="w-full" onClick={() => navigate("/")}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full gradient-dark flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-reveal">
        <div className="flex flex-col items-center mb-10">
          <BrandLogo size={56} priority className="rounded-xl glow-gold mb-4" />
          <h1 className="font-display text-2xl font-bold tracking-tight">Set new password</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your new password below</p>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="eyebrow text-muted-foreground mb-1.5 block">
              New Password
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

          <div>
            <label className="eyebrow text-muted-foreground mb-1.5 block">
              Confirm Password
            </label>
            <input
              type={showPass ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className="w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 transition-all"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              {error}
            </div>
          )}

          <Button variant="ember" size="xl" className="w-full" type="submit" disabled={loading}>
            {loading ? "Updating…" : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
