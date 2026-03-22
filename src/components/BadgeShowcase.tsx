import BadgeCard from "./BadgeCard";
import type { BadgeRarity } from "./BadgeCard";
import { cn } from "@/lib/utils";

interface BadgeShowcaseProps {
  badges: Array<{ id: string; name: string; icon: string; rarity: BadgeRarity }>;
  onBadgeClick?: (badge: any) => void;
  className?: string;
}

const BadgeShowcase = ({ badges, onBadgeClick, className }: BadgeShowcaseProps) => {
  if (!badges.length) return null;

  // Sort: legendary first, then epic, rare, common
  const rarityOrder: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };
  const sorted = [...badges].sort((a, b) => (rarityOrder[a.rarity] ?? 4) - (rarityOrder[b.rarity] ?? 4));
  const display = sorted.slice(0, 5);

  return (
    <div className={cn("flex items-center gap-3 justify-center", className)}>
      {display.map((badge) => (
        <div
          key={badge.id}
          onClick={() => onBadgeClick?.(badge)}
          className="cursor-pointer transition-transform duration-300 hover:scale-110 active:scale-95"
        >
          <BadgeCard
            name={badge.name}
            icon={badge.icon}
            rarity={badge.rarity}
            earned
            showcase
          />
        </div>
      ))}
    </div>
  );
};

export default BadgeShowcase;
