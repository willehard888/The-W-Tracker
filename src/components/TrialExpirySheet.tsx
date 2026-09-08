import { fmtInt } from "@/lib/format";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Crown } from "lucide-react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialAccess } from "@/hooks/use-trial-access";
import { track, FUNNEL } from "@/lib/analytics";
import { hapticImpact } from "@/lib/haptics";
import { readLocal, writeLocal } from "@/lib/storage";

/**
 * TrialExpirySheet — the conversion moment that never existed.
 *
 * useTrialAccess computed `isExpired` and NOTHING consumed it: the trial pill
 * simply vanished and coach features started silently failing. This sheet
 * fires ONCE per user at expiry (localStorage-guarded): a value recap of what
 * they built during the trial + the upgrade CTA. Never shown to paying members.
 */
const seenKey = (uid: string) => `trial_expiry_seen_${uid}`;

const N = ({ children }: { children: ReactNode }) => (
  <span className="font-black text-foreground tabular-nums">{children}</span>
);

const TrialExpirySheet = () => {
  const navigate = useNavigate();
  const { profile, isElite } = useAuth();
  const { isExpired } = useTrialAccess();
  const [open, setOpen] = useState(false);

  const uid = profile?.user_id;

  const shouldShow = useMemo(() => {
    if (!uid || !isExpired || isElite) return false;
    return readLocal(seenKey(uid)) !== "1";
  }, [uid, isExpired, isElite]);

  useEffect(() => {
    if (!shouldShow) return;
    setOpen(true);
    // One-shot: mark seen immediately so a crash/refresh can't re-show it,
    // and record the funnel event that makes trial→paid measurable.
    writeLocal(seenKey(uid!), "1");
    void track(FUNNEL.trialExpired, { streak: profile?.streak ?? 0, xp: profile?.xp ?? 0 });
  }, [shouldShow, uid, profile?.streak, profile?.xp]);

  const streak = Math.max(profile?.streak ?? 0, profile?.longest_streak ?? 0);
  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 1;

  const dismiss = () => setOpen(false);
  const upgrade = () => {
    hapticImpact("medium");
    setOpen(false);
    navigate("/paywall");
  };

  return (
    <BottomSheet open={open} onClose={dismiss} label="Your trial has ended" bodyClassName="px-6">
      <div className="mx-auto mt-2 mb-3 h-12 w-12 rounded-2xl bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shadow-[0_0_18px_hsl(var(--gold)/0.4)]">
        <Crown size={22} className="text-[hsl(260_18%_4%)]" strokeWidth={2.4} aria-hidden />
      </div>

      <h2 className="text-center font-display text-[22px] leading-[1.06] font-black tracking-tight">
        Your 14 days built something real
      </h2>
      {/* The value recap as one standing line — what THEY earned, not tiles. */}
      <p className="mt-2 text-center text-[13px] text-muted-foreground">
        <N>{fmtInt(streak)}</N>-day streak · <N>{fmtInt(xp)}</N> XP · level <N>{fmtInt(level)}</N>
      </p>
      <p className="mt-1 text-center text-[13px] text-muted-foreground leading-snug">
        Keep the coach, the plan and the climb.
      </p>

      <Button variant="ember" size="lg" className="mt-5 w-full font-black" onClick={upgrade}>
        Keep full access
      </Button>
      <Button variant="ghost" size="lg" className="w-full mt-1 text-muted-foreground" onClick={dismiss}>
        Maybe later
      </Button>
    </BottomSheet>
  );
};

export default TrialExpirySheet;
