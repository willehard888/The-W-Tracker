import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { clearAppleUsernameSelectionPending, isAppleUsernameSelectionPending } from "@/lib/apple-username";

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

const AppleUsername = () => {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
      return;
    }

    if (!loading && user && !isAppleUsernameSelectionPending()) {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!profile?.username) return;
    setUsername((current) => current || profile.username);
  }, [profile?.username]);

  const validationMessage = useMemo(() => {
    if (!username) return "";
    if (!USERNAME_REGEX.test(username)) {
      return "Use 3–20 characters: a-z, 0-9 and _";
    }
    return "";
  }, [username]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!USERNAME_REGEX.test(username)) {
      toast.error("Invalid username");
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc("update_own_profile", {
      new_username: username,
    });

    if (error) {
      setSaving(false);
      toast.error(error.message || "Failed to save username");
      return;
    }

    clearAppleUsernameSelectionPending();
    await refreshProfile();
    toast.success("Username saved");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen gradient-dark flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card/90 p-6 shadow-2xl">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">Apple Sign In</p>
          <h1 className="font-display text-3xl font-black tracking-tight">Choose your username</h1>
          <p className="text-sm text-muted-foreground">
            Your first Apple sign-in was successful. Pick a unique @username to finish setup.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="apple-username" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Username
            </label>
            <div className="flex h-12 items-center rounded-xl border border-border bg-background px-4 focus-within:border-gold/50 focus-within:ring-2 focus-within:ring-gold/20">
              <span className="mr-2 text-sm text-gold">@</span>
              <input
                id="apple-username"
                value={username}
                onChange={(event) => setUsername(event.target.value.trim().toLowerCase())}
                placeholder="your_name"
                autoCapitalize="none"
                autoCorrect="off"
                maxLength={20}
                className="h-full w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <p className="text-xs text-muted-foreground">This will appear as @{username || "your_name"} in the app.</p>
            {validationMessage ? <p className="text-xs text-destructive">{validationMessage}</p> : null}
          </div>

          <Button type="submit" variant="gold" size="xl" className="w-full" disabled={saving || !!validationMessage || username.length < 3}>
            {saving ? "Saving..." : "Continue to app"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AppleUsername;