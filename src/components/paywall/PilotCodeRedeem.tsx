import { useState } from "react";
import { Loader2, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hapticNotification } from "@/lib/haptics";
import { captureException } from "@/lib/observability";
import { toast } from "@/lib/toast";

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
      const { data, error } = await supabase.rpc("redeem_pilot_code", {
        p_code: trimmed,
      });
      if (error) throw error;

      const result = data as { success?: boolean; reason?: string; granted_days?: number } | null;

      if (!result?.success) {
        const reason = result?.reason ?? "invalid_code";
        toast.error(REASON_COPY[reason] ?? "That code couldn't be redeemed.");
        return;
      }

      hapticNotification("success");
      const days = result.granted_days;
      // The pilot and the access are two different lengths on purpose — 14 days
      // of being watched, 90 of being let in — and the only moment that
      // difference can be explained without it sounding like a catch is now,
      // before anybody has grown used to either. Said once, here, and not
      // repeated in the app afterwards.
      toast.success(
        days ? `Access unlocked for ${days} day${days === 1 ? "" : "s"}.` : "Access unlocked.",
        {
        description:
          "Pilotti kestää 14 päivää — kysymme matkan varrella muutaman kysymyksen. " +
          "Pääsysi jatkuu sen jälkeenkin.",
        },
      );
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
      <div className="text-center">
        <Button variant="link" size="sm" onClick={() => setOpen(true)}>
          <Ticket size={12} aria-hidden strokeWidth={2.5} />
          Have a pilot code?
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 mx-auto max-w-[320px]">
      <label htmlFor="pilot-code" className="block text-label font-bold text-muted-foreground mb-2 text-center">
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
        <Button type="submit" variant="gold-outline" loading={busy} className="shrink-0">
          {busy ? <Loader2 aria-hidden size={16} className="animate-spin" /> : "Redeem"}
        </Button>
      </div>
      {/* The one moment somebody knowingly joins the pilot, so the one place
          this belongs. Three facts, because these are what a tester would
          think to ask: how long we will be asking, that answering is optional,
          and how long what they write is kept.

          Finnish, like every other pilot surface — the questions, the
          "Älä kirjoita tähän terveystietoja" warning, the profile row. The
          screen around it is English because the app is; the pilot has spoken
          to its testers in their own language since it was built. */}
      <p className="mt-3 text-meta text-muted-foreground leading-relaxed">
        Kysymme kokemuksestasi 14 päivän ajan. Vastaaminen on vapaaehtoista,
        vastaukset säilytetään 180 päivää ja ne poistuvat tilin mukana.
      </p>
      <Button variant="link" size="sm" className="mx-auto mt-1 flex" onClick={() => { setOpen(false); setCode(""); }}>
        Cancel
      </Button>
    </form>
  );
};

export default PilotCodeRedeem;
