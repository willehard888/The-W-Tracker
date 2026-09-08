import { fmtRelative } from "@/lib/format";
import type { BattleTypeInfo } from "@/components/battles/types";

interface Props {
  battle: any;
  opponentName?: string;
  typeInfo: BattleTypeInfo;
}

/** A challenge the user sent, awaiting the opponent's response. */
const BattlePendingCard = ({ battle, opponentName, typeInfo }: Props) => {
  const TypeIcon = typeInfo.icon;
  return (
    <div className="flex items-center gap-3 py-3 min-h-11">
      <TypeIcon size={15} className="text-muted-foreground shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold leading-tight truncate">@{opponentName}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          {battle.duration_days}-day {typeInfo.label} · sent {fmtRelative(battle.created_at)}
        </p>
      </div>
      <span className="text-[11px] font-bold text-muted-foreground shrink-0">Waiting</span>
    </div>
  );
};

export default BattlePendingCard;
