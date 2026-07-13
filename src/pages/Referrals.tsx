import { useState } from "react";
import { Copy, Check, Users, Share2, Trophy, ChevronLeft, Zap, Crown, Sparkles, Lock, Image as ImageIcon, CreditCard, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";
import TopInvitersWidget from "@/components/TopInvitersWidget";
import StoryShareModal from "@/components/StoryShareModal";
import { useReferralStats } from "@/hooks/use-referral-stats";
import { useMyReferrals } from "@/hooks/use-my-referrals";
import { track, FUNNEL } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Reward = {
  count: number;
  title: string;
  reward: string;
  emoji: string;
  unlocked: boolean;
  premium?: "apex" | "legend";
  iconNode?: React.ReactNode;
};

const Referrals = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const { data: stats } = useReferralStats(profile?.user_id);

  const { data: referrals } = useQuery({
    queryKey: ["referrals", profile?.user_id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", profile.user_id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile,
  });

  if (!profile) return null;

  const referralLink = `${window.location.origin}/auth?ref=${profile.referral_code || profile.username}`;

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
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Whealth Factory",
          text: `I run my discipline on Whealth Factory — daily check-ins, AI coach, the whole system. Here's a 14-day free trial:`,
          url: referralLink,
        });
        void track(FUNNEL.inviteShared, { method: "native" });
      } catch {}
    } else {
      handleCopy();
    }
  };

  const referralCode = profile.referral_code || profile.username;

  const referralCount = stats?.convertedCount ?? profile.referral_count ?? 0;
  const daysAsApex = stats?.daysAsApex ?? 0;
  const legendPinned = stats?.legendPinned ?? false;

  const rewards: Reward[] = [
    { count: 1, title: "First Recruit", reward: "+250 XP · First Recruit badge", emoji: "🎯", unlocked: referralCount >= 1 },
    { count: 3, title: "1 Month Free", reward: "30 days of membership credits", emoji: "🎟️", unlocked: referralCount >= 3 },
    { count: 5, title: "2 Months Free", reward: "60 days credits · Brand Ambassador badge", emoji: "🥈", unlocked: referralCount >= 5 },
    { count: 10, title: "Apex Instant", reward: "30 days Apex tier · Inner Circle badge · Tribe creation", emoji: "⚡", unlocked: referralCount >= 10, premium: "apex" },
    { count: 25, title: "1 Year Free", reward: "365 days of membership credits · Kingmaker badge", emoji: "👑", unlocked: referralCount >= 25 },
    { count: 50, title: "Founders Circle", reward: "Permanent Legend pin · Lifetime Apex · Founders badge", emoji: "🔱", unlocked: referralCount >= 50 || legendPinned, premium: "legend" },
  ];

  const nextReward = rewards.find((r) => !r.unlocked);
  const nextProgress = nextReward ? Math.min(100, Math.round((referralCount / nextReward.count) * 100)) : 100;
  const remainingToNext = nextReward ? Math.max(0, nextReward.count - referralCount) : 0;
  const nextIsPremium = nextReward?.premium;

  const { data: recruits } = useMyReferrals();

  // SVG conic progress ring
  const ringSize = 132;
  const ringStroke = 8;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (nextProgress / 100) * ringCirc;

  return (
    <div className="min-h-screen pb-4 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6 animate-reveal">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors active:scale-95">
          <ChevronLeft size={20} />
        </button>
        <BrandLogo size={32} className="rounded-lg" alt="W" />
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Recruit Your Way to Legend</h1>
          <p className="text-xs text-muted-foreground">Every paid friend pulls you closer to Founders Circle.</p>
        </div>
      </div>

      {/* Hero invite — code + link + two primary share actions (precision) */}
      <div className="animate-reveal animate-reveal-delay-1 rounded-2xl border border-border/60 bg-card/40 p-5 mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/80 mb-1">Your invite</p>
        <p className="text-[13px] text-muted-foreground leading-snug mb-4">
          Your friends get a <span className="text-foreground font-semibold">14-day free trial</span>. You earn free months, Apex and Legend status.
        </p>

        {/* Big tappable code */}
        <button
          onClick={handleCopy}
          className="w-full rounded-xl border border-gold/30 bg-gold/[0.06] px-4 py-3 mb-2 flex items-center gap-3 active:scale-[0.99] transition-transform"
        >
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gold/60 mb-0.5">Invite code</p>
            <p className="font-display text-xl font-black text-gold tracking-wide truncate leading-none">{referralCode}</p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-gold">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
          </span>
        </button>
        <p className="text-[10px] text-muted-foreground/60 font-mono truncate mb-4">{referralLink}</p>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="ember" size="lg" onClick={handleNativeShare}>
            <Share2 size={16} /> Share link
          </Button>
          <Button variant="gold-soft" size="lg" onClick={() => setShareCardOpen(true)}>
            <ImageIcon size={16} /> Share card
          </Button>
        </div>
      </div>

      {/* Next Reward Lock — hero progress ring */}
      {nextReward && (
        <div
          className={cn(
            "animate-reveal animate-reveal-delay-2 relative overflow-hidden rounded-2xl border p-5 mb-6",
            nextIsPremium === "legend"
              ? "border-transparent bg-[linear-gradient(135deg,hsl(280_60%_12%/0.6),hsl(45_70%_10%/0.5),hsl(350_60%_12%/0.5))] shadow-[0_0_40px_-8px_hsl(280_70%_60%/0.45)]"
              : nextIsPremium === "apex"
                ? "border-transparent bg-[linear-gradient(135deg,hsl(18_60%_12%/0.6),hsl(45_70%_10%/0.55))] shadow-[0_0_36px_-10px_hsl(18_95%_62%/0.5)]"
                : "border-gold/25 bg-card"
          )}
        >
          {nextIsPremium && (
            <>
              <div className="pointer-events-none absolute inset-0 opacity-60 bg-[linear-gradient(115deg,transparent_30%,hsl(45_85%_70%/0.18)_50%,transparent_70%)]" />
              <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-gold/20 blur-3xl" />
            </>
          )}
          {nextIsPremium && (
            <div
              className="pointer-events-none absolute inset-[-1px] rounded-2xl"
              style={{
                background:
                  nextIsPremium === "legend"
                    ? "conic-gradient(from 140deg, hsl(280 70% 60%), hsl(45 90% 60%), hsl(350 80% 60%), hsl(280 70% 60%))"
                    : "conic-gradient(from 140deg, hsl(18 95% 62%), hsl(45 90% 60%), hsl(18 95% 62%))",
                WebkitMask:
                  "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                WebkitMaskComposite: "xor",
                padding: "1.5px",
              }}
            />
          )}
          <div className="relative flex items-center gap-4">
            {/* Progress ring */}
            <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
              <svg width={ringSize} height={ringSize} className="-rotate-90">
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringRadius}
                  stroke="hsl(var(--secondary))"
                  strokeWidth={ringStroke}
                  fill="none"
                />
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringRadius}
                  stroke={nextIsPremium === "legend" ? "url(#legendGrad)" : "url(#goldGrad)"}
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
                  <linearGradient id="legendGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(280 70% 65%)" />
                    <stop offset="50%" stopColor="hsl(45 90% 60%)" />
                    <stop offset="100%" stopColor="hsl(350 80% 60%)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Next</p>
                <p className="font-display text-2xl font-black text-gold tabular-nums leading-none mt-0.5">
                  {referralCount}<span className="text-muted-foreground">/{nextReward.count}</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">recruits</p>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-base">{nextReward.emoji}</span>
                <p
                  className={cn(
                    "font-display font-black text-sm tracking-tight truncate",
                    nextIsPremium === "legend"
                      ? "bg-gradient-to-r from-[hsl(280_70%_70%)] via-gold to-[hsl(350_80%_65%)] bg-clip-text text-transparent"
                      : nextIsPremium === "apex"
                        ? "bg-gradient-to-r from-[hsl(18_95%_62%)] via-gold to-[hsl(18_95%_62%)] bg-clip-text text-transparent"
                        : "text-gold"
                  )}
                >
                  {nextReward.title}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug mb-2 line-clamp-2">{nextReward.reward}</p>
              <p className="text-xs font-bold text-foreground/90 leading-snug">
                {remainingToNext === 0
                  ? "Reward unlocking soon…"
                  : nextIsPremium === "legend"
                    ? `${remainingToNext} more for permanent 🔱 Legend`
                    : nextIsPremium === "apex"
                      ? `${remainingToNext} more for ⚡ Apex Instant`
                      : `${remainingToNext} recruit${remainingToNext === 1 ? "" : "s"} away`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats — 3 cells now */}
      <div className="animate-reveal animate-reveal-delay-2 grid grid-cols-3 gap-2.5 mb-6">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <Users size={18} className="text-gold mx-auto mb-1" />
          <p className="text-xl font-black font-display text-gold leading-none">{referralCount}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold mt-1">Recruited</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <Trophy size={18} className="text-gold mx-auto mb-1" />
          <p className="text-xl font-black font-display text-gold leading-none">{rewards.filter((r) => r.unlocked).length}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold mt-1">Rewards</p>
        </div>
        <div
          className={cn(
            "rounded-xl border p-3 text-center relative overflow-hidden",
            legendPinned
              ? "border-transparent bg-[linear-gradient(135deg,hsl(280_50%_15%/0.7),hsl(45_60%_12%/0.6),hsl(350_50%_15%/0.6))]"
              : daysAsApex > 0
                ? "border-transparent bg-[linear-gradient(135deg,hsl(18_50%_15%/0.7),hsl(45_60%_12%/0.55))]"
                : "border-border bg-card"
          )}
        >
          {legendPinned ? (
            <Crown size={18} className="text-gold mx-auto mb-1" />
          ) : daysAsApex > 0 ? (
            <Zap size={18} className="text-gold mx-auto mb-1" />
          ) : (
            <Lock size={16} className="text-muted-foreground mx-auto mb-1.5" />
          )}
          <p
            className={cn(
              "text-xl font-black font-display leading-none",
              legendPinned
                ? "bg-gradient-to-r from-[hsl(280_70%_70%)] via-gold to-[hsl(350_80%_65%)] bg-clip-text text-transparent"
                : daysAsApex > 0
                  ? "text-gold"
                  : "text-muted-foreground"
            )}
          >
            {legendPinned ? "∞" : daysAsApex > 0 ? daysAsApex : `${Math.max(0, 10 - referralCount)}→⚡`}
          </p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold mt-1">
            {legendPinned ? "Legend Pinned" : daysAsApex > 0 ? "Days as Apex" : "To Apex"}
          </p>
        </div>
      </div>

      {/* "You're 1 away" banner — the highest-intent moment to share */}
      {nextReward && remainingToNext === 1 && (
        <button
          onClick={() => setShareCardOpen(true)}
          className="animate-reveal w-full text-left mb-4 rounded-xl border border-gold/45 bg-gradient-to-r from-gold/[0.12] via-gold/[0.05] to-transparent p-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform"
        >
          <span className="text-2xl shrink-0">{nextReward.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black text-foreground leading-tight">
              You're <span className="text-gold">1 recruit away</span> from {nextReward.title}!
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{nextReward.reward} — tap to share your code.</p>
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
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/50 p-2.5">
                <div className="h-9 w-9 rounded-full overflow-hidden bg-gradient-to-br from-gold/40 to-card flex items-center justify-center font-black text-gold shrink-0 text-xs">
                  {r.avatar_url ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" /> : (r.referred_username?.charAt(0) || "?").toUpperCase()}
                </div>
                <p className="flex-1 min-w-0 text-[13px] font-bold truncate">@{r.referred_username}</p>
                {r.converted ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[hsl(152_68%_46%)]">
                    <Check size={12} /> Premium
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Joined</span>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 px-1">
            Rewards unlock when a recruit goes Premium — nudge the "Joined" ones to keep going.
          </p>
        </div>
      )}

      {/* Lifetime club banner */}
      {referralCount >= 25 && referralCount < 50 && !legendPinned && (
        <div className="animate-reveal mb-4 rounded-xl border border-gold/35 bg-gradient-to-r from-gold/[0.08] via-gold/[0.04] to-transparent p-3 flex items-center gap-3">
          <Sparkles size={18} className="text-gold shrink-0" />
          <p className="text-xs font-bold text-foreground leading-tight">
            You're in the Lifetime club. <span className="text-gold">{50 - referralCount} more</span> for permanent Legend.
          </p>
        </div>
      )}

      {/* How it works — 3 steps (trust + clarity) */}
      <div className="animate-reveal animate-reveal-delay-3 mb-6">
        <h2 className="font-display font-bold text-sm tracking-tight mb-3">How it works</h2>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: Share2, t: "Share", d: "Send your code or card" },
            { icon: CreditCard, t: "They subscribe", d: "Friend starts a paid plan" },
            { icon: Gift, t: "You earn", d: "Free months · Apex · Legend" },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card/40 p-3 text-center">
              <div className="mx-auto mb-2 h-9 w-9 rounded-xl bg-gold/10 border border-gold/25 flex items-center justify-center">
                <s.icon size={16} className="text-gold" />
              </div>
              <p className="text-[11px] font-black tracking-tight leading-tight">{s.t}</p>
              <p className="text-[9.5px] text-muted-foreground leading-snug mt-0.5">{s.d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Rewards Tiers */}
      <div className="animate-reveal animate-reveal-delay-3">
        <div className="flex items-end justify-between mb-3">
          <h2 className="font-display font-bold text-sm tracking-tight">Reward ladder</h2>
          <p className="text-[10px] text-gold/70 uppercase tracking-wider font-bold">
            Unlocks on subscribe
          </p>
        </div>
        <div className="space-y-2.5">
          {rewards.map((r, idx) => {
            const isNext = !r.unlocked && rewards.slice(0, idx).every((p) => p.unlocked);
            const progress = Math.min(100, Math.round((referralCount / r.count) * 100));
            const isApex = r.premium === "apex";
            const isLegend = r.premium === "legend";
            return (
              <div
                key={r.count}
                className={cn(
                  "relative overflow-hidden rounded-xl border p-3.5 transition-all",
                  // Premium skins — darker base so text stays readable
                  isApex && "border-transparent bg-[linear-gradient(135deg,hsl(18_50%_8%/0.85),hsl(20_40%_6%/0.9))] shadow-[0_0_28px_-12px_hsl(18_95%_62%/0.5)]",
                  isLegend && "border-transparent bg-[linear-gradient(135deg,hsl(280_40%_8%/0.85),hsl(20_30%_6%/0.9),hsl(350_40%_8%/0.85))] shadow-[0_0_30px_-12px_hsl(280_70%_60%/0.5)]",
                  // Default skins
                  !r.premium && r.unlocked && "border-gold/50 bg-gradient-to-br from-gold/[0.12] via-gold/[0.06] to-transparent glow-gold-sm",
                  !r.premium && !r.unlocked && isNext && "border-gold/25 bg-card",
                  !r.premium && !r.unlocked && !isNext && "border-border bg-card opacity-70"
                )}
              >
                {/* Premium gradient border ring */}
                {(isApex || isLegend) && (
                  <div
                    className="pointer-events-none absolute inset-[-1px] rounded-xl"
                    style={{
                      background: isLegend
                        ? "conic-gradient(from 140deg, hsl(280 70% 60%), hsl(45 90% 60%), hsl(350 80% 60%), hsl(280 70% 60%))"
                        : "conic-gradient(from 140deg, hsl(18 95% 62%), hsl(45 90% 60%), hsl(18 95% 62%))",
                      WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                      WebkitMaskComposite: "xor",
                      padding: "1.5px",
                    }}
                  />
                )}

                <div className="relative flex items-center gap-3">
                  {/* Compact uniform tile — number for normal, icon for premium */}
                  <div
                    className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center font-black shrink-0 relative text-sm",
                      r.unlocked && !r.premium && "gradient-gold text-primary-foreground shadow-lg shadow-gold/30",
                      isApex && "bg-[linear-gradient(135deg,hsl(18_95%_55%),hsl(45_95%_55%))] text-background shadow-[0_0_18px_hsl(18_95%_62%/0.55)]",
                      isLegend && "bg-[linear-gradient(135deg,hsl(280_70%_50%),hsl(45_90%_55%),hsl(350_80%_55%))] text-background shadow-[0_0_22px_hsl(280_70%_60%/0.55)]",
                      !r.unlocked && !r.premium && "bg-secondary text-muted-foreground border border-border"
                    )}
                  >
                    {isApex ? (
                      <Zap size={22} strokeWidth={2.6} />
                    ) : isLegend ? (
                      <Crown size={22} strokeWidth={2.6} />
                    ) : (
                      <span>{r.count}</span>
                    )}
                    {r.unlocked && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gold border-2 border-background flex items-center justify-center shadow-lg">
                        <Check size={10} className="text-primary-foreground" strokeWidth={3.5} />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Recruit count chip — only for premium so user knows the threshold */}
                      {(isApex || isLegend) && (
                        <span className="text-[9px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded bg-background/70 text-foreground/90 border border-foreground/15">
                          {r.count} recruits
                        </span>
                      )}
                      <p
                        className={cn(
                          "font-display font-black text-sm tracking-tight",
                          isApex && "text-[hsl(28_100%_72%)] text-amber-950",
                          isLegend && "text-[hsl(45_95%_72%)]",
                          !r.premium && r.unlocked && "text-gold",
                          !r.premium && !r.unlocked && "text-foreground"
                        )}
                      >
                        {r.title}
                      </p>
                      {!r.unlocked && (isApex || isLegend) && (
                        <span
                          className={cn(
                            "text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border",
                            isLegend ? "border-[hsl(280_70%_60%/0.5)] bg-[hsl(280_70%_30%/0.4)] text-[hsl(280_75%_85%)]" : "border-[hsl(18_95%_62%/0.5)] bg-[hsl(18_95%_30%/0.4)] text-[hsl(18_95%_80%)]"
                          )}
                        >
                          Prize
                        </span>
                      )}
                      {isNext && !r.unlocked && !r.premium && (
                        <span className="ml-auto text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold/15 text-gold border border-gold/30">
                          Next
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      "text-[11px] mt-0.5 line-clamp-2 leading-snug",
                      (isApex || isLegend) ? "text-foreground/75" : "text-muted-foreground"
                    )}>
                      {r.reward}
                    </p>
                    {isNext && !r.unlocked && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden relative">
                          <div
                            className={cn(
                              "h-full transition-all duration-500 relative",
                              isLegend
                                ? "bg-[linear-gradient(90deg,hsl(280_70%_60%),hsl(45_90%_60%),hsl(350_80%_60%))]"
                                : isApex
                                  ? "bg-[linear-gradient(90deg,hsl(18_95%_62%),hsl(45_90%_60%))]"
                                  : "gradient-gold"
                            )}
                            style={{ width: `${progress}%` }}
                          >
                            {(isApex || isLegend) && (
                              <span className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,hsl(45_95%_85%/0.6)_50%,transparent_70%)] animate-[shimmer_2.4s_linear_infinite]" />
                            )}
                          </div>
                        </div>
                        <span className={cn("text-[10px] font-bold tabular-nums shrink-0", isLegend ? "text-[hsl(280_75%_85%)]" : isApex ? "text-[hsl(18_95%_75%)]" : "text-gold")}>
                          {referralCount}/{r.count}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Inviters — social proof & competition */}
      <div className="mt-6 animate-reveal animate-reveal-delay-4">
        <TopInvitersWidget hideEmptyCta />
      </div>

      {/* Recent Referrals */}
      {referrals && referrals.length > 0 && (
        <div className="mt-6 animate-reveal animate-reveal-delay-4">
          <h2 className="font-display font-bold text-sm mb-3 tracking-tight">Recent Invites</h2>
          <div className="space-y-2">
            {referrals.map((ref: any) => (
              <div key={ref.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="h-8 w-8 rounded-full bg-gold/10 flex items-center justify-center">
                  <Users size={14} className="text-gold" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">
                    {new Date(ref.created_at).toLocaleDateString()}
                  </p>
                </div>
                {ref.rewarded && <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">Rewarded</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      <StoryShareModal
        open={shareCardOpen}
        onClose={() => setShareCardOpen(false)}
        variant="referral"
        referralCode={referralCode}
        referralLink={referralLink}
      />
    </div>
  );
};

export default Referrals;
