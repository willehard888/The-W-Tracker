import { useState, useMemo } from "react";
import BadgeCard from "./BadgeCard";
import type { BadgeRarity } from "./BadgeCard";
import { cn } from "@/lib/utils";
import { Crown, Sparkles, Target, Lock } from "lucide-react";

interface BadgeData {
  id: string;
  name: string;
  icon: string;
  rarity: BadgeRarity;
  category: string;
  description?: string | null;
}

interface BadgeVaultProps {
  allBadges: BadgeData[];
  earnedBadgeIds: string[];
  progress?: Record<string, { current: number; target: number; percent: number }>;
  featuredBadgeId?: string | null;
  onBadgeClick?: (badge: BadgeData) => void;
  onSetFeatured?: (badgeId: string) => void;
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "streak", label: "Streak" },
  { id: "discipline", label: "Discipline" },
  { id: "sport", label: "Sport" },
  { id: "xp", label: "XP" },
  { id: "level", label: "Level" },
  { id: "social", label: "Social" },
  { id: "checkin", label: "Check-in" },
  { id: "battles", label: "Battles" },
];

const RARITY_ORDER: Record<string, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  common: 3,
};

const RARITY_META: Record<
  BadgeRarity,
  { label: string; chip: string; bar: string; dot: string }
> = {
  legendary: {
    label: "Mythic",
    chip: "border-gold/40 bg-gold/10 text-gold",
    bar: "bg-gradient-to-r from-gold/70 to-gold",
    dot: "bg-gold shadow-[0_0_6px_hsl(var(--gold)/0.7)]",
  },
  epic: {
    label: "Epic",
    chip:
      "border-[hsl(var(--badge-epic)_/_0.4)] bg-[hsl(var(--badge-epic)_/_0.1)] text-[hsl(var(--badge-epic))]",
    bar: "bg-[hsl(var(--badge-epic))]",
    dot: "bg-[hsl(var(--badge-epic))] shadow-[0_0_6px_hsl(var(--badge-epic)/0.7)]",
  },
  rare: {
    label: "Rare",
    chip:
      "border-[hsl(var(--badge-rare)_/_0.4)] bg-[hsl(var(--badge-rare)_/_0.1)] text-[hsl(var(--badge-rare))]",
    bar: "bg-[hsl(var(--badge-rare))]",
    dot: "bg-[hsl(var(--badge-rare))] shadow-[0_0_6px_hsl(var(--badge-rare)/0.7)]",
  },
  common: {
    label: "Common",
    chip: "border-border bg-card text-muted-foreground",
    bar: "bg-[hsl(var(--badge-common))]",
    dot: "bg-[hsl(var(--badge-common))]",
  },
};

