import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtRelative } from "@/lib/format";
import type { BattleTypeInfo } from "@/components/battles/types";

interface Props {
  battle: any;
  opponentName?: string;
  typeInfo: BattleTypeInfo;
  /** Given on a declined challenge: the row says so and can be cleared. */
  onDismiss?: (battleId: string) => void;
}

/** A challenge the user sent — waiting on the opponent, or turned down. */
const BattlePendingCard = ({ battle, opponentName, typeInfo, onDismiss }: Props) => {
  const TypeIcon = typeInfo.icon;
  return (
    <div className="flex items-center gap-3 py-3 min-h-11">
      <TypeIcon size={15} className="text-muted-foreground shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-note font-semibold leading-tight truncate">@{opponentName}</p>
        <p className="text-meta text-muted-foreground mt-0.5">
          {battle.duration_days}-day {typeInfo.label} · sent {fmtRelative(battle.created_at)}
        </p>
      </div>
      {onDismiss ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground/75 -mr-2"
          aria-label={`Dismiss the challenge @${opponentName} declined`}
          onClick={() => onDismiss(battle.id)}
        >
          <X aria-hidden size={14} />
        </Button>
      ) : (
        <span className="text-label font-bold text-muted-foreground shrink-0">Waiting</span>
      )}
    </div>
  );
};

export default BattlePendingCard;
