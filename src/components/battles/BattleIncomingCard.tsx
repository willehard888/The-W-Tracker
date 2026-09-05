import { fmtInt } from "@/lib/format";
import { CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BattleTypeInfo } from "@/components/battles/types";

interface Props {
  battle: any;
  opp: { username?: string; xp?: number; streak?: number };
  typeInfo: BattleTypeInfo;
  onRespond: (battleId: string, accept: boolean) => void;
  /** True while this battle's respond RPC is in flight — disables both buttons. */
  responding?: boolean;
}

/** An incoming challenge awaiting the user's accept/decline. */
const BattleIncomingCard = ({ battle, opp, typeInfo, onRespond, responding = false }: Props) => (
  <div className="rounded-xl border border-gold/20 p-4 glass-3d depth-realistic">
    <div className="flex items-center gap-3 mb-3">
      <div className="h-10 w-10 rounded-full gradient-gold flex items-center justify-center text-sm font-black text-primary-foreground">
        {opp.username?.charAt(0)?.toUpperCase()}
      </div>
      <div className="flex-1">
        <p className="font-bold text-sm">@{opp.username}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <span>{typeInfo.emoji}</span>
          {battle.duration_days}d {typeInfo.label} battle
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">{fmtInt(opp.xp ?? 0)} XP</p>
        <p className="text-xs text-[hsl(var(--streak-orange))]">{opp.streak}d streak</p>
      </div>
    </div>
    <div className="flex gap-2">
      <Button variant="ember" size="sm" className="flex-1" disabled={responding} loading={responding} onClick={() => onRespond(battle.id, true)}>
        <CheckCircle size={14} /> Accept
      </Button>
      <Button variant="secondary" size="sm" className="flex-1" disabled={responding} onClick={() => onRespond(battle.id, false)}>
        <XCircle size={14} /> Decline
      </Button>
    </div>
  </div>
);

export default BattleIncomingCard;
