import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

/**
 * ChooseUsername — the one-time handle picker, gated by
 * profiles.username_is_auto (set server-side whenever a user lands with a
 * name they didn't type themselves: Apple/OAuth placeholder, a collision
 * suffix, or a legacy auto-generated name). Every user picks their own
 * @handle exactly once; the DB guard trigger locks it afterwards.
 */
const ChooseUsername = () => {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
      return;
    }
    // Already has a chosen name — nothing to do here.
    if (!loading && user && profile && !profile.username_is_auto) {
      navigate("/", { replace: true });
    }
  }, [loading, user, profile, navigate]);

  // Prefill a suggestion from the REAL name the provider gave us (captured
  // into sessionStorage / user metadata on Apple sign-in) — never from the
  // email. Cleaned to the allowed charset.
  useEffect(() => {
    setUsername((current) => {
      if (current) return current;
      let seed = "";
      try { seed = sessionStorage.getItem("w_apple_name_suggestion") || ""; } catch { /* ignore */ }
      if (!seed) {
        const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
        seed = (meta.given_name as string) ||
          (meta.full_name ? String(meta.full_name).split(" ")[0] : "");
      }
      const cleaned = seed.toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 20);
      return cleaned.length >= 3 ? cleaned : current;
    });
  }, [user]);

  // Live availability (debounced). ilike = case-insensitive, matching the
  // lower(username) unique index — Mogger can't shadow mogger.
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken">("idle");
  useEffect(() => {
    if (!username || !USERNAME_REGEX.test(username)) {
      setAvailability("idle");
      return;
    }
    let active = true;
    setAvailability("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .ilike("username", username)
        .limit(1);
      if (!active) return;
      const row = (data ?? [])[0] as { user_id: string } | undefined;
      const taken = Boolean(row) && row?.user_id !== user?.id;
      setAvailability(taken ? "taken" : "available");
    }, 400);
    return () => { active = false; clearTimeout(t); };
  }, [username, user?.id]);

  const validationMessage = useMemo(() => {
    if (!username) return "";
    if (!USERNAME_REGEX.test(username)) {
      return "Use 3–20 characters: a-z, 0-9 and _";
    }
    if (availability === "taken") return "That name is taken — try another.";
    return "";
  }, [username, availability]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!USERNAME_REGEX.test(username)) {
      toast.error("Invalid username");
      return;
    }
    if (availability === "taken") {
      toast.error("That name is taken — try another.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc("update_own_profile", {
      new_username: username,
    });

    if (error) {
      setSaving(false);
      // Race: someone grabbed it between the check and submit.
      const taken = /duplicate|unique|already/i.test(error.message || "");
      if (taken) setAvailability("taken");
      toast.error(taken ? "That name is taken — try another." : (error.message || "Failed to save username"));
      return;
    }

    try { sessionStorage.removeItem("w_apple_name_suggestion"); } catch { /* ignore */ }
    await refreshProfile();
    toast.success(`Welcome, @${username}`);
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-full gradient-dark flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card/90 p-6 shadow-2xl">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Whealth Factory</p>
          <h1 className="font-display text-3xl font-black tracking-tight">Claim your name</h1>
          <p className="text-sm text-muted-foreground">
            This is your permanent @handle — on the leaderboard, in your tribe,
            under every W you post. Pick it once, own it forever.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="choose-username" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Username
            </label>
            <div className="flex h-12 items-center rounded-xl border border-border bg-background px-4 focus-within:border-gold/50 focus-within:ring-2 focus-within:ring-gold/20">
              <span className="mr-2 text-sm text-gold">@</span>
              <input
                id="choose-username"
                value={username}
                onChange={(event) => setUsername(event.target.value.trim().toLowerCase())}
                placeholder="your_name"
                autoCapitalize="none"
                autoCorrect="off"
                maxLength={20}
                className="h-full w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            {validationMessage ? (
              <p className="text-xs text-destructive">{validationMessage}</p>
            ) : availability === "checking" ? (
              <p className="text-xs text-muted-foreground">Checking availability…</p>
            ) : availability === "available" ? (
              <p className="text-xs text-xp-green">@{username} is yours ✓</p>
            ) : (
              <p className="text-xs text-muted-foreground">3–20 characters: a-z, 0-9 and _</p>
            )}
          </div>

          <Button
            type="submit"
            variant="ember"
            size="xl"
            className="w-full"
            disabled={saving || !!validationMessage || username.length < 3 || availability === "checking" || availability === "taken"}
          >
            {saving ? "Claiming…" : "Claim it"}
          </Button>
          <p className="text-center text-[12px] text-muted-foreground">
            Locked permanently once set — choose one that feels like you.
          </p>
        </form>
      </div>
    </div>
  );
};

export default ChooseUsername;