const BadgeVault = ({
  allBadges,
  earnedBadgeIds,
  progress,
  featuredBadgeId,
  onBadgeClick,
  onSetFeatured,
}: BadgeVaultProps) => {
  const [activeCategory, setActiveCategory] = useState("all");

  const earnedSet = useMemo(() => new Set(earnedBadgeIds), [earnedBadgeIds]);

  const isBadgeEarned = (badgeId: string) => {
    const p = progress?.[badgeId];
    const achievedByProgress = !!p && p.current >= p.target;
    return earnedSet.has(badgeId) || achievedByProgress;
  };

  const availableCategories = useMemo(() => {
    const cats = new Set(allBadges.map((b) => b.category));
    return CATEGORIES.filter((c) => c.id === "all" || cats.has(c.id));
  }, [allBadges]);

  const filteredBadges = useMemo(() => {
    const filtered =
      activeCategory === "all"
        ? allBadges
        : allBadges.filter((b) => b.category === activeCategory);

    return [...filtered].sort((a, b) => {
      const aEarned = isBadgeEarned(a.id);
      const bEarned = isBadgeEarned(b.id);
      if (aEarned !== bEarned) return aEarned ? -1 : 1;
      if (aEarned && bEarned)
        return (RARITY_ORDER[a.rarity] ?? 4) - (RARITY_ORDER[b.rarity] ?? 4);
      const aProgress = progress?.[a.id]?.percent ?? 0;
      const bProgress = progress?.[b.id]?.percent ?? 0;
      if (aProgress !== bProgress) return bProgress - aProgress;
      return (RARITY_ORDER[a.rarity] ?? 4) - (RARITY_ORDER[b.rarity] ?? 4);
    });
  }, [allBadges, activeCategory, earnedSet, progress]);

  const totalEarned = useMemo(
    () => allBadges.filter((b) => isBadgeEarned(b.id)).length,
    [allBadges, earnedSet, progress]
  );
  const totalBadges = allBadges.length;
  const overallPct =
    totalBadges > 0 ? Math.round((totalEarned / totalBadges) * 100) : 0;

  const rarityCounts = useMemo(() => {
    const counts: Record<BadgeRarity, { earned: number; total: number }> = {
      legendary: { earned: 0, total: 0 },
      epic: { earned: 0, total: 0 },
      rare: { earned: 0, total: 0 },
      common: { earned: 0, total: 0 },
    };
    for (const b of allBadges) {
      counts[b.rarity].total++;
      if (isBadgeEarned(b.id)) counts[b.rarity].earned++;
    }
    return counts;
  }, [allBadges, earnedSet, progress]);

  // "Next Drop" — closest unearned badge by progress %, prioritizing higher rarity on ties
  const nextDrop = useMemo(() => {
    const candidates = allBadges
      .filter((b) => !isBadgeEarned(b.id))
      .map((b) => ({ badge: b, p: progress?.[b.id] }))
      .filter((x) => x.p && x.p.percent > 0);

    candidates.sort((a, b) => {
      const ap = a.p?.percent ?? 0;
      const bp = b.p?.percent ?? 0;
      if (ap !== bp) return bp - ap;
      return (RARITY_ORDER[a.badge.rarity] ?? 4) - (RARITY_ORDER[b.badge.rarity] ?? 4);
    });

    return candidates[0];
  }, [allBadges, earnedSet, progress]);

  return (
    <div>
      {/* === Header === */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="font-display font-black text-base tracking-tight flex items-center gap-1.5">
            Badge Vault
            <Sparkles size={12} className="text-gold" />
          </h2>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            <span className="font-bold text-foreground">{totalEarned}</span>
            <span className="text-muted-foreground/60"> / {totalBadges}</span>
            <span className="ml-1.5 text-muted-foreground">collected · {overallPct}%</span>
          </p>
        </div>

        {/* Rarity progress chips */}
        <div className="flex items-center gap-1">
          {(["legendary", "epic", "rare", "common"] as const).map((r) => {
            const meta = RARITY_META[r];
            const counts = rarityCounts[r];
            return (
              <div
                key={r}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black border tabular-nums",
                  meta.chip
                )}
                title={`${meta.label}: ${counts.earned}/${counts.total}`}
              >
                <span className={cn("h-1 w-1 rounded-full", meta.dot)} />
                {counts.earned}/{counts.total}
              </div>
            );
          })}
        </div>
      </div>

      {/* === Segmented progress bar by rarity === */}
      <div className="mb-4 flex h-2 rounded-full overflow-hidden gap-[2px] bg-secondary/40">
        {(["common", "rare", "epic", "legendary"] as const).map((r) => {
          const counts = rarityCounts[r];
          const segPct = counts.total > 0 ? counts.earned / counts.total : 0;
          const flex = counts.total > 0 ? counts.total : 0;
          if (flex === 0) return null;
          return (
            <div
              key={r}
              className="relative bg-secondary/70"
              style={{ flex }}
            >
              <div
                className={cn("h-full transition-all duration-700 ease-out", RARITY_META[r].bar)}
                style={{ width: `${segPct * 100}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* === Next Drop spotlight === */}
      {nextDrop && (
        <button
          type="button"
          onClick={() => onBadgeClick?.(nextDrop.badge)}
          className={cn(
            "group w-full mb-4 p-3 rounded-2xl border relative overflow-hidden text-left glass-3d depth-realistic",
            "border-gold/25",
            "transition-all duration-300 hover:border-gold/45 active:scale-[0.99]"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="badge-locked">
                <BadgeCard
                  name={nextDrop.badge.name}
                  icon={nextDrop.badge.icon}
                  rarity={nextDrop.badge.rarity}
                  earned
                  showcase
                />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-background border border-gold/40 flex items-center justify-center">
                <Lock size={8} className="text-gold" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Target size={10} className="text-gold" />
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-gold">
                  Next Drop
                </span>
              </div>
              <p className="text-sm font-bold text-foreground truncate">{nextDrop.badge.name}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn("h-full transition-all duration-700", RARITY_META[nextDrop.badge.rarity].bar)}
                    style={{ width: `${nextDrop.p?.percent ?? 0}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-foreground tabular-nums shrink-0">
                  {nextDrop.p?.current}/{nextDrop.p?.target}
                </span>
              </div>
            </div>
          </div>
        </button>
      )}

      {/* === Category filters === */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3 no-scrollbar">
        {availableCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all duration-200 border shrink-0",
              activeCategory === cat.id
                ? "border-gold/45 bg-gold/12 text-gold shadow-[0_0_12px_hsl(var(--gold)/0.18)]"
                : "border-border bg-card/60 text-muted-foreground hover:border-gold/25 hover:text-foreground"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* === Badge grid === */}
      <div className="grid grid-cols-3 gap-2.5">
        {filteredBadges.map((badge) => {
          const badgeProgress = progress?.[badge.id];
          const earned = isBadgeEarned(badge.id);
          const isFeatured = badge.id === featuredBadgeId;

          return (
            <div key={badge.id} className="relative">
              {isFeatured && earned && (
                <div className="absolute -top-1.5 -right-1.5 z-10 h-5 w-5 rounded-full bg-gold flex items-center justify-center shadow-[0_0_10px_hsl(var(--gold)/0.6)]">
                  <Crown size={10} className="text-primary-foreground" />
                </div>
              )}

              <div
                onClick={() => onBadgeClick?.(badge)}
                onDoubleClick={() => {
                  if (earned && onSetFeatured) onSetFeatured(badge.id);
                }}
                className="cursor-pointer"
              >
                <BadgeCard
                  name={badge.name}
                  icon={badge.icon}
                  rarity={badge.rarity}
                  earned={earned}
                  description={badge.description || undefined}
                  compact
                />

                {!earned && badgeProgress && badgeProgress.percent > 0 && (
                  <div className="mt-1.5 px-1">
                    <div className="h-1 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          RARITY_META[badge.rarity].bar,
                          "opacity-80"
                        )}
                        style={{ width: `${badgeProgress.percent}%` }}
                      />
                    </div>
                    <p className="text-[8px] text-muted-foreground text-center mt-0.5 tabular-nums">
                      {badgeProgress.current}/{badgeProgress.target}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {onSetFeatured && (
        <p className="text-[10px] text-muted-foreground text-center mt-4">
          Tap to inspect · Double-tap an earned badge to set it as your title
        </p>
      )}
    </div>
  );
};

export default BadgeVault;
