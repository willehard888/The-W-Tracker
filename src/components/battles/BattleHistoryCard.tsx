import { Trophy, Swords, ShieldCheck, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fmtRelative } from "@/lib/format";
import type { BattleTypeInfo } from "@/components/battles/types";

interface Props {
  battle: any;
  opponentName?: string;
  typeInfo: BattleTypeInfo;
  currentUserId?: string;
  isAdmin: boolean;
  onAdminDelete: (battleId: string) => void;
}

/** One line of the record. Weight carries the result; gold stays with the hero. */
const BattleHistoryCard = ({ battle, opponentName, typeInfo, currentUserId, isAdmin, onAdminDelete }: Props) => {
  const won = battle.winner_id === currentUserId;
  const Icon = won ? Trophy : Swords;
  return (
    <div className="flex items-center gap-3 py-3 min-h-11">
      <Icon size={15} className={cn("shrink-0", won ? "text-foreground" : "text-muted-foreground/75")} aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold leading-tight truncate">@{opponentName}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          {battle.duration_days}-day {typeInfo.label}{battle.ended_at ? ` · ended ${fmtRelative(battle.ended_at)}` : ""}
        </p>
      </div>
      <span className={cn("inline-flex items-center gap-1 text-[12px] shrink-0", won ? "font-black" : "font-bold text-muted-foreground")}>
        {won && battle.winner_verified === true && (
          <ShieldCheck size={12} className="text-[hsl(var(--xp-green))]" aria-label="HealthKit-verified win" />
        )}
        {won ? "Won" : battle.winner_id ? "Lost" : "No result"}
      </span>
      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Battle options" className="text-muted-foreground/75 -mr-2">
              <MoreHorizontal aria-hidden size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAdminDelete(battle.id)} className="text-destructive focus:text-destructive">
              <Trash2 aria-hidden size={14} className="mr-2" />
              Delete battle
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export default BattleHistoryCard;
