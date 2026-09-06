import type { BattleTypeInfo } from "@/components/battles/types";

interface Props {
  battle: any;
  opponentName?: string;
  typeInfo: BattleTypeInfo;
}

/** A challenge the user sent, awaiting the opponent's response. */
const BattlePendingCard = ({ battle, opponentName, typeInfo }: Props) => (
  <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-sm font-black text-muted-foreground">
      {opponentName?.charAt(0)?.toUpperCase()}
    </div>
    <div className="flex-1">
      <p className="font-semibold text-sm">@{opponentName}</p>
      <p className="text-xs text-muted-foreground">{typeInfo.emoji} {battle.duration_days}d {typeInfo.label}</p>
    </div>
    <span className="eyebrow text-muted-foreground px-2 py-1 rounded-full bg-secondary">
      Pending
    </span>
  </div>
);

export default BattlePendingCard;
