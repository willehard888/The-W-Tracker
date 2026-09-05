import BadgeCard from "./BadgeCard";
import type { BadgeRarity } from "./BadgeCard";
import { cn } from "@/lib/utils";

interface BadgeShowcaseProps {
  badges: Array<{ id: string; name: string; icon: string; rarity: BadgeRarity }>;
  onBadgeClick?: (badge: any) => void;
  className?: string;
  /** Total earned badges count, used for the "+N more" tile */
  totalEarned?: number;
}

const RARITY_ORDER: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };

const BadgeShowcase = ({ badges, onBadgeClick, className, totalEarned }: BadgeShowcaseProps) => {
  if (!badges.length) return null;

  const sorted = [...badges].sort(
    (a, b) => (RARITY_ORDER[a.rarity] ?? 4) - (RARITY_ORDER[b.rarity] ?? 4)
  );
  const display = sorted.slice(0, 5);
  const total = totalEarned ?? badges.length;
  const overflow = total - display.length;

  return (
    // flex-wrap: with 5 badges + the "+N more" tile the row overflows a phone
    // width, and justify-center on an overflowing row CLIPS both edges (the
    // first badge rendered half off-screen). Wrapping keeps every badge fully
    // visible on a centered second row instead.
    <div className={cn("flex flex-wrap items-center gap-3 justify-center", className)}>
      {display.map((badge, idx) => (
        <button
          key={badge.id}
          type="button"
          onClick={() => onBadgeClick?.(badge)}
          className="press relative cursor-pointer transition-transform duration-300 hover:scale-110 "
          style={{ animation: `float-subtle 3.5s ease-in-out ${idx * 200}ms infinite` }}
          aria-label={`${badge.name} badge`}
        >
          <BadgeCard
            name={badge.name}
            icon={badge.icon}
            rarity={badge.rarity}
            earned
            showcase
          />
        </button>
      ))}

      {overflow > 0 && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-[12px] font-black text-muted-foreground">
            +{overflow}
          </div>
          <p className="text-[10px] font-semibold text-muted-foreground">more</p>
        </div>
      )}
    </div>
  );
};

export default BadgeShowcase;
