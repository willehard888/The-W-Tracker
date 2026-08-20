import {
  Crown, Zap, Users, Swords, ArrowLeft, UserCheck, ShieldAlert,
  Settings, UserPlus, Trash2, LogOut, Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import TierUsername from "@/components/TierUsername";
import { useSignedMediaUrl } from "@/lib/signed-url";
export interface TribeMember {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string | null;
  role: string;
  streak?: number;
}

export interface TribeHeaderProps {
  tribe: any;
  parallax: number;
  members: TribeMember[];
  isMember: boolean;
  isOwner: boolean;
  pendingCount: number;
  reportedCount: number;
  onNavigateUser: (userId: string) => void;
  onNavigateBattles: () => void;
  onOpenPending: () => void;
  onOpenReports: () => void;
  onJoin: () => void;
  onManage: () => void;
  onInvite: () => void;
  onDelete: () => void;
  onLeave: () => void;
  onShare: () => void;
  /** Owner-only week strip: today's check-in pulse (null while loading). */
  ownerPulse?: { checked: number; total: number } | null;
}

/**
 * The cinematic tribe header: cover photo + parallax, name, founder, member
 * count, paused/claim banner, battles entry, owner request/report shortcuts,
 * and the join/manage/invite/leave action row. Extracted from TribeDetail.tsx;
 * the claim RPC and dialog toggles are passed in so this stays presentational.
 */
const TribeHeader = ({
  tribe,
  parallax,
  members,
  isMember,
  isOwner,
  pendingCount,
  reportedCount,
  onNavigateUser,
  onNavigateBattles,
  onOpenPending,
  onOpenReports,
  onJoin,
  onManage,
  onInvite,
  onDelete,
  onLeave,
  onShare,
  ownerPulse,
}: TribeHeaderProps) => {
  // Covers live in the private feed-images bucket — sign + resize in one round.
  const coverSrc = useSignedMediaUrl(tribe.cover_url, { width: 640, quality: 68 });
  const founder = members.find((m) => m.role === "owner");

  return (
    <div className="relative mb-4 surface-card overflow-hidden">
      <div className="relative rounded-2xl p-5 overflow-hidden">
        {/* Cover photo background — owner-uploaded, dimmed for legibility */}
        {coverSrc && (
          <div className="absolute inset-0 pointer-events-none">
            <img
              src={coverSrc}
              alt=""
              decoding="async"
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-35"
              style={{ transform: `translateY(${parallax * 0.5}px) scale(1.05)` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/55 to-background/85" />
          </div>
        )}
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            transform: `translateY(${parallax}px)`,
            background: "radial-gradient(ellipse at top, hsl(var(--ember) / 0.18), transparent 70%)",
          }}
        />
        <div className="relative z-10">
          <div className="flex items-start gap-3">
            <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--ember))]/30 via-gold/15 to-[hsl(var(--ember))]/20 border border-[hsl(var(--ember))]/45 flex items-center justify-center shrink-0 shadow-[0_0_14px_hsl(var(--ember)/0.3)]">
              <Crown size={26} className="text-[hsl(var(--ember))] drop-shadow-[0_0_4px_hsl(var(--ember)/0.4)]" strokeWidth={2.4} />
              <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-gradient-to-br from-[hsl(var(--ember))] to-gold border-2 border-background flex items-center justify-center shadow-[0_0_6px_hsl(var(--ember)/0.4)]">
                <Zap size={10} className="text-background" strokeWidth={3.2} fill="currentColor" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-background/40 backdrop-blur-sm border border-[hsl(var(--ember))]/50 mb-1.5">
                <span className="text-[9px] font-black tracking-widest uppercase bg-gradient-to-r from-[hsl(var(--ember))] to-gold bg-clip-text text-transparent">
                  {tribe.is_paused ? "Paused Tribe" : "Apex Tribe"}
                </span>
              </div>
              {/* Name + member count live in the flame hero above — this card is
                  the tribe's details + actions (kept clear, no duplication). */}
              {founder && (
                <button
                  onClick={() => onNavigateUser(founder.user_id)}
                  className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gradient-to-r from-gold/20 to-[hsl(var(--ember))]/15 border border-gold/45 hover:from-gold/25 transition-colors"
                >
                  <Crown size={9} className="text-gold" strokeWidth={2.8} fill="currentColor" />
                  <span className="text-[9px] font-black tracking-widest uppercase text-gold">Founder</span>
                  <TierUsername
                    username={founder.username}
                    tier={founder.status_tier || "recruit"}
                    className="text-[10px] font-bold truncate max-w-[120px]"
                  />
                </button>
              )}
              {tribe.description && (
                <p className="text-xs text-foreground/75 mt-1 leading-snug">{tribe.description}</p>
              )}
            </div>
          </div>

          {/* Paused banner — owner lost Apex; offer Apex member to claim */}
          {tribe.is_paused && (
            <div className="mt-4 rounded-xl border border-muted-foreground/30 bg-gradient-to-br from-secondary/30 via-card/70 to-secondary/20 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted-foreground/15 border border-muted-foreground/40">
                  <Crown size={12} className="text-muted-foreground" />
                </span>
                <p className="text-[11px] font-black tracking-widest uppercase text-muted-foreground">
                  Tribe paused
                </p>
              </div>
              <p className="text-[12px] text-foreground/80 leading-snug">
                This tribe is on hold.
              </p>
            </div>
          )}

          {/* Owner week strip — the creator's pulse without opening a dashboard */}
          {isOwner && (
            <div className="mt-4 rounded-xl border border-border/50 bg-card/40 px-3 py-2.5">
              <p className="eyebrow mb-1">This week</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums text-gold">
                  <Zap size={10} fill="currentColor" /> +{(tribe.weekly_xp ?? 0).toLocaleString()} XP
                </span>
                {ownerPulse && ownerPulse.total > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums text-[hsl(var(--ember))]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--ember))]" />
                    {ownerPulse.checked}/{ownerPulse.total} lit today
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums text-muted-foreground">
                  <Users size={10} /> {tribe.member_count} member{tribe.member_count === 1 ? "" : "s"}
                </span>
                {pendingCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums text-gold">
                    <UserCheck size={10} /> {pendingCount} request{pendingCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>
          )}

          <button
            onClick={onNavigateBattles}
            className="mt-4 w-full rounded-xl border border-[hsl(var(--ember))]/45 bg-gradient-to-r from-[hsl(var(--ember))]/[0.10] to-gold/[0.06] hover:from-[hsl(var(--ember))]/15 hover:to-gold/10 transition-all p-2.5 flex items-center gap-2.5 text-left"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(var(--ember))] to-gold flex items-center justify-center shrink-0 shadow-[0_0_10px_hsl(var(--ember)/0.5)]">
              <Swords size={14} className="text-background" strokeWidth={2.6} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest font-black bg-gradient-to-r from-[hsl(var(--ember))] to-gold bg-clip-text text-transparent">
                Tribe Battles
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                Challenge another tribe to a collective XP battle
              </p>
            </div>
            <ArrowLeft size={14} className="text-muted-foreground rotate-180" />
          </button>

          {isOwner && pendingCount > 0 && (
            <button
              onClick={onOpenPending}
              className="mt-3 w-full rounded-xl border border-gold/45 bg-gradient-to-r from-gold/15 to-[hsl(var(--ember))]/10 hover:from-gold/20 transition-all p-2.5 flex items-center gap-2.5 text-left"
            >
              <div className="h-8 w-8 rounded-lg bg-gold/25 border border-gold/40 flex items-center justify-center shrink-0">
                <UserCheck size={14} className="text-gold" strokeWidth={2.6} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest font-black text-gold">Pending requests</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {pendingCount} {pendingCount === 1 ? "person wants" : "people want"} to join
                </p>
              </div>
              <span className="text-xs font-black tabular-nums text-gold">{pendingCount}</span>
            </button>
          )}

          {isOwner && reportedCount > 0 && (
            <button
              onClick={onOpenReports}
              className="mt-3 w-full rounded-xl border border-destructive/45 bg-gradient-to-r from-destructive/15 to-destructive/5 hover:from-destructive/20 transition-all p-2.5 flex items-center gap-2.5 text-left"
            >
              <div className="h-8 w-8 rounded-lg bg-destructive/25 border border-destructive/40 flex items-center justify-center shrink-0">
                <ShieldAlert size={14} className="text-destructive" strokeWidth={2.6} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest font-black text-destructive">Reported posts</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {reportedCount} {reportedCount === 1 ? "post needs" : "posts need"} your review
                </p>
              </div>
              <span className="text-xs font-black tabular-nums text-destructive">{reportedCount}</span>
            </button>
          )}

          <div className="flex gap-2 mt-3">
            {!isMember ? (
              <>
                <Button onClick={onJoin} size="sm" variant="ember" className="flex-1">
                  Join Tribe
                </Button>
                <Button onClick={onShare} size="sm" variant="ember-outline" className="px-3" aria-label="Share tribe">
                  <Share2 size={14} />
                </Button>
              </>
            ) : isOwner ? (
              <>
                <Button onClick={onManage} size="sm" variant="gold-outline"
                  className="flex-1">
                  <Settings size={14} /> Manage
                </Button>
                <Button onClick={onInvite} size="sm" variant="ember-outline"
                  className="flex-1">
                  <UserPlus size={14} /> Invite
                </Button>
                <Button onClick={onShare} size="sm" variant="ember-outline" className="px-3" aria-label="Share tribe">
                  <Share2 size={14} />
                </Button>
                <Button onClick={onDelete} variant="destructive" size="sm" className="px-3">
                  <Trash2 size={14} />
                </Button>
              </>
            ) : (
              <>
                <Button onClick={onInvite} size="sm" variant="ember-outline"
                  className="flex-1">
                  <UserPlus size={14} /> Invite
                </Button>
                <Button onClick={onShare} size="sm" variant="ember-outline" className="px-3" aria-label="Share tribe">
                  <Share2 size={14} />
                </Button>
                <Button onClick={onLeave} variant="ember-outline" size="sm" className="flex-1 opacity-80 hover:opacity-100">
                  <LogOut size={14} /> Leave
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TribeHeader;
