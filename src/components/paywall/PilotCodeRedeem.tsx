import { useState } from "react";
import { Loader2, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hapticNotification } from "@/lib/haptics";
import { captureException } from "@/lib/observability";
import { toast } from "sonner";

/**
 * Pilot testers get free access through a code rather than a purchase, so the
 * paywall itself stays switched on and the real store flow gets exercised
 * before commercial launch.
 *
 * The code grants membership credits (profiles.membership_credits_until),
 * which has_active_access() and AuthContext's isPremium already honour — so
 * nothing here needs a bespoke gate, and access lapses on its own when the
 * pilot window ends.
 */

// Every failure the RPC can return, in the user's terms. A bare reason code
// ("code_exhausted") tells a tester nothing about what to do next.
const REASON_COPY: Record<string, string> = {
  invalid_code: "That code doesn't match any we issued. Check for typos.",
  code_expired: "That code has expired. Ask for a current one.",
  already_redeemed: "You've already used this code — your access is active.",
  code_exhausted: "That code has reached its limit. Ask for a new one.",
  empty_code: "Enter your code first.",
  not_authenticated: "Sign in first, then redeem your code.",
  too_many_attempts: "Too many tries for today — check the code and try again tomorrow.",
};

const PilotCodeRedeem = () => {
  const { refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error(REASON_COPY.empty_code);
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("redeem_pilot_code" as never, {
        p_code: trimmed,
      } as never);
      if (error) throw error;

      const result = data as { success?: boolean; reason?: string; granted_days?: number } | null;

      if (!result?.success) {
        const reason = result?.reason ?? "invalid_code";
        toast.error(REASON_COPY[reason] ?? "That code couldn't be redeemed.");
        return;
      }

      hapticNotification("success");
      const days = result.granted_days;
      toast.success(days ? `Access unlocked for ${days} days.` : "Access unlocked.");
      setCode("");
      setOpen(false);
      // Pull the new membership_credits_until so the paywall lets them through
      // without a restart. The profiles realtime subscription usually beats us
      // to it; this makes it deterministic rather than a race.
      await refreshProfile();
    } catch (err) {
      // Never leave the tester staring at a dead button with no explanation.
      captureException(err, { where: "redeemPilotCode" });
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="text-center mt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-gold transition-colors underline underline-offset-2 before:absolute before:-inset-2 before:content-['']"
        >
          <Ticket size={12} aria-hidden strokeWidth={2.4} />
          Have a pilot code?
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 mx-auto max-w-[320px]">
      <label
        htmlFor="pilot-code"
        className="eyebrow block text-gold mb-2 text-center"
      >
        Pilot code
      </label>
      <div className="flex gap-2">
        <Input
          id="pilot-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter your code"
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
          className="text-center tracking-widest uppercase"
        />
        <Button type="submit" variant="gold-outline" disabled={busy} className="shrink-0">
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Redeem"}
        </Button>
      </div>
      <button
        type="button"
        onClick={() => { setOpen(false); setCode(""); }}
        className="relative block mx-auto mt-2.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors before:absolute before:-inset-2 before:content-['']"
      >
        Cancel
      </button>
    </form>
  );
};

export default PilotCodeRedeem;
