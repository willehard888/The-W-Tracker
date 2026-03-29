import { useState, useMemo } from "react";
import BadgeCard from "./BadgeCard";
import type { BadgeRarity } from "./BadgeCard";
import { cn } from "@/lib/utils";
import { Shield, Crown, Star, Sparkles, Zap, Filter } from "lucide-react";

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
  { id: "all", label: "All", icon: Shield },
  { id: "streak", label: "Streak", icon: Zap },
  { id: "discipline", label: "Discipline", icon: Star },
  { id: "sport", label: "Sport", icon: Sparkles },
  { id: "xp", label: "XP", icon: Crown },
  { id: "level", label: "Level", icon: Crown },
  { id: "social", label: "Social", icon: Shield },
  { id: "checkin", label: "Check-in", icon: Shield },
  { id: "battles", label: "Battles", icon: Zap },
];

const RARITY_ORDER: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };

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

  // Get unique categories from badges
  const availableCategories = useMemo(() => {
    const cats = new Set(allBadges.map((b) => b.category));
    return CATEGORIES.filter((c) => c.id === "all" || cats.has(c.id));
  }, [allBadges]);

  const isBadgeEarned = (badgeId: string) => {
    const p = progress?.[badgeId];
    const achievedByProgress = !!p && p.current >= p.target;
    return earnedSet.has(badgeId) || achievedByProgress;
  };

  const filteredBadges = useMemo(() => {
    const filtered = activeCategory === "all"
      ? allBadges
      : allBadges.filter((b) => b.category === activeCategory);

    // Sort: earned first (by rarity), then unearned (by progress %)
    return [...filtered].sort((a, b) => {
      const aEarned = isBadgeEarned(a.id);
      const bEarned = isBadgeEarned(b.id);
      if (aEarned !== bEarned) return aEarned ? -1 : 1;
      if (aEarned && bEarned) return (RARITY_ORDER[a.rarity] ?? 4) - (RARITY_ORDER[b.rarity] ?? 4);
      const aProgress = progress?.[a.id]?.percent ?? 0;
      const bProgress = progress?.[b.id]?.percent ?? 0;
      if (aProgress !== bProgress) return bProgress - aProgress;
      return (RARITY_ORDER[a.rarity] ?? 4) - (RARITY_ORDER[b.rarity] ?? 4);
    });
  }, [allBadges, activeCategory, earnedSet, progress]);

  const totalEarned = useMemo(() => allBadges.filter((b) => isBadgeEarned(b.id)).length, [allBadges, earnedSet, progress]);
  const totalBadges = allBadges.length;
  const rarityCounts = useMemo(() => {
    const counts: Record<string, { earned: number; total: number }> = {
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

  return (
    <div>
      {/* Header Stats */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-base tracking-tight">Badge Vault</h2>
          <p className="text-xs text-muted-foreground">{totalEarned}/{totalBadges} collected</p>
        </div>
        <div className="flex items-center gap-1.5">
          {(["legendary", "epic", "rare", "common"] as const).map((r) => (
            <div
              key={r}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border",
                r === "legendary" && "border-gold/30 bg-gold/5 text-gold",
                r === "epic" && "border-[hsl(var(--badge-epic)_/_0.3)] bg-[hsl(var(--badge-epic)_/_0.05)] text-[hsl(var(--badge-epic))]",
                r === "rare" && "border-[hsl(var(--badge-rare)_/_0.3)] bg-[hsl(var(--badge-rare)_/_0.05)] text-[hsl(var(--badge-rare))]",
                r === "common" && "border-border bg-card text-muted-foreground"
              )}
            >
              {rarityCounts[r].earned}/{rarityCounts[r].total}
            </div>
          ))}
        </div>
      </div>

      {/* Collection Progress Bar */}
      <div className="mb-4">
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${totalBadges > 0 ? (totalEarned / totalBadges) * 100 : 0}%`,
              background: "linear-gradient(90deg, hsl(var(--badge-common)), hsl(var(--badge-rare)), hsl(var(--badge-epic)), hsl(var(--gold)))",
            }}
          />
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {availableCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all duration-200 border shrink-0",
              activeCategory === cat.id
                ? "border-gold/40 bg-gold/10 text-gold"
                : "border-border bg-card text-muted-foreground hover:border-gold/20"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Badge Grid */}
      <div className="grid grid-cols-3 gap-3">
        {filteredBadges.map((badge) => {
          const badgeProgress = progress?.[badge.id];
          const earned = isBadgeEarned(badge.id);
          const isFeatured = badge.id === featuredBadgeId;

          return (
            <div key={badge.id} className="relative">
              {/* Featured indicator */}
              {isFeatured && earned && (
                <div className="absolute -top-1.5 -right-1.5 z-10 h-5 w-5 rounded-full bg-gold flex items-center justify-center">
                  <Crown size={10} className="text-primary-foreground" />
                </div>
              )}

              <div
                onClick={() => {
                  if (earned) onBadgeClick?.(badge);
                }}
                onDoubleClick={() => {
                  if (earned && onSetFeatured) onSetFeatured(badge.id);
                }}
                className={cn(earned && "cursor-pointer")}
              >
                <BadgeCard
                  name={badge.name}
                  icon={badge.icon}
                  rarity={badge.rarity}
                  earned={earned}
                  description={badge.description || undefined}
                />

                {/* Progress bar for unearned badges */}
                {!earned && badgeProgress && badgeProgress.percent > 0 && (
                  <div className="mt-1.5 px-1">
                    <div className="h-1 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          badge.rarity === "legendary" && "bg-gold/60",
                          badge.rarity === "epic" && "bg-[hsl(var(--badge-epic)_/_0.6)]",
                          badge.rarity === "rare" && "bg-[hsl(var(--badge-rare)_/_0.6)]",
                          badge.rarity === "common" && "bg-[hsl(var(--badge-common)_/_0.6)]",
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
          Double-tap an earned badge to set it as your title badge
        </p>
      )}
    </div>
  );
};

export default BadgeVault;
