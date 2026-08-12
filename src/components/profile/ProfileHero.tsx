import { Crown, Camera, Trophy, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTierUsernameClass } from "@/lib/status-tiers";
import StatusNameplate from "@/components/StatusNameplate";
import ApexBadge from "@/components/ApexBadge";
import BadgeShowcase from "@/components/BadgeShowcase";
import { avatarUrl } from "@/lib/img";

interface RankData {
  rank?: number | null;
  totalUsers?: number;
  percentile?: number;
  hasRank?: boolean;
}

export interface ProfileHeroProps {
  profile: any;
  isElite: boolean;
  isApexSubscriber: boolean;
  uploadingAvatar: boolean;
  avatarInputRef: React.RefObject<HTMLInputElement>;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  heroBgClass: string;
  heroTopGlowStyle: string;
  tier: string;
  rankData?: RankData | null;
  championHistory?: { wins: number } | null;
  tierMessage?: string;
  featuredBadge: any | null;
  earnedBadges: any[] | undefined;
  onPreviewBadge: (badge: any) => void;
  verified?: boolean;
}

/**
 * Profile hero card (avatar, nameplate, status pills, XP, featured badge, badge
 * row). Extracted from Profile.tsx. Glows calmed for the restrained look:
 * dimmer avatar halo, no XP text drop-shadow, flat PREMIUM ribbon, softer vignette.
 */
const ProfileHero = ({
  profile,
  isElite,
  isApexSubscriber,
  uploadingAvatar,
  avatarInputRef,
  onAvatarUpload,
  heroBgClass,
  heroTopGlowStyle,
  tier,
  rankData,
  championHistory,
  tierMessage,
  featuredBadge,
  earnedBadges,
  onPreviewBadge,
  verified,
}: ProfileHeroProps) => {
  return (
    <div className={cn(
      "animate-reveal relative mb-6 overflow-hidden rounded-3xl border p-6 pt-10 pb-7",
      heroBgClass,
    )}>
      {/* Top vignette glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[160%] h-64 blur-3xl opacity-40"
        style={{ background: heroTopGlowStyle }}
      />
      {/* Top accent line */}
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />

      <div className="relative flex flex-col items-center text-center">
        {/* Avatar — large, gold ring, camera/crown badge */}
        <div className="relative mb-5">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onAvatarUpload}
          />
          <div className="absolute inset-0 -m-3 rounded-full bg-gold/15 blur-2xl" aria-hidden />
          {profile.avatar_url ? (
            <img
              src={avatarUrl(profile.avatar_url, 128)}
              alt={profile.username}
              decoding="async"
              className="relative h-32 w-32 rounded-full object-cover ring-2 ring-gold ring-offset-4 ring-offset-background"
            />
          ) : (
            <div className="relative h-32 w-32 rounded-full gradient-gold flex items-center justify-center text-5xl font-black font-display text-primary-foreground ring-2 ring-gold ring-offset-4 ring-offset-background">
              {profile.username?.charAt(0)?.toUpperCase()}
            </div>
          )}
          {isElite ? (
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 h-10 w-10 rounded-full bg-background border border-gold/40 flex items-center justify-center transition-all hover:bg-gold/10 active:scale-95"
            >
              {uploadingAvatar ? (
                <span className="text-[10px] text-gold animate-pulse">...</span>
              ) : (
                <Camera size={16} className="text-gold" />
              )}
            </button>
          ) : (
            <div className="absolute -bottom-1 -right-1 h-10 w-10 rounded-full bg-background border border-gold/40 flex items-center justify-center">
              <Crown size={18} className="text-gold" />
            </div>
          )}
        </div>

        {/* PREMIUM ribbon — only for Founding Apex subscribers */}
        {isApexSubscriber && (
          <div className="mt-4 mb-1 flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-sm text-[10px] font-black uppercase tracking-[0.14em] bg-gold/15 text-gold border border-gold/40">
              <Crown size={11} strokeWidth={3} />
              Premium · Day-One
            </span>
          </div>
        )}

        {/* Username — colored by status tier */}
        <h1 className={cn(
          "font-display text-[34px] leading-none font-black tracking-tight",
          getTierUsernameClass(profile.status_tier || 'recruit'),
        )}>
          @{profile.username}
        </h1>

        {/* Status nameplate */}
        <div className="mt-5 w-full">
          <StatusNameplate
            tier={tier}
            rank={rankData?.rank ?? undefined}
            totalUsers={rankData?.totalUsers}
            percentile={rankData?.percentile}
            ranked={rankData?.hasRank ?? false}
            size="lg"
          />
        </div>

        {/* Status pills — Apex/Legend supersede Elite (no duplicate badges) */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {profile.status_tier === 'apex' ? (
            <ApexBadge isFounding={isApexSubscriber} size="md" />
          ) : profile.status_tier === 'legend' ? (
            <ApexBadge tier="legend" size="md" />
          ) : isElite ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gold/45 bg-gold/5">
              <Crown size={12} className="text-gold" />
              <span className="text-[11px] font-black text-gold tracking-wider uppercase">Elite</span>
            </span>
          ) : null}
          <span className="inline-flex items-center px-3 py-1.5 rounded-full">
            <span className="text-[11px] font-black tracking-wider text-muted-foreground/80 uppercase">
              Lv {profile.level}
            </span>
          </span>
          {championHistory && championHistory.wins > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gold/45 bg-gold/5">
              <Trophy size={12} className="text-gold" />
              <span className="text-[11px] font-black text-gold tracking-wider uppercase">Season Champion</span>
            </span>
          )}
          {verified && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[hsl(var(--xp-green))]/45 bg-[hsl(var(--xp-green))]/10">
              <ShieldCheck size={12} className="text-[hsl(var(--xp-green))]" />
              <span className="text-[11px] font-black text-[hsl(var(--xp-green))] tracking-wider uppercase">Verified</span>
            </span>
          )}
        </div>

        {/* Hero XP — massive */}
        <div className="mt-6 flex flex-col items-center">
          <p className="font-display font-black text-[64px] leading-none text-gold tabular-nums">
            {(profile.xp ?? 0).toLocaleString().replace(/,/g, " ")}
          </p>
          <p className="text-[10px] font-black tracking-[0.32em] text-gold/70 mt-2">TOTAL XP</p>
        </div>

        {/* Tier message — italic, subtle */}
        <p className="text-sm text-muted-foreground/70 font-medium italic mt-5 max-w-[280px]">
          {tierMessage}
        </p>

        {/* Featured badge title (kept, subtle, only if set) */}
        {featuredBadge && (
          <span className="mt-4 flex items-center gap-1.5 bg-gold/10 px-2.5 py-1 rounded-full border border-gold/30">
            <span className="text-sm">{featuredBadge.icon}</span>
            <span className="font-bold text-gold text-[10px] tracking-wider uppercase">{featuredBadge.name}</span>
          </span>
        )}

        {/* Badge row — circular icons */}
        {earnedBadges && earnedBadges.length > 0 && (
          <div className="mt-7 w-full">
            <BadgeShowcase
              badges={earnedBadges}
              totalEarned={earnedBadges.length}
              onBadgeClick={onPreviewBadge}
            />
          </div>
        )}
      </div>

      {/* Bottom accent line */}
      <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
    </div>
  );
};

export default ProfileHero;
