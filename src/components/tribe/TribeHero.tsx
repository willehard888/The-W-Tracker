import { fmtInt } from "@/lib/format";
import { useEffect, useRef, useState, type CSSProperties } from "react";
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
          className="flex-1"
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

/** One warm tone for a cold hero (it used to drift across four). */
const COLD_ACCENT = "hsl(24 60% 58%)";
const COLD_PLATE = "hsl(22 96% 54%)";

const LABEL = "text-[11px] font-bold text-muted-foreground";

/**
 * The tribe's one cinematic hero — collective fire, identity, and actions in
 * a single card. Cover photo lives as a deep background under a heavy scrim,
 * the canvas flame is the centerpiece, and the chrome stays quiet: the fire
 * is the spectacle, everything else supports it.
 *
 * Every tier-dependent colour is written once as a CSS variable on the root
 * (`--acc` + four alphas, the plate pair, the flame size) and read by
 * classes below, so the tree carries one style object instead of fourteen.
 */
const TribeHero = ({
  tribe,
  total,
  members,
  isMember,
  isOwner,
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
  const coverRef = useRef<HTMLImageElement>(null);

  const tier = collectiveStreakTier(total);
  const isCold = tier < 0;
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

  const acc = isCold ? COLD_ACCENT : accent;
  const plate = isCold ? COLD_PLATE : accent;
  const vars = {
    "--ember-accent": accent,
    "--acc": acc,
    "--acc-a": withAlpha(acc, 0.1),
    "--acc-b": withAlpha(acc, 0.3),
    "--acc-c": withAlpha(acc, 0.5),
    "--acc-d": withAlpha(acc, 0.6),
    "--pl-hi": withAlpha(plate, 0.95),
    "--pl-lo": withAlpha(plate, 0.45),
    "--fs": `${size}px`,
  } as CSSProperties;

  // Covers live in the private feed-images bucket — sign + resize in one round.
  const coverSrc = useSignedMediaUrl(tribe.cover_url, { width: 640, quality: 68 });
  const checkedToday = todayPulse && todayPulse.total > 0 ? todayPulse.checked : null;

  // Cover parallax follows the shell scroller. The offset is written straight
  // onto the cover image as a custom property (no React state: the old setParallax
  // re-rendered the whole 900-line page per scroll pixel and broke every
  // post card's memo). Set on the image itself, the variable inherits to
  // nothing, so the write costs one element's style.
  useEffect(() => {
    const img = coverRef.current;
    if (!img || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let parent: HTMLElement | null = img.parentElement;
    while (parent && !/auto|scroll/.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
    const target: HTMLElement | Window = parent ?? window;
    const onScroll = () => {
      const top = parent ? parent.scrollTop : window.scrollY;
      img.style.setProperty("--par", `${Math.min(top * 0.15, 40)}px`);
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [coverSrc]);

  return (
    <div
      className={cn(
        "relative rounded-3xl overflow-hidden border p-6",
        isCold
          // Warm the cold hero so the fire has an atmosphere to live in: ember
          // glow rising from the base, deep body.
          ? "border-[hsl(22_60%_34%)]/40 bg-[radial-gradient(135%_74%_at_50%_118%,hsl(24_92%_42%/0.42),hsl(18_80%_30%/0.12)_44%,transparent_64%),linear-gradient(180deg,hsl(258_20%_8%),hsl(258_22%_5%))]"
          : "border-[hsl(var(--ember))]/40 surface-ember shadow-[0_0_40px_hsl(var(--ember)/0.20)]",
      )}
      style={vars}
    >
      {/* Cover photo — deep background under a heavy scrim, parallaxed */}
      {coverSrc && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <img
            src={coverSrc}
            ref={coverRef}
            alt=""
            decoding="async"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-30 will-change-transform [transform:translateY(var(--par,0px))_scale(1.08)]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/75 to-background/92" />
        </div>
      )}

      {/* Polished top hairline — warm gold, both states */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-[10%] right-[10%] h-px bg-[linear-gradient(90deg,transparent,hsl(42_95%_74%/0.55),transparent)]"
      />

      {/* Aurora rim — slow pulsing border highlight (hot tribes only) */}
      {!isCold && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl p-px opacity-85 [background:linear-gradient(135deg,transparent_0%,var(--acc-b)_50%,transparent_100%)] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [mask-composite:exclude] [-webkit-mask-composite:xor] animate-[flame-rim-pulse_4.5s_ease-in-out_infinite]"
        />
      )}

      {/* Stacked radial bloom + ember-drift particles */}
      {!isCold && (
        <>
          <div
            className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_95%,var(--acc-b)_0%,transparent_55%),radial-gradient(ellipse_at_50%_50%,var(--acc-a)_0%,transparent_70%)]"
            aria-hidden
          />
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="absolute -bottom-1 rounded-full opacity-0 bg-[var(--acc)] shadow-[0_0_6px_var(--acc)]"
                style={{
                  width: 2 + (i % 3),
                  height: 2 + (i % 3),
                  left: `${i % 2 === 0 ? 4 + i * 3 : 92 - i * 3}%`,
                  animation: `ember-drift ${5 + (i % 3) * 0.8}s ease-out infinite ${i * 0.7}s`,
                }}
              />
            ))}
          </div>
        </>
      )}

      <div className="relative flex flex-col items-center text-center pt-1">
        {reactor && (
          <span
            className="absolute right-0 top-0 inline-flex items-center gap-1"
            aria-label={reactor.connected ? "Live updates connected" : "Connecting live updates"}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                reactor.connected ? "bg-xp-green animate-pulse" : "bg-muted-foreground/50",
              )}
            />
            <span className="text-[10px] font-bold text-muted-foreground/75">
              {reactor.connected ? "Live" : "…"}
            </span>
          </span>
        )}

        {/* The flame — canvas fire on its glowing ember plate */}
        <div className="relative flex items-end justify-center mt-2 mb-2 w-[var(--fs)] h-[calc(var(--fs)*1.2)]">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bottom-[calc(var(--fs)*0.02)] w-[calc(var(--fs)*0.92)] h-[calc(var(--fs)*0.12)] bg-[radial-gradient(60%_120%_at_50%_0%,var(--pl-hi),var(--pl-lo)_55%,transparent_78%)] shadow-[0_0_calc(var(--fs)*0.28)_calc(var(--fs)*0.06)_var(--pl-lo)]"
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

        {/* The number, then the fire's name under it */}
        <div className="flex items-baseline gap-2">
          <span className="font-display font-black text-4xl tabular-nums leading-none text-[var(--acc)] [text-shadow:0_0_32px_var(--acc-d)]">
            {fmtInt(total)}
          </span>
          <span className="text-sm font-bold text-muted-foreground">days</span>
        </div>
        <p className="font-display font-black text-sm mt-1.5 text-[var(--acc)] [text-shadow:0_0_18px_var(--acc-c)]">
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
            <> · <span className={cn("font-black", !isCold && "text-[var(--acc)]")}>{checkedToday}/{todayPulse!.total}</span> lit today</>
          )}
        </p>

        {isCold && (
          <p className="text-[12px] text-muted-foreground/80 mt-2 leading-snug max-w-[260px]">
            The embers are waiting. <span className="font-black text-[var(--acc)]">{Math.max(0, 30 - total)} combined day{Math.max(0, 30 - total) === 1 ? "" : "s"}</span> of streaks to ignition.
          </p>
        )}

        {/* Identity — founder + description */}
        {(founder || tribe.description) && (
          <div className="mt-2 flex flex-col items-center gap-1 max-w-[300px]">
            {founder && (
              <button
                type="button"
                onClick={() => onNavigateUser(founder.user_id)}
                className="min-h-11 inline-flex items-center gap-1.5 px-2 text-[12px]"
              >
                <Crown size={11} className="text-gold" strokeWidth={2.8} fill="currentColor" aria-hidden />
                <span className="font-bold text-muted-foreground">Founder</span>
                <TierUsername
                  username={founder.username}
                  tier={founder.status_tier || "recruit"}
                  className="font-bold truncate max-w-[140px]"
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

        {tribe.is_paused && (
          <p className={cn(LABEL, "mt-3 inline-flex items-center gap-1.5")}>
            <Crown size={12} aria-hidden /> Tribe paused
          </p>
        )}
      </div>

      {/* Ignition progress — cold tribes get a visible goal, not a dead end */}
      {isCold && (
        <div className="relative mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className={LABEL}>Ignition</span>
            <span className="text-[11px] font-bold tabular-nums text-foreground/75">
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
            <span className={LABEL}>Next: {collectiveTierName(next)}</span>
            <span className="text-[11px] font-bold tabular-nums text-foreground/75">
              {fmtInt(Math.max(0, next - total))} to go
            </span>
          </div>
          <SegmentBar pct={pct} color={accent} />
        </div>
      )}
      {!isCold && atMax && (
        <p className="mt-3 text-center text-[11px] font-bold text-[var(--acc)]">
          Max tier reached — Legendary fire
        </p>
      )}

      {/* Action row — quiet, the fire above is the spectacle */}
      <div className="relative flex gap-2 mt-4">
        {!isMember ? (
          // No Join button here: the sticky bar at the bottom of TribeDetail
          // owns joining (incl. private-tribe "Request to join") — two join
          // CTAs on one screen read as a mistake, not emphasis.
          <Button onClick={onShare} size="sm" variant="ember-outline" className="min-h-11 px-3 ml-auto" aria-label="Share tribe">
            <Share2 aria-hidden size={14} />
          </Button>
        ) : isOwner ? (
          <>
            <Button onClick={onManage} size="sm" variant="gold-outline" className="min-h-11 flex-1">
              <Settings aria-hidden size={14} /> Manage
            </Button>
            <Button onClick={onInvite} size="sm" variant="ember-outline" className="min-h-11 flex-1">
              <UserPlus aria-hidden size={14} /> Invite
            </Button>
            <Button onClick={onNavigateBattles} size="sm" variant="ember-outline" className="min-h-11 px-3" aria-label="Tribe battles">
              <Swords aria-hidden size={14} />
            </Button>
            <Button onClick={onShare} size="sm" variant="ember-outline" className="min-h-11 px-3" aria-label="Share tribe">
              <Share2 aria-hidden size={14} />
            </Button>
            <Button onClick={onDelete} variant="destructive" size="sm" className="min-h-11 px-3" aria-label="Delete tribe">
              <Trash2 aria-hidden size={14} />
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onInvite} size="sm" variant="ember-outline" className="min-h-11 flex-1">
              <UserPlus aria-hidden size={14} /> Invite
            </Button>
            <Button onClick={onNavigateBattles} size="sm" variant="ember-outline" className="min-h-11 px-3" aria-label="Tribe battles">
              <Swords aria-hidden size={14} />
            </Button>
            <Button onClick={onShare} size="sm" variant="ember-outline" className="min-h-11 px-3" aria-label="Share tribe">
              <Share2 aria-hidden size={14} />
            </Button>
            <Button onClick={onLeave} variant="ember-outline" size="sm" className="min-h-11 flex-1 opacity-80 hover:opacity-100">
              <LogOut aria-hidden size={14} /> Leave
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default TribeHero;
