import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getTierUsernameClass, formatTier } from "@/lib/status-tiers";
import StatusNameplate from "@/components/StatusNameplate";
import ApexBadge from "@/components/ApexBadge";
import StatusAvatar from "@/components/StatusAvatar";
import StreakFlameInline from "@/components/StreakFlameInline";
import FeaturedBadgeHero from "@/components/FeaturedBadgeHero";
import { Crown, Trophy, ShieldCheck, Lock, Shield } from "lucide-react";

export interface IdentityRankData {
  rank?: number | null;
  totalUsers?: number;
  percentile?: number;
  hasRank?: boolean;
}

export interface IdentityCoreProps {
  profile: any;
  rankData?: IdentityRankData | null;
  championWins?: number;
  verified?: boolean;
  tierMessage?: string;
  featuredBadge?: { name: string; icon: string; rarity?: string | null } | null;
  /** Custom avatar block (own profile adds the camera button). */
  avatarSlot?: ReactNode;
  /** Rendered inline after the @handle (e.g. the "(you)" tag). */
  nameSuffix?: ReactNode;
  /** Show the permanent-username lock next to the handle. */
  showLock?: boolean;
  nameplateSize?: "md" | "lg";
  /** Rendered between the pill row and the XP block (e.g. activity pulse). */
  afterPills?: ReactNode;
}

/**
 * The shared identity center of every profile hero — /profile and /user/:id
 * render the exact same block (PublicProfile keeps its intentional IG-compact
 * marketing layout). One tier ladder, one pill language, one rank source.
 *
 * Deliberately auth-free: /u/ is an anonymous route, so everything flows in
 * via props — no useAuth inside.
 */
const IdentityCore = ({
  profile,
  rankData,
  championWins = 0,
  verified,
  tierMessage,
  featuredBadge,
  avatarSlot,
  nameSuffix,
  showLock,
  nameplateSize = "lg",
  afterPills,
}: IdentityCoreProps) => {
  const tier = profile.status_tier || "recruit";
  const division = (profile as any).tier_division ?? 0;
  const isApexSubscriber = Boolean((profile as any).is_apex_subscriber);
  const isLegendPinned = Boolean((profile as any).legend_pinned);
  const shields = Number(profile.streak_shields ?? 0);

  return (
    <div className="relative flex flex-col items-center text-center">
      {/* Avatar */}
      {avatarSlot ?? (
        <div className="relative mb-4">
          <div className="absolute inset-0 -m-3 rounded-full bg-gold/15 blur-2xl" aria-hidden />
          <StatusAvatar
            src={profile.avatar_url}
            name={profile.username}
            tier={tier}
            size="xl"
            className="relative"
          />
        </div>
      )}

      {/* PREMIUM ribbon — Founding Apex subscribers, one quiet style */}
      {isApexSubscriber && (
        <div className="mt-2 mb-1 flex justify-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-sm text-[10px] font-black uppercase tracking-[0.22em] bg-gold/15 text-gold border border-gold/40">
            <Crown size={11} strokeWidth={3} />
            Premium · Day-One
          </span>
        </div>
      )}

      {/* @handle — tier-colored */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <h1 className={cn(
          "font-display text-[32px] leading-none font-black tracking-tight",
          getTierUsernameClass(tier),
        )}>
          @{profile.username}
          {nameSuffix}
        </h1>
        {showLock && (
          <Lock size={13} className="text-muted-foreground/50 shrink-0" aria-label="Permanent username" />
        )}
      </div>

      {/* Status nameplate — the one rank number */}
      <div className="mt-4 w-full">
        <StatusNameplate
          tier={tier}
          rank={rankData?.rank ?? undefined}
          totalUsers={rankData?.totalUsers}
          percentile={rankData?.percentile}
          ranked={rankData?.hasRank ?? false}
          size={nameplateSize}
        />
      </div>

      {/* Status pills — Apex/Legend supersede Elite; Elite gets its earned pill */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
        {tier === "apex" ? (
          <ApexBadge isFounding={isApexSubscriber} size="md" />
        ) : tier === "legend" ? (
          <ApexBadge tier="legend" size="md" />
        ) : tier === "elite" ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gold/45 bg-gold/5">
            <Crown size={12} className="text-gold" />
            <span className="text-[11px] font-black text-gold tracking-wider uppercase">{formatTier("elite", division)}</span>
          </span>
        ) : null}
        {championWins > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gold/45 bg-gold/5">
            <Trophy size={12} className="text-gold" />
            <span className="text-[11px] font-black text-gold tracking-wider uppercase">
              {championWins > 1 ? `${championWins}× ` : ""}Season Champion
            </span>
          </span>
        )}
        {verified && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[hsl(var(--xp-green))]/45 bg-[hsl(var(--xp-green))]/10">
            <ShieldCheck size={12} className="text-[hsl(var(--xp-green))]" />
            <span className="text-[11px] font-black text-[hsl(var(--xp-green))] tracking-wider uppercase">Verified</span>
          </span>
        )}
        {isLegendPinned && tier !== "legend" && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[hsl(280_70%_60%)]/45 bg-[hsl(280_70%_55%)]/10">
            <Crown size={12} className="text-[hsl(280_70%_70%)]" />
            <span className="text-[11px] font-black tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-[hsl(280_70%_70%)] via-gold to-[hsl(350_80%_60%)]">
              Founders Circle
            </span>
          </span>
        )}
      </div>

      {afterPills}

      {/* Hero XP — massive */}
      <div className="mt-6 flex flex-col items-center">
        <p className="font-display font-black text-[64px] leading-none text-gold tabular-nums">
          {(profile.xp ?? 0).toLocaleString().replace(/,/g, " ")}
        </p>
        <p className="text-[10px] font-black tracking-[0.22em] text-gold/70 mt-2">TOTAL XP</p>
      </div>

      {/* Tri-stat strip — streak (+shields), best streak, level: same on every hero */}
      <div className="mt-6 w-full grid grid-cols-3 divide-x divide-border/40 rounded-2xl border border-border/40 bg-background/30 backdrop-blur-sm py-3">
        <div className="flex flex-col items-center gap-0.5 px-1">
          <StreakFlameInline streak={profile.streak ?? 0} suffix="d" className="text-[15px]" />
          <span className="eyebrow inline-flex items-center gap-1">
            Streak
            {shields > 0 && (
              <span className="inline-flex items-center gap-0.5 text-gold normal-case tracking-normal">
                <Shield size={8} fill="currentColor" />{shields}
              </span>
            )}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-1">
          <span className="font-display font-black text-[15px] tabular-nums text-foreground/90">
            {profile.longest_streak ?? 0}d
          </span>
          <span className="eyebrow">Best</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-1">
          <span className="font-display font-black text-[15px] tabular-nums text-foreground/90">
            {profile.level ?? 1}
          </span>
          <span className="eyebrow">Level</span>
        </div>
      </div>

      {/* Tier message — italic, subtle */}
      {tierMessage && (
        <p className="text-sm text-muted-foreground/70 font-medium italic mt-5 max-w-[280px]">
          {tierMessage}
        </p>
      )}

      {/* Featured badge title — one component everywhere */}
      {featuredBadge && (
        <div className="mt-4 flex justify-center">
          <FeaturedBadgeHero
            name={featuredBadge.name}
            icon={featuredBadge.icon}
            rarity={featuredBadge.rarity as any}
          />
        </div>
      )}
    </div>
  );
};

export default IdentityCore;
