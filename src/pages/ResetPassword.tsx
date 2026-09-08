import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { applySessionFromUrl } from "@/lib/oauth-session";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

/**
 * /reset-password — the auth family's third screen: a beat, the one field,
 * an ember CTA. One password with a reveal toggle; a confirm field only
 * guards against typos the eye already catches.
 */
const ResetPassword = () => {
  const [password, setPassword] = useState("");
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
        <div className="w-full max-w-sm text-center home-rise">
          <h1 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">This link has expired.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Reset links work once. Sign in and request a new one.
          </p>
          <Button variant="ember" size="xl" className="mt-6 w-full" onClick={() => navigate("/auth")}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-full gradient-dark flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center home-rise">
          <h1 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">Password updated.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            You're signed in. Your streak is waiting.
          </p>
          <Button variant="ember" size="xl" className="mt-6 w-full" onClick={() => navigate("/")}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full gradient-dark flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <header className="home-rise flex flex-col items-center text-center mb-8">
          <BrandLogo size={48} priority className="rounded-xl mb-5" />
          <h1 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">Set a new password.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Six characters or more.</p>
        </header>

        <form onSubmit={handleReset} className="home-rise home-rise-1 space-y-4">
          <div>
            <Label htmlFor="reset-password" className="mb-1.5 block text-muted-foreground">New password</Label>
            <div className="relative">
              <Input
                id="reset-password"
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
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
            Save password
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
