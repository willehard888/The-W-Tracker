import { useState } from "react";
import {
  Crown, Lock, Settings, UserPlus, Trash2, LogOut, Share2, Swords,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import TierUsername from "@/components/TierUsername";

import EmberRiseLayer from "@/components/EmberRiseLayer";
import TribeFireCanvas from "@/components/tribe/TribeFireCanvas";
import type { FireEvent } from "@/hooks/use-tribe-fire-reactor";
import { useSignedMediaUrl } from "@/lib/signed-url";
import { cn } from "@/lib/utils";
import {
  collectiveStreakTier,
  collectiveTierName,
  collectiveAccent,
  collectivePalette,
  withAlpha,
  KINDLING_PALETTE,
} from "@/lib/tribe-streak";

export interface TribeMember {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string | null;
  role: string;
  streak?: number;
}

interface TribeHeroProps {
  tribe: any;
  /** Sum of all active members' current streaks (live, client-computed). */
  total: number;
  members: TribeMember[];
  isMember: boolean;
  isOwner: boolean;
  /** Cover-image parallax offset in px (from the page scroll listener). */
  parallax: number;
  /** Realtime reactor — intake surge + ember-rise overlay + LIVE dot. */
  reactor?: { events: FireEvent[]; pulseToken: number; connected: boolean };
  /** Today's check-in pulse for everyone (aggregate only — privacy decision). */
  todayPulse?: { checked: number; total: number } | null;
  onNavigateUser: (userId: string) => void;
  onNavigateBattles: () => void;
  onJoin: () => void;
  onManage: () => void;
  onInvite: () => void;
  onDelete: () => void;
  onLeave: () => void;
  onShare: () => void;
}

/** Thresholds aligned with collectiveStreakTier(): 0,30,100,300,700,1500,3000,6000 */
const TIER_FLOORS = [0, 30, 100, 300, 700, 1500, 3000, 6000];

const nextTierProgress = (total: number) => {
  let cleared = 0;
  let next = TIER_FLOORS[1];
  for (let i = 0; i < TIER_FLOORS.length - 1; i++) {
    if (total >= TIER_FLOORS[i]) {
      cleared = TIER_FLOORS[i];
      next = TIER_FLOORS[i + 1];
    }
  }
  if (total >= TIER_FLOORS[TIER_FLOORS.length - 1]) {
    return { pct: 100, cleared, next: total, atMax: true };
  }
  const span = Math.max(1, next - cleared);
  const pct = Math.min(100, Math.max(0, ((total - cleared) / span) * 100));
  return { pct, cleared, next, atMax: false };
};

/** Ten-segment progress bar shared by the ignition + next-tier meters. */
const SegmentBar = ({ pct, color }: { pct: number; color: string }) => (
  <div className="relative h-2 rounded-full overflow-hidden bg-secondary/60 flex gap-[2px]">
    {Array.from({ length: 10 }).map((_, i) => {
      const segPct = (i + 1) * 10;
      const filled = pct >= segPct;
      const partial = !filled && pct > i * 10;
      return (
        <span
          key={i}
          className="flex-1 transition-all"
          style={{
            background: filled
              ? color
              : partial
              ? `linear-gradient(90deg, ${color} ${(pct - i * 10) * 10}%, transparent ${(pct - i * 10) * 10}%)`
              : "transparent",
            boxShadow: filled ? `0 0 6px ${withAlpha(color, 0.7)}` : undefined,
          }}
        />
      );
    })}
  </div>
);

/**
 * The tribe's one cinematic hero — collective fire, identity, and actions in
 * a single card. Merges the former TribeCollectiveFlame (hero variant) and
 * TribeHeader: cover photo lives as a deep background under a heavy scrim,
 * the canvas flame is the centerpiece, and the chrome stays quiet (v2 DNA —
 * the fire is the spectacle, everything else supports it).
 */
const TribeHero = ({
  tribe,
  total,
  members,
  isMember,
  isOwner,
  parallax,
  reactor,
  todayPulse,
  onNavigateUser,
  onNavigateBattles,
  onJoin,
  onManage,
  onInvite,
  onDelete,
  onLeave,
  onShare,
}: TribeHeroProps) => {
  const [descExpanded, setDescExpanded] = useState(false);

  const tier = collectiveStreakTier(total);
  const isCold = tier < 0;
  const isFirestorm = tier >= 6;
  const accent = collectiveAccent(total);
  const palette = collectivePalette(total);
  const tierLabel = collectiveTierName(total);
  const memberCount: number = tribe.member_count ?? members.length;
  const avg = memberCount > 0 ? Math.round((total / memberCount) * 10) / 10 : null;
  const { pct, next, atMax } = nextTierProgress(total);
  const founder = members.find((m) => m.role === "owner");

  // Size ladder — the fire is the centerpiece from day one: early tiers are
  // already substantial ("enimmäiset liekit näyttävämmäksi"), top tiers still
  // clearly crown them.
  const size =
    tier >= 6 ? 176 :
    tier >= 5 ? 170 :
    tier >= 4 ? 164 :
    tier >= 3 ? 156 :
    tier >= 2 ? 148 :
    tier >= 1 ? 140 :
    tier >= 0 ? 132 : 124;

  // Covers live in the private feed-images bucket — sign + resize in one round.
  const coverSrc = useSignedMediaUrl(tribe.cover_url, { width: 640, quality: 68 });
  const checkedToday = todayPulse && todayPulse.total > 0 ? todayPulse.checked : null;

  return (
    <div
      className={cn(
        "relative rounded-3xl overflow-hidden border p-6 mb-4",
        isCold
          ? "border-[hsl(22_60%_34%)]/40"
          : "border-[hsl(var(--ember))]/40 surface-ember shadow-[0_0_40px_hsl(var(--ember)/0.20)]",
      )}
      style={
        isCold
          ? {
              // Warm the cold hero so the fire has an atmosphere to live in
              // (v2): ember glow rising from the base, deep body.
              background:
                "radial-gradient(135% 74% at 50% 118%, hsl(24 92% 42% / 0.42), hsl(18 80% 30% / 0.12) 44%, transparent 64%), linear-gradient(180deg, hsl(258 20% 8%), hsl(258 22% 5%))",
            }
          : ({ ["--ember-accent" as string]: accent } as React.CSSProperties)
      }
    >
      {/* Cover photo — deep background under a heavy scrim, parallaxed */}
      {coverSrc && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <img
            src={coverSrc}
            alt=""
            decoding="async"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-30"
            style={{ transform: `translateY(${parallax * 0.5}px) scale(1.08)` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/75 to-background/92" />
        </div>
      )}

      {/* Polished top hairline — warm gold, both states (v2 craft detail) */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-[10%] right-[10%] h-px"
        style={{ background: "linear-gradient(90deg, transparent, hsl(42 95% 74% / 0.55), transparent)" }}
      />

      {/* Aurora rim — slow pulsing border highlight (hot tribes only) */}
      {!isCold && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{
            background: `linear-gradient(135deg, ${withAlpha(accent, 0)} 0%, ${withAlpha(accent, 0.35)} 50%, ${withAlpha(accent, 0)} 100%)`,
            padding: 1,
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor" as any,
            maskComposite: "exclude",
            animation: "flame-rim-pulse 4.5s ease-in-out infinite",
            opacity: 0.85,
          }}
        />
      )}

      {/* Stacked radial bloom + ember-drift particles */}
      {!isCold && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at 50% 95%, ${withAlpha(accent, 0.3)} 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, ${withAlpha(accent, 0.1)} 0%, transparent 70%)`,
            }}
            aria-hidden
          />
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 2 + (i % 3),
                  height: 2 + (i % 3),
                  left: `${i % 2 === 0 ? 4 + i * 3 : 92 - i * 3}%`,
                  bottom: -4,
                  background: accent,
                  boxShadow: `0 0 6px ${accent}`,
                  opacity: 0,
                  animation: `ember-drift ${5 + (i % 3) * 0.8}s ease-out infinite`,
                  animationDelay: `${i * 0.7}s`,
                }}
              />
            ))}
          </div>
        </>
      )}

      <div className="relative flex flex-col items-center text-center pt-1">
        {/* Top row — Tribe Fire chip + lit-today + LIVE */}
        <div className="w-full flex items-center justify-center relative mb-3">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/40 backdrop-blur-sm border"
            style={{
              borderColor: isCold ? "hsl(var(--border))" : withAlpha(accent, 0.5),
              boxShadow: isCold ? undefined : `0 0 18px ${withAlpha(accent, 0.4)}`,
            }}
          >
            <span
              className="text-[11px] font-black tracking-widest uppercase"
              style={{ color: isCold ? "hsl(var(--muted-foreground))" : accent }}
            >
              Tribe Fire
            </span>
            {checkedToday !== null && checkedToday > 0 && !isCold && (
              <span
                className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border"
                style={{
                  color: accent,
                  borderColor: withAlpha(accent, 0.5),
                  background: withAlpha(accent, 0.1),
                }}
              >
                +{checkedToday} today
              </span>
            )}
          </div>
          {reactor && (
            <span
              className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center gap-1"
              aria-label={reactor.connected ? "Live updates connected" : "Connecting live updates"}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  reactor.connected ? "bg-xp-green animate-pulse" : "bg-muted-foreground/50",
                )}
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                {reactor.connected ? "Live" : "…"}
              </span>
            </span>
          )}
        </div>

        {/* The flame — canvas fire on its glowing ember plate */}
        <div
          className="relative flex items-end justify-center mb-2"
          style={{ width: size, height: size * 1.2 }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 -translate-x-1/2"
            style={{
              bottom: size * 0.02,
              width: size * 0.92,
              height: size * 0.12,
              borderRadius: "50%",
              background: `radial-gradient(60% 120% at 50% 0%, ${withAlpha(isCold ? "hsl(28 100% 60%)" : accent, 0.95)}, ${withAlpha(isCold ? "hsl(14 90% 42%)" : accent, 0.45)} 55%, transparent 78%)`,
              boxShadow: `0 0 ${size * 0.28}px ${size * 0.06}px ${withAlpha(isCold ? "hsl(20 100% 50%)" : accent, 0.4)}`,
              filter: "blur(1px)",
            }}
          />
          {isCold ? (
            // Cold ≠ dead: the same premium engine in kindling mode — a small
            // flame struggling to life on a breathing coal bed.
            <TribeFireCanvas
              tier={0}
              kindling
              palette={KINDLING_PALETTE}
              size={size}
              pulseToken={reactor?.pulseToken}
              className="absolute bottom-0 left-1/2 -translate-x-1/2"
            />
          ) : (
            <TribeFireCanvas
              tier={tier}
              palette={palette}
              size={size}
              pulseToken={reactor?.pulseToken}
              className="absolute bottom-0 left-1/2 -translate-x-1/2"
            />
          )}
          {reactor && !isCold && reactor.events.length > 0 && (
            <div className="absolute inset-x-[-20%] -top-16 -bottom-4 pointer-events-none">
              <EmberRiseLayer events={reactor.events} accent={accent} />
            </div>
          )}
        </div>

        {/* Number */}
        <div className="flex items-baseline gap-2">
          <span
            className="font-display font-black text-4xl tabular-nums leading-none"
            style={{
              color: isCold ? "hsl(24 45% 62%)" : accent,
              textShadow: isCold
                ? "0 0 24px hsl(18 90% 50% / 0.25)"
                : `0 0 32px ${withAlpha(accent, 0.6)}`,
            }}
          >
            {total.toLocaleString()}
          </span>
          <span className="text-sm font-bold text-muted-foreground">days</span>
        </div>

        {/* Tier headline */}
        <p
          className={cn(
            "font-display font-black text-sm mt-1.5 uppercase tracking-[0.18em]",
            isFirestorm && "bg-clip-text text-transparent",
          )}
          style={
            isFirestorm
              ? {
                  backgroundImage:
                    "linear-gradient(90deg, hsl(195 90% 65%), hsl(265 80% 65%), hsl(310 85% 65%), hsl(195 90% 65%))",
                  backgroundSize: "200% 100%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  animation: "flame-plasma-hue 4s linear infinite, shimmer-slide 5s linear infinite",
                }
              : isCold
              ? { color: "hsl(20 55% 55%)", textShadow: "0 0 14px hsl(18 90% 50% / 0.3)" }
              : { color: accent, textShadow: `0 0 18px ${withAlpha(accent, 0.4)}` }
          }
        >
          {tierLabel}
        </p>

        {/* Tribe name + stat line */}
        <div className="flex items-center gap-1.5 mt-3">
          {tribe.visibility === "private" && (
            <Lock size={13} className="text-muted-foreground shrink-0" aria-label="Private tribe" />
          )}
          <h1 className="font-display font-black text-xl leading-tight">{tribe.name}</h1>
        </div>
        <p className="text-[12px] text-muted-foreground/85 mt-1 tabular-nums">
          {memberCount} member{memberCount === 1 ? "" : "s"}
          {avg !== null && !isCold && (
            <> · avg <span className="font-black text-foreground/85">{avg}</span></>
          )}
          {checkedToday !== null && (
            <> · <span className="font-black" style={{ color: isCold ? undefined : accent }}>{checkedToday}/{todayPulse!.total}</span> lit today</>
          )}
        </p>

        {isCold && (
          <p className="text-[12px] text-muted-foreground/80 mt-2 leading-snug max-w-[260px]">
            The embers are waiting. <span className="font-black text-[hsl(24_80%_62%)]">{Math.max(0, 30 - total)} combined day{Math.max(0, 30 - total) === 1 ? "" : "s"}</span> of streaks to ignition.
          </p>
        )}

        {/* Identity — founder + description */}
        {(founder || tribe.description) && (
          <div className="mt-3 flex flex-col items-center gap-1.5 max-w-[300px]">
            {founder && (
              <button
                onClick={() => onNavigateUser(founder.user_id)}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gradient-to-r from-gold/20 to-[hsl(var(--ember))]/15 border border-gold/45 hover:from-gold/25 transition-colors"
              >
                <Crown size={11} className="text-gold" strokeWidth={2.8} fill="currentColor" />
                <span className="text-[10px] font-black tracking-widest uppercase text-gold">Founder</span>
                <TierUsername
                  username={founder.username}
                  tier={founder.status_tier || "recruit"}
                  className="text-[11px] font-bold truncate max-w-[120px]"
                />
              </button>
            )}
            {tribe.description && (
              <button
                type="button"
                onClick={() => setDescExpanded((v) => !v)}
                className="text-left"
                aria-expanded={descExpanded}
              >
                <p
                  className={cn(
                    "text-xs text-foreground/75 leading-snug",
                    !descExpanded && "line-clamp-2",
                  )}
                >
                  {tribe.description}
                </p>
              </button>
            )}
          </div>
        )}

        {/* Paused banner */}
        {tribe.is_paused && (
          <div className="mt-3 w-full rounded-xl border border-muted-foreground/30 bg-gradient-to-br from-secondary/30 via-card/70 to-secondary/20 p-3 text-left">
            <div className="flex items-center gap-2">
              <Crown size={12} className="text-muted-foreground shrink-0" aria-hidden />
              <p className="text-[12px] font-black tracking-widest uppercase text-muted-foreground">
                Tribe paused
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Ignition progress — cold tribes get a visible goal, not a dead end */}
      {isCold && (
        <div className="relative mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-widest font-black text-[hsl(20_60%_55%)]">
              Ignition
            </span>
            <span className="text-[11px] font-bold tabular-nums text-foreground/70">
              {total} / 30 days
            </span>
          </div>
          <SegmentBar pct={Math.min(100, (total / 30) * 100)} color="hsl(var(--ember))" />
        </div>
      )}

      {/* Segmented progress to next tier */}
      {!isCold && !atMax && (
        <div className="relative mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/80">
              Next: {collectiveTierName(next)}
            </span>
            <span className="text-[11px] font-bold tabular-nums text-foreground/70">
              {Math.max(0, next - total).toLocaleString()} to go
            </span>
          </div>
          <SegmentBar pct={pct} color={accent} />
        </div>
      )}
      {!isCold && atMax && (
        <p
          className="mt-3 text-center text-[11px] uppercase tracking-widest font-black"
          style={{ color: accent, textShadow: `0 0 10px ${withAlpha(accent, 0.5)}` }}
        >
          Max tier reached — Legendary fire
        </p>
      )}

      {/* Action row — quiet, the fire above is the spectacle */}
      <div className="relative flex gap-2 mt-4">
        {!isMember ? (
          // No Join button here: the sticky bar at the bottom of TribeDetail
          // owns joining (incl. private-tribe "Request to join") — two join
          // CTAs on one screen read as a mistake, not emphasis.
          <Button onClick={onShare} size="sm" variant="ember-outline" className="px-3 ml-auto" aria-label="Share tribe">
            <Share2 size={14} />
          </Button>
        ) : isOwner ? (
          <>
            <Button onClick={onManage} size="sm" variant="gold-outline" className="flex-1">
              <Settings size={14} /> Manage
            </Button>
            <Button onClick={onInvite} size="sm" variant="ember-outline" className="flex-1">
              <UserPlus size={14} /> Invite
            </Button>
            <Button onClick={onNavigateBattles} size="sm" variant="ember-outline" className="px-3" aria-label="Tribe battles">
              <Swords size={14} />
            </Button>
            <Button onClick={onShare} size="sm" variant="ember-outline" className="px-3" aria-label="Share tribe">
              <Share2 size={14} />
            </Button>
            <Button onClick={onDelete} variant="destructive" size="sm" className="px-3" aria-label="Delete tribe">
              <Trash2 size={14} />
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onInvite} size="sm" variant="ember-outline" className="flex-1">
              <UserPlus size={14} /> Invite
            </Button>
            <Button onClick={onNavigateBattles} size="sm" variant="ember-outline" className="px-3" aria-label="Tribe battles">
              <Swords size={14} />
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
  );
};

export default TribeHero;
