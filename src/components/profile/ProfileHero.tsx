import { Crown, Camera, Trophy, ShieldCheck, Lock, Pencil, Share2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTierUsernameClass } from "@/lib/status-tiers";
import StatusNameplate from "@/components/StatusNameplate";
import ApexBadge from "@/components/ApexBadge";
import BadgeShowcase from "@/components/BadgeShowcase";
import StatusAvatar from "@/components/StatusAvatar";
import StreakFlameInline from "@/components/StreakFlameInline";
import { format } from "date-fns";

interface RankData {
  rank?: number | null;
  totalUsers?: number;
  percentile?: number;
  hasRank?: boolean;
}

export interface ProfileHeroProps {
  profile: any;
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
  onShare: () => void;
  onEditName: () => void;
}

/**
 * Profile hero — the identity card (the global StatusHeader is hidden on
 * /profile so this is the ONE identity block, not a repeat of the bar above).
 * Tier-themed gradient stays; inside: shared StatusAvatar with an
 * everyone-can-edit camera, tier-colored @handle with the permanent-name lock,
 * editable display name, rank nameplate, status pills, the massive XP, and a
 * tri-stat strip that finally puts the streak on the profile.
 */
const ProfileHero = ({
  profile,
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
  onShare,
  onEditName,
}: ProfileHeroProps) => {
  const shields = Number(profile.streak_shields ?? 0);

  return (
    <div className={cn(
      "animate-reveal relative mb-6 overflow-hidden rounded-3xl border p-6 pt-8 pb-7",
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

      {/* Share profile — quiet icon, top-right */}
      <button
        type="button"
        onClick={onShare}
        aria-label="Share profile"
        className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-background/50 border border-border/60 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-gold hover:border-gold/40 active:scale-95 transition"
      >
        <Share2 size={15} />
      </button>

      <div className="relative flex flex-col items-center text-center">
        {/* Avatar — shared StatusAvatar (tier ring + badge), camera for everyone */}
        <div className="relative mb-4">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onAvatarUpload}
          />
          <div className="absolute inset-0 -m-3 rounded-full bg-gold/15 blur-2xl" aria-hidden />
          <StatusAvatar
            src={profile.avatar_url}
            name={profile.username}
            tier={tier}
            size="xl"
            className="relative"
          />
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Change profile photo"
            className="absolute -bottom-1 -right-1 h-10 w-10 rounded-full bg-background border border-gold/40 flex items-center justify-center transition-all hover:bg-gold/10 active:scale-95"
          >
            {uploadingAvatar ? (
              <span className="text-[10px] text-gold animate-pulse">...</span>
            ) : (
              <Camera size={16} className="text-gold" />
            )}
          </button>
        </div>

        {/* PREMIUM ribbon — only for Founding Apex subscribers */}
        {isApexSubscriber && (
          <div className="mt-2 mb-1 flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-sm text-[10px] font-black uppercase tracking-[0.22em] bg-gold/15 text-gold border border-gold/40">
              <Crown size={11} strokeWidth={3} />
              Premium · Day-One
            </span>
          </div>
        )}

        {/* @handle — tier-colored, with the permanent-name lock */}
        <div className="flex items-center gap-2">
          <h1 className={cn(
            "font-display text-[32px] leading-none font-black tracking-tight",
            getTierUsernameClass(profile.status_tier || 'recruit'),
          )}>
            @{profile.username}
          </h1>
          <Lock size={13} className="text-muted-foreground/50 shrink-0" aria-label="Permanent username" />
        </div>

        {/* Display name — the human name under the handle, editable */}
        <button
          type="button"
          onClick={onEditName}
          className="mt-1.5 inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground/90 active:scale-95 transition group"
        >
          {profile.display_name ? (
            <span className="text-sm font-semibold">{profile.display_name}</span>
          ) : (
            <span className="text-xs font-medium text-muted-foreground/60">Add your name</span>
          )}
          <Pencil size={11} className="text-muted-foreground/50 group-hover:text-gold transition-colors" />
        </button>

        {/* Status nameplate */}
        <div className="mt-4 w-full">
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
          ) : null}
          {championHistory && championHistory.wins > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gold/45 bg-gold/5">
              <Trophy size={12} className="text-gold" />
              <span className="text-[11px] font-black text-gold tracking-wider uppercase">
                {championHistory.wins > 1 ? `${championHistory.wins}× ` : ""}Season Champion
              </span>
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
          <p className="text-[10px] font-black tracking-[0.22em] text-gold/70 mt-2">TOTAL XP</p>
        </div>

        {/* Tri-stat strip — the streak finally lives on the profile */}
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

        {/* Member since — quiet closing line */}
        {profile.created_at && (
          <p className="eyebrow mt-6">
            Member since {format(new Date(profile.created_at), "MMM yyyy")}
          </p>
        )}
      </div>

      {/* Bottom accent line */}
      <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
    </div>
  );
};

export default ProfileHero;
