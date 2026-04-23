import { useState } from "react";
import { Copy, Check, Gift, Users, Share2, Trophy, ChevronLeft, Zap, Crown, Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";
import TopInvitersWidget from "@/components/TopInvitersWidget";
import { useReferralStats } from "@/hooks/use-referral-stats";
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
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join The W Tracker",
          text: `Join The W Tracker and level up your discipline. Use my referral link to get started!`,
          url: referralLink,
        });
      } catch {}
    } else {
      handleCopy();
    }
  };

  const referralCount = stats?.convertedCount ?? profile.referral_count ?? 0;
  const daysAsApex = stats?.daysAsApex ?? 0;
  const legendPinned = stats?.legendPinned ?? false;

  const rewards: Reward[] = [
    { count: 1, title: "First Recruit", reward: "+250 XP · First Recruit badge", emoji: "🎯", unlocked: referralCount >= 1 },
    { count: 3, title: "1 Month Free", reward: "30 days of membership credits", emoji: "🎟️", unlocked: referralCount >= 3 },
    { count: 5, title: "2 Months Free", reward: "60 days credits · Brand Ambassador badge", emoji: "🥈", unlocked: referralCount >= 5 },
    { count: 10, title: "Apex Instant", reward: "30 days Apex tier · Inner Circle badge · Tribe creation", emoji: "⚡", unlocked: referralCount >= 10, premium: "apex" },
    { count: 25, title: "Lifetime Membership", reward: "Forever member credits · Kingmaker badge", emoji: "👑", unlocked: referralCount >= 25 },
    { count: 50, title: "Founders Circle", reward: "Permanent Legend pin · Lifetime Apex · Founders badge", emoji: "🔱", unlocked: referralCount >= 50 || legendPinned, premium: "legend" },
  ];

  const nextReward = rewards.find((r) => !r.unlocked);
  const nextProgress = nextReward ? Math.min(100, Math.round((referralCount / nextReward.count) * 100)) : 100;
  const remainingToNext = nextReward ? Math.max(0, nextReward.count - referralCount) : 0;
  const nextIsPremium = nextReward?.premium;

  // SVG conic progress ring
  const ringSize = 132;
  const ringStroke = 8;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (nextProgress / 100) * ringCirc;

  return (
    <div className="min-h-screen pb-4 px-4 pt-4 safe-top">
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

      {/* Share Card */}
      <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-gold/20 bg-card p-6 text-center mb-4">
        <div className="h-16 w-16 rounded-full gradient-gold flex items-center justify-center glow-gold mx-auto mb-4">
          <Gift size={28} className="text-primary-foreground" />
        </div>
        <h2 className="font-display font-bold text-lg mb-1">Spread the Discipline</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Invite friends and unlock XP, Apex Instant and permanent Legend status.
        </p>

        {/* Referral Link */}
        <div className="flex items-center gap-2 bg-secondary rounded-lg p-3 mb-4">
          <p className="flex-1 text-xs text-muted-foreground truncate text-left font-mono">
            {referralLink}
          </p>
          <button
            onClick={handleCopy}
            className="shrink-0 p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors active:scale-95"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>

        <div className="flex gap-2">
          <Button variant="ember" size="lg" className="flex-1" onClick={handleNativeShare}>
            <Share2 size={16} />
            Share Link
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

      {/* Lifetime club banner */}
      {referralCount >= 25 && referralCount < 50 && !legendPinned && (
        <div className="animate-reveal mb-4 rounded-xl border border-gold/35 bg-gradient-to-r from-gold/[0.08] via-gold/[0.04] to-transparent p-3 flex items-center gap-3">
          <Sparkles size={18} className="text-gold shrink-0" />
          <p className="text-xs font-bold text-foreground leading-tight">
            You're in the Lifetime club. <span className="text-gold">{50 - referralCount} more</span> for permanent Legend.
          </p>
        </div>
      )}

      {/* Rewards Tiers */}
      <div className="animate-reveal animate-reveal-delay-3">
        <div className="flex items-end justify-between mb-3">
          <h2 className="font-display font-bold text-sm tracking-tight">Referral Rewards</h2>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
            Paid conversions only
          </p>
        </div>
        <div className="space-y-2.5">
          {rewards.map((r, idx) => {
            const isNext = !r.unlocked && rewards.slice(0, idx).every((p) => p.unlocked);
            const progress = Math.min(100, Math.round((referralCount / r.count) * 100));
            const tileSize = [48, 52, 56, 60, 64, 72][idx];
            const isApex = r.premium === "apex";
            const isLegend = r.premium === "legend";
            return (
              <div
                key={r.count}
                className={cn(
                  "relative overflow-hidden rounded-xl border p-4 transition-all",
                  // Premium skins
                  isApex && !r.unlocked && "border-transparent bg-[linear-gradient(135deg,hsl(18_60%_10%/0.55),hsl(45_70%_8%/0.4))] shadow-[0_0_28px_-12px_hsl(18_95%_62%/0.5)]",
                  isApex && r.unlocked && "border-transparent bg-[linear-gradient(135deg,hsl(18_60%_14%/0.7),hsl(45_70%_10%/0.55))] shadow-[0_0_38px_-8px_hsl(18_95%_62%/0.6)]",
                  isLegend && !r.unlocked && "border-transparent bg-[linear-gradient(135deg,hsl(280_50%_12%/0.55),hsl(45_60%_10%/0.4),hsl(350_50%_12%/0.45))] shadow-[0_0_30px_-12px_hsl(280_70%_60%/0.5)]",
                  isLegend && r.unlocked && "border-transparent bg-[linear-gradient(135deg,hsl(280_50%_15%/0.75),hsl(45_60%_12%/0.55),hsl(350_50%_15%/0.6))] shadow-[0_0_42px_-6px_hsl(280_70%_60%/0.6)]",
                  // Default skins
                  !r.premium && r.unlocked && "border-gold/50 bg-gradient-to-br from-gold/[0.12] via-gold/[0.06] to-transparent glow-gold-sm",
                  !r.premium && !r.unlocked && isNext && "border-gold/25 bg-card",
                  !r.premium && !r.unlocked && !isNext && "border-border bg-card opacity-70"
                )}
              >
                {/* Premium overlays */}
                {(isApex || isLegend) && (
                  <>
                    <div className="pointer-events-none absolute inset-0 opacity-50 bg-[linear-gradient(115deg,transparent_30%,hsl(45_85%_70%/0.16)_50%,transparent_70%)]" />
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
                  </>
                )}
                {isLegend && (
                  <>
                    <Sparkles className="absolute top-2 right-2 text-gold/70" size={12} />
                    <Sparkles className="absolute bottom-2 left-2 text-[hsl(280_70%_70%)]/70" size={10} />
                  </>
                )}

                <div className="relative flex items-center gap-3">
                  <div
                    className={cn(
                      "rounded-full flex items-center justify-center font-black shrink-0 relative",
                      r.unlocked && !r.premium && "gradient-gold text-primary-foreground shadow-lg shadow-gold/30",
                      isApex && "bg-[linear-gradient(135deg,hsl(18_95%_55%),hsl(45_95%_55%))] text-background border border-gold-light/60 shadow-[0_0_18px_hsl(18_95%_62%/0.55)]",
                      isLegend && "bg-[linear-gradient(135deg,hsl(280_70%_50%),hsl(45_90%_55%),hsl(350_80%_55%))] text-background border border-gold-light/60 shadow-[0_0_22px_hsl(280_70%_60%/0.55)]",
                      !r.unlocked && !r.premium && "bg-secondary text-muted-foreground border border-border"
                    )}
                    style={{ width: tileSize, height: tileSize, fontSize: tileSize / 3 }}
                  >
                    {isApex ? (
                      <Zap size={tileSize / 2.2} strokeWidth={2.5} />
                    ) : isLegend ? (
                      <Crown size={tileSize / 2.2} strokeWidth={2.5} />
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
                      <span className="text-base">{r.emoji}</span>
                      <p
                        className={cn(
                          "font-display font-black text-sm tracking-tight",
                          isApex && "bg-gradient-to-r from-[hsl(18_95%_62%)] via-gold to-[hsl(18_95%_62%)] bg-clip-text text-transparent",
                          isLegend && "bg-gradient-to-r from-[hsl(280_70%_70%)] via-gold to-[hsl(350_80%_65%)] bg-clip-text text-transparent",
                          !r.premium && r.unlocked && "text-gold",
                          !r.premium && !r.unlocked && "text-foreground"
                        )}
                      >
                        {isApex ? "APEX INSTANT" : isLegend ? "FOUNDERS CIRCLE" : r.title}
                      </p>
                      {!r.unlocked && (isApex || isLegend) && (
                        <span
                          className={cn(
                            "text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border",
                            isLegend ? "border-[hsl(280_70%_60%/0.5)] bg-[hsl(280_70%_30%/0.25)] text-[hsl(280_75%_80%)]" : "border-[hsl(18_95%_62%/0.5)] bg-[hsl(18_95%_30%/0.25)] text-[hsl(18_95%_75%)]"
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
                      {isNext && !r.unlocked && r.premium && (
                        <span className="ml-auto text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-background/60 text-foreground border border-gold/40">
                          Next
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{r.reward}</p>
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
                        <span className={cn("text-[10px] font-bold tabular-nums shrink-0", isLegend ? "text-[hsl(280_75%_80%)]" : isApex ? "text-[hsl(18_95%_70%)]" : "text-gold")}>
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
    </div>
  );
};

export default Referrals;
