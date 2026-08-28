import { useNavigate } from "react-router-dom";
import { Crown } from "lucide-react";
import TribeFireLite from "@/components/TribeFireLite";
import { personalPalette, withAlpha } from "@/lib/tribe-streak";
import { personalStreakTier } from "@/lib/streak";
import { cn } from "@/lib/utils";
import { avatarUrl } from "@/lib/img";

interface Contributor {
  user_id: string;
  username: string;
  avatar_url: string | null;
  streak: number;
  role?: string;
}

interface MemberContributionStripProps {
  members: Contributor[];
  /** Cap visible flames for performance (default 8). Rest fall back to text. */
  maxFlames?: number;
  className?: string;
}

/**
 * Horizontal strip showing every member sorted by current streak.
 * The biggest flame = the member feeding the fire most.
 *
 * Performance: Only the top `maxFlames` (default 8) get a real `RealisticFlame`.
 * The rest get a static numeric chip so we never render 20+ turbulence filters.
 */
const MemberContributionStrip = ({ members, maxFlames = 8, className }: MemberContributionStripProps) => {
  const navigate = useNavigate();
  if (members.length === 0) return null;

  // Sort: biggest streak first
  const sorted = [...members].sort((a, b) => (b.streak ?? 0) - (a.streak ?? 0));

  return (
    <div className={cn("mb-4", className)}>
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="eyebrow">
          Who's feeding the fire
        </h2>
        <span className="text-[10px] font-bold tabular-nums text-muted-foreground/70">
          {members.length} member{members.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
        {sorted.map((m, idx) => {
          const streak = m.streak ?? 0;
          // PERSONAL ladder (3/7/14/30/60/100/200) — the old streak*10 hack on
          // the collective thresholds flattened members to 2-3 visible states.
          const tier = personalStreakTier(streak);
          const pal = personalPalette(streak);
          const accent = pal.glow === "transparent" ? "hsl(var(--muted-foreground))" : pal.glow;
          const showRealFlame = idx < maxFlames && streak >= 3;
          // Per-member flame size scales with their streak rank
          const flameSize = idx === 0 ? 38 : idx === 1 ? 32 : idx === 2 ? 30 : 26;
          const isTopStoker = idx === 0 && streak >= 3;

          return (
            <button
              key={m.user_id}
              onClick={() => navigate(`/user/${m.user_id}`)}
              className={cn(
                "flex flex-col items-center gap-1 shrink-0 w-16 group/m",
                isTopStoker && "relative",
              )}
              aria-label={`${m.username} — ${streak} day streak${isTopStoker ? ", top stoker" : ""}`}
            >
              {/* TOP STOKER ribbon above #1 */}
              {isTopStoker && (
                <span
                  className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-0.5 px-1.5 py-[1px] rounded-full text-[7px] font-black tracking-[0.22em] uppercase border whitespace-nowrap"
                  style={{
                    color: accent,
                    background: `linear-gradient(180deg, ${withAlpha(accent, 0.18)} 0%, ${withAlpha(accent, 0.06)} 100%)`,
                    borderColor: withAlpha(accent, 0.55),
                    boxShadow: `0 0 10px ${withAlpha(accent, 0.5)}`,
                  }}
                >
                  <Crown size={7} strokeWidth={2.6} fill="currentColor" />
                  Top
                </span>
              )}
              {/* Avatar with mini-flame floating above */}
              <div className="relative">
                <div
                  className={cn(
                    "h-12 w-12 rounded-full border-2 bg-secondary overflow-hidden transition-transform group-active/m:scale-95",
                    streak >= 30
                      ? "border-[hsl(var(--ember))] shadow-[0_0_10px_hsl(var(--ember)/0.5)]"
                      : "border-border/60",
                  )}
                  style={
                    streak >= 30
                      ? {
                          borderColor: accent,
                          boxShadow: isTopStoker
                            ? `0 0 18px ${withAlpha(accent, 0.75)}, inset 0 0 8px ${withAlpha(accent, 0.3)}`
                            : `0 0 10px ${withAlpha(accent, 0.5)}`,
                        }
                      : undefined
                  }
                >
                  {m.avatar_url ? (
                    <img loading="lazy" decoding="async" src={avatarUrl(m.avatar_url, 56)} alt={m.username} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] font-black text-muted-foreground">
                      {m.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                {/* Mini-flame above the avatar */}
                {showRealFlame ? (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 pointer-events-none"
                    style={{ width: flameSize, height: flameSize }}
                  >
                    <TribeFireLite tier={Math.max(0, tier)} palette={pal} variant="mini" size={flameSize} />
                  </div>
                ) : streak > 0 ? (
                  <div className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-background/90 border border-border/60 flex items-center justify-center">
                    <span className="text-[8px] font-black tabular-nums text-muted-foreground">{streak}</span>
                  </div>
                ) : null}
              </div>
              {/* Streak number — the contribution */}
              <span
                className="text-[10px] font-black tabular-nums leading-none"
                style={streak >= 30 ? { color: accent } : { color: "hsl(var(--muted-foreground))" }}
              >
                {streak}d
              </span>
              <span
                className={cn(
                  "text-[9px] truncate w-full text-center",
                  isTopStoker ? "font-black text-foreground/95" : "text-muted-foreground/80",
                )}
              >
                {m.username}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MemberContributionStrip;
