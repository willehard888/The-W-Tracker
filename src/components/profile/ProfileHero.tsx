import { Camera, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTierHeroSurface } from "@/lib/status-tiers";
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
  featuredBadge: any | null;
  verified?: boolean;
  onShare: () => void;
}

/**
 * Profile hero — the identity card (the global StatusHeader is hidden on
 * /profile so this is the ONE identity block). The shared IdentityCore
 * renders the center (same block as /user/:id); this card adds the
 * own-profile affordances: camera on the avatar, the share button, badge
 * showcase and the member-since line. (Display names are gone — the ONE
 * name in this app is the permanent @handle.)
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
  featuredBadge,
  verified,
  onShare,
}: ProfileHeroProps) => {
  const surface = getTierHeroSurface(tier);

  return (
    <div className={cn(
      "home-rise home-rise-1 relative mb-6 overflow-hidden rounded-3xl border p-6 pt-8 pb-7",
      surface.bgClass,
    )}>
      {/* Top vignette glow — a painted radial, not a blurred layer: blur-3xl
          here cost a compositing layer inside the app's one scroller. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[160%] h-64 opacity-50"
        style={{ background: surface.glowStyle }}
      />
      {/* Top accent line */}
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />

      {/* Share profile — quiet icon, top-right */}
      <button
        type="button"
        onClick={onShare}
        aria-label="Share profile"
        className="press absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-background/80 border border-border/60 flex items-center justify-center text-muted-foreground hover:text-gold hover:border-gold/40 transition-colors before:absolute before:-inset-2 before:content-['']"
      >
        <Share2 aria-hidden size={15} />
      </button>

      <IdentityCore
        profile={profile}
        rankData={rankData}
        championWins={championHistory?.wins ?? 0}
        verified={verified}
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
            <StatusAvatar
              src={profile.avatar_url}
              name={profile.username}
              tier={tier}
              size="xl"
              className="relative rounded-full shadow-[0_0_0_3px_hsl(var(--gold)/0.18)]"
            />
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Change profile photo"
              className="absolute -bottom-1 -right-1 h-10 w-10 rounded-full bg-background border border-gold/40 flex items-center justify-center transition-colors hover:bg-gold/10 before:absolute before:-inset-1 before:content-['']"
            >
              {uploadingAvatar ? (
                <span className="text-label text-gold animate-pulse">…</span>
              ) : (
                <Camera aria-hidden size={16} className="text-gold" />
              )}
            </button>
          </div>
        }
      />

      <div className="relative flex flex-col items-center text-center">
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
