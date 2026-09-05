import { useState } from "react";
import { Copy, Check, Users, Share2, Image as ImageIcon, CreditCard, Gift, CalendarCheck, Flame } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";
import TopInvitersWidget from "@/components/TopInvitersWidget";
import StoryShareModal from "@/components/StoryShareModal";
import { useReferralStats } from "@/hooks/use-referral-stats";
import { useMyReferrals } from "@/hooks/use-my-referrals";
import { track, FUNNEL } from "@/lib/analytics";
import { freeMonthsEarned, paidToNextMonth, nextMonthProgress, BADGE_MILESTONES, CREDIT_EVERY } from "@/lib/referral-rewards";
import { cn } from "@/lib/utils";
import { shareText } from "@/lib/share-image";

const Referrals = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const { data: stats } = useReferralStats(profile?.user_id);


  // MUST run before the early return — a hook after `return null` crashes with
  // "Rendered more hooks than during the previous render" the moment profile
  // resolves (same class of bug already fixed in Paywall.tsx).
  const { data: recruits } = useMyReferrals();

  if (!profile) return null;

  // Hardcoded canonical origin — window.location.origin is capacitor://localhost
  // inside the native shell, which made every shared link dead on arrival.
  const referralLink = `https://whealthfactory.com/auth?ref=${profile.referral_code || profile.username}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Link copied!");
      void track(FUNNEL.inviteShared, { method: "copy" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleNativeShare = async () => {
    const ok = await shareText({
      title: "Join Whealth Factory",
      text: `Train with me on Whealth Factory — daily check-ins, AI coach, the full system. Join here: ${referralLink}`,
      url: referralLink,
    });
    if (ok) void track(FUNNEL.inviteShared, { method: "native" });
    else handleCopy();
  };

  const referralCode = profile.referral_code || profile.username;

  const referralCount = stats?.convertedCount ?? profile.referral_count ?? 0;

  // The deal: every 3 paid friends = 1 free month, no cap.
  const paidCount = referralCount;
  const monthsEarned = freeMonthsEarned(paidCount);
  const toNextMonth = paidToNextMonth(paidCount);
  const cycleProgress = nextMonthProgress(paidCount); // 0..1 toward the next month
  const creditsUntil = profile.membership_credits_until
    ? new Date(profile.membership_credits_until)
    : null;
  const creditsActive = !!creditsUntil && creditsUntil.getTime() > Date.now();

  // SVG conic progress ring
  const ringSize = 132;
  const ringStroke = 8;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - cycleProgress * ringCirc;

  return (
    <div className="min-h-full">
      <PageBar title="Referrals" onBack={() => navigate(-1)} />

      <div className="px-4 pt-4 pb-6">
      <div className="flex items-center gap-3 mb-6 animate-reveal">
        <BrandLogo size={32} className="rounded-lg" alt="W" />
        <div>
          <h2 className="font-display text-2xl font-black tracking-tight">Recruit your way to Legend</h2>
          <p className="text-xs text-muted-foreground">Every 3 paid friends = 1 month free. No cap.</p>
        </div>
      </div>

      {/* Hero invite — code + link + two primary share actions (precision) */}
      <div className="animate-reveal animate-reveal-delay-1 surface-card p-5 mb-4">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gold/80 mb-1">Your invite</p>
        <p className="text-[13px] text-muted-foreground leading-snug mb-4">
          Your friends get a <span className="text-foreground font-semibold">14-day free trial</span>. You get a <span className="text-gold font-semibold">free month for every 3</span> who go paid — no cap.
        </p>

        {/* Big tappable code */}
        <button
          onClick={handleCopy}
          className="w-full rounded-xl border border-gold/30 bg-gold/[0.06] px-4 py-3 mb-2 flex items-center gap-3 active:scale-[0.99] transition-transform"
        >
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/60 mb-0.5">Invite code</p>
            <p className="font-display text-xl font-black text-gold tracking-wide truncate leading-none">{referralCode}</p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold text-gold">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
          </span>
        </button>
        <p className="text-[11px] text-muted-foreground/60 font-mono truncate mb-4">{referralLink}</p>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="ember" size="lg" onClick={handleNativeShare}>
            <Share2 size={16} /> Share link
          </Button>
          <Button variant="gold-soft" size="lg" onClick={() => setShareCardOpen(true)}>
            <ImageIcon size={16} /> Share card
          </Button>
        </div>
      </div>

      {/* Next free month — the ONE progress that matters */}
      <div className="animate-reveal animate-reveal-delay-2 relative overflow-hidden rounded-2xl border border-gold/25 bg-card p-5 mb-6">
        <div className="relative flex items-center gap-4">
          {/* Progress ring — this 3-friend cycle */}
          <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
            <svg width={ringSize} height={ringSize} className="-rotate-90">
              <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} stroke="hsl(var(--secondary))" strokeWidth={ringStroke} fill="none" />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringRadius}
                stroke="url(#goldGrad)"
                strokeWidth={ringStroke}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={ringCirc}
                strokeDashoffset={ringOffset}
                className="transition-all duration-700 ease-out"
              />
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="hsl(45 95% 65%)" />
                  <stop offset="100%" stopColor="hsl(35 95% 55%)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="eyebrow">Next</p>
              <p className="font-display text-2xl font-black text-gold tabular-nums leading-none mt-0.5">
                {paidCount % CREDIT_EVERY}<span className="text-muted-foreground">/{CREDIT_EVERY}</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">paid friends</p>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base">🎁</span>
              <p className="font-display font-black text-sm tracking-tight text-gold">Next free month</p>
            </div>
            <p className="text-[12px] text-muted-foreground leading-snug mb-2">
              {toNextMonth} paid friend{toNextMonth === 1 ? "" : "s"} away · then another month for every 3 after
            </p>
            {monthsEarned > 0 && (
              <p className="text-xs font-bold text-foreground/90 leading-snug">
                You've earned <span className="text-gold">{monthsEarned} free month{monthsEarned === 1 ? "" : "s"}</span>
                {creditsActive && creditsUntil && (
                  <span className="block text-[12px] text-muted-foreground font-medium mt-0.5">
                    Free until {creditsUntil.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </p>
            )}
            {monthsEarned === 0 && (
              <p className="text-xs font-bold text-foreground/90 leading-snug">3 paid friends = your first free month</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats — signups, paid, months earned */}
      <div className="animate-reveal animate-reveal-delay-2 grid grid-cols-3 gap-2.5 mb-6">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <Users size={18} className="text-gold mx-auto mb-1" />
          <p className="text-xl font-black font-display text-gold leading-none">{stats?.signupCount ?? 0}</p>
          <p className="eyebrow mt-1">Joined</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <CreditCard size={18} className="text-gold mx-auto mb-1" />
          <p className="text-xl font-black font-display text-gold leading-none">{paidCount}</p>
          <p className="eyebrow mt-1">Paid</p>
        </div>
        <div className="rounded-xl border border-gold/35 bg-gradient-to-br from-gold/[0.10] to-card p-3 text-center">
          <Gift size={18} className="text-gold mx-auto mb-1" />
          <p className="text-xl font-black font-display text-gold leading-none">{monthsEarned}</p>
          <p className="eyebrow mt-1">Free months</p>
        </div>
      </div>

      {/* "1 away" — the highest-intent moment to share */}
      {toNextMonth === 1 && (
        <button
          onClick={() => setShareCardOpen(true)}
          className="animate-reveal w-full text-left mb-4 rounded-xl border border-gold/45 bg-gradient-to-r from-gold/[0.12] via-gold/[0.05] to-transparent p-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform"
        >
          <span className="text-2xl shrink-0">🎁</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black text-foreground leading-tight">
              You're <span className="text-gold">1 paid friend away</span> from a free month!
            </p>
            <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">Tap to share your code.</p>
          </div>
          <Share2 size={16} className="text-gold shrink-0" />
        </button>
      )}

      {/* Recent recruits — social proof + who hasn't converted yet */}
      {(recruits?.length ?? 0) > 0 && (
        <div className="animate-reveal mb-6">
          <h2 className="font-display font-bold text-sm tracking-tight mb-3">Your recruits</h2>
          <div className="space-y-1.5">
            {recruits!.map((r, i) => (
              <div key={i} className="flex items-center gap-3 surface-card p-2.5">
                <div className="h-9 w-9 rounded-full overflow-hidden bg-gradient-to-br from-gold/40 to-card flex items-center justify-center font-black text-gold shrink-0 text-xs">
                  {r.avatar_url ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" /> : (r.referred_username?.charAt(0) || "?").toUpperCase()}
                </div>
                <p className="flex-1 min-w-0 text-[13px] font-bold truncate">@{r.referred_username}</p>
                {r.converted ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-xp-green">
                    <Check size={12} /> Premium
                  </span>
                ) : r.activated_at ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-[hsl(var(--ember))]">
                    <Flame size={11} /> Active
                  </span>
                ) : (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Joined</span>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 px-1">
            Active = 3 check-ins (+250 XP to you). Free months land when they go Premium.
          </p>
        </div>
      )}

      {/* How it works — 3 steps (trust + clarity) */}
      <div className="animate-reveal animate-reveal-delay-3 mb-6">
        <h2 className="font-display font-bold text-sm tracking-tight mb-3">How it works</h2>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: Share2, t: "Share", d: "Send your code or card" },
            { icon: CalendarCheck, t: "They show up", d: "Join +50 XP · 3 check-ins +250 XP" },
            { icon: Gift, t: "You earn", d: "1 free month per 3 paid friends" },
          ].map((s, i) => (
            <div key={i} className="surface-card p-3 text-center">
              <div className="mx-auto mb-2 h-9 w-9 rounded-xl bg-gold/10 border border-gold/25 flex items-center justify-center">
                <s.icon size={16} className="text-gold" />
              </div>
              <p className="text-[12px] font-black tracking-tight leading-tight">{s.t}</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{s.d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Badge milestones — bragging rights, never credits or status */}
      <div className="animate-reveal animate-reveal-delay-3">
        <div className="flex items-end justify-between mb-3">
          <h2 className="font-display font-bold text-sm tracking-tight">Badge milestones</h2>
          <p className="text-[11px] text-gold/70 uppercase tracking-wider font-bold">Paid friends</p>
        </div>
        <div className="space-y-2">
          {BADGE_MILESTONES.map((m) => {
            const unlocked = paidCount >= m.count;
            const isNext = !unlocked && BADGE_MILESTONES.filter((x) => x.count < m.count).every((x) => paidCount >= x.count);
            return (
              <div
                key={m.count}
                className={cn(
                  "rounded-xl border p-3 flex items-center gap-3 transition-all",
                  unlocked && "border-gold/50 bg-gradient-to-br from-gold/[0.12] via-gold/[0.05] to-transparent",
                  !unlocked && isNext && "border-gold/25 bg-card",
                  !unlocked && !isNext && "border-border bg-card opacity-70",
                )}
              >
                <div
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center font-black shrink-0 text-sm relative",
                    unlocked ? "gradient-gold text-primary-foreground shadow-lg shadow-gold/30" : "bg-secondary text-muted-foreground border border-border",
                  )}
                >
                  {m.count}
                  {unlocked && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-gold border-2 border-background flex items-center justify-center">
                      <Check size={10} className="text-primary-foreground" strokeWidth={3.5} />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("font-display font-black text-sm tracking-tight", unlocked ? "text-gold" : "text-foreground")}>
                    {m.emoji} {m.title}
                  </p>
                  <p className="text-[12px] text-muted-foreground leading-snug">{m.detail}</p>
                </div>
                {isNext && (
                  <span className="text-[11px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold/15 text-gold border border-gold/30 shrink-0">
                    Next
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Inviters — social proof & competition */}
      <div className="mt-6 animate-reveal animate-reveal-delay-4">
        <TopInvitersWidget hideEmptyCta />
      </div>

      <StoryShareModal
        open={shareCardOpen}
        onClose={() => setShareCardOpen(false)}
        variant="referral"
        referralCode={referralCode}
        referralLink={referralLink}
      />
      </div>
    </div>
  );
};

export default Referrals;
