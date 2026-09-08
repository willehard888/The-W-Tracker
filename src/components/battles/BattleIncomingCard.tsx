import { ActionRow } from "@/components/ActionRow";
import type { BattleTypeInfo } from "@/components/battles/types";

interface Props {
  battle: any;
  opp: { username?: string; xp?: number; streak?: number };
  typeInfo: BattleTypeInfo;
  onRespond: (battleId: string, accept: boolean) => void;
  /** True while this battle's respond RPC is in flight — disables both buttons. */
  responding?: boolean;
}

/** An incoming challenge awaiting the user's accept/decline — the app's one response row. */
const BattleIncomingCard = ({ battle, opp, typeInfo, onRespond, responding = false }: Props) => (
  <ActionRow
    leading={
      <span className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-sm font-black text-muted-foreground">
        {opp.username?.charAt(0)?.toUpperCase()}
      </span>
    }
    title={`@${opp.username}`}
    subtitle={`${battle.duration_days}-day ${typeInfo.label} · ${opp.streak ?? 0}-day streak`}
    busy={responding}
    onAccept={() => onRespond(battle.id, true)}
    onDecline={() => onRespond(battle.id, false)}
  />
);

export default BattleIncomingCard;
