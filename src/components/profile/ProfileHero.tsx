import { Camera, Pencil, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTierHeroSurface } from "@/lib/status-tiers";
import BadgeShowcase from "@/components/BadgeShowcase";
import StatusAvatar from "@/components/StatusAvatar";
import IdentityCore, { type IdentityRankData } from "@/components/profile/IdentityCore";
import { format } from "date-fns";

export interface ProfileHeroProps {
  profile: any;
  isApexSubscriber: boolean;
  uploadingAvatar: boolean;
  avatarInputRef: React.RefObject<HTMLInputElement>;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  tier: string;
  rankData?: IdentityRankData | null;
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
 * /profile so this is the ONE identity block). The shared IdentityCore
 * renders the center (same block as /user/:id); this card adds the
 * own-profile affordances: camera on the avatar, pencil on the name,
 * share button, badge showcase and the member-since line.
 */
const ProfileHero = ({
  profile,
  isApexSubscriber: _isApexSubscriber, // read from profile inside IdentityCore
  uploadingAvatar,
  avatarInputRef,
  onAvatarUpload,
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
  const surface = getTierHeroSurface(tier);

  return (
    <div className={cn(
      "animate-reveal relative mb-6 overflow-hidden rounded-3xl border p-6 pt-8 pb-7",
      surface.bgClass,
    )}>
      {/* Top vignette glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[160%] h-64 blur-3xl opacity-40"
        style={{ background: surface.glowStyle }}
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

      <IdentityCore
        profile={profile}
        rankData={rankData}
        championWins={championHistory?.wins ?? 0}
        verified={verified}
        tierMessage={tierMessage}
        featuredBadge={featuredBadge}
        showLock
        nameplateSize="lg"
        avatarSlot={
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
        }
        displayNameSlot={
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
        }
      />

      <div className="relative flex flex-col items-center text-center">
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
