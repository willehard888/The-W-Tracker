import { fmtInt } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Flame, Zap, X } from "lucide-react";
import { Portal } from "@/components/ui/Portal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialAccess } from "@/hooks/use-trial-access";
import { track, FUNNEL } from "@/lib/analytics";
import { hapticImpact } from "@/lib/haptics";

/**
 * TrialExpirySheet — the conversion moment that never existed.
 *
 * useTrialAccess computed `isExpired` and NOTHING consumed it: the trial pill
 * simply vanished and coach features started silently failing. This sheet
 * fires ONCE per user at expiry (localStorage-guarded): a value recap of what
 * they built during the trial + the upgrade CTA. Never shown to paying members.
 */
const seenKey = (uid: string) => `trial_expiry_seen_${uid}`;

const TrialExpirySheet = () => {
  const navigate = useNavigate();
  const { profile, isElite } = useAuth();
  const { isExpired } = useTrialAccess();
  const [open, setOpen] = useState(false);

  const uid = profile?.user_id;

  const shouldShow = useMemo(() => {
    if (!uid || !isExpired || isElite) return false;
    try {
      return localStorage.getItem(seenKey(uid)) !== "1";
    } catch {
      return false;
    }
  }, [uid, isExpired, isElite]);

  useEffect(() => {
    if (!shouldShow) return;
    setOpen(true);
    // One-shot: mark seen immediately so a crash/refresh can't re-show it,
    // and record the funnel event that makes trial→paid measurable.
    try { localStorage.setItem(seenKey(uid!), "1"); } catch { /* non-fatal */ }
    void track(FUNNEL.trialExpired, { streak: profile?.streak ?? 0, xp: profile?.xp ?? 0 });
  }, [shouldShow, uid, profile?.streak, profile?.xp]);

  if (!open) return null;

  const streak = profile?.streak ?? 0;
  const best = profile?.longest_streak ?? 0;
  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 1;

  const dismiss = () => setOpen(false);
  const upgrade = () => {
    hapticImpact("medium");
    setOpen(false);
    navigate("/paywall");
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[150] flex items-end justify-center">
        <button type="button" aria-label="Dismiss" onClick={dismiss} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
        <div className="relative w-full max-w-md rounded-t-3xl border-t border-x border-gold/30 bg-card p-5 pb-8 safe-bottom animate-in slide-in-from-bottom duration-300">
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="absolute right-3 top-3 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground before:absolute before:content-[''] before:-inset-[6px]"
          >
            <X size={16} />
          </button>

          <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shadow-[0_0_18px_hsl(var(--gold)/0.4)]">
            <Crown size={22} className="text-[hsl(260_18%_4%)]" strokeWidth={2.4} />
          </div>

          <h2 className="text-center font-display text-xl font-black tracking-tight">
            Your 14 days built something real
          </h2>
          <p className="mt-1 text-center text-[12px] text-muted-foreground leading-snug">
            Don't let it stop here — keep the coach, the plan and the climb.
          </p>

          {/* Value recap — what THEY earned, not generic marketing */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border/50 bg-card/60 px-2 py-2.5 text-center">
              <Flame size={13} className="mx-auto mb-1 text-gold" />
              <p className="font-display text-lg font-black tabular-nums leading-none">{Math.max(streak, best)}</p>
              <p className="eyebrow-sm mt-1 text-muted-foreground">day streak</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/60 px-2 py-2.5 text-center">
              <Zap size={13} className="mx-auto mb-1 text-gold" />
              <p className="font-display text-lg font-black tabular-nums leading-none">{fmtInt(xp)}</p>
              <p className="eyebrow-sm mt-1 text-muted-foreground">xp earned</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/60 px-2 py-2.5 text-center">
              <Crown size={13} className="mx-auto mb-1 text-gold" />
              <p className="font-display text-lg font-black tabular-nums leading-none">{level}</p>
              <p className="eyebrow-sm mt-1 text-muted-foreground">level</p>
            </div>
          </div>

          <Button variant="ember" size="lg" className="mt-5 w-full font-black" onClick={upgrade}>
            Keep full access
          </Button>
          <button
            type="button"
            onClick={dismiss}
            className="eyebrow mt-2 w-full text-center text-muted-foreground/60 py-1"
          >
            Maybe later
          </button>
        </div>
      </div>
    </Portal>
  );
};

export default TrialExpirySheet;
