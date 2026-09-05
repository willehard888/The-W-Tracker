import { Trophy, Swords, ShieldCheck, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BattleTypeInfo } from "@/components/battles/types";

interface Props {
  battle: any;
  opponentName?: string;
  typeInfo: BattleTypeInfo;
  currentUserId?: string;
  isAdmin: boolean;
  onAdminDelete: (battleId: string) => void;
}

/** A completed battle result, with a HealthKit-verified tag on verified wins. */
const BattleHistoryCard = ({ battle, opponentName, typeInfo, currentUserId, isAdmin, onAdminDelete }: Props) => {
  const won = battle.winner_id === currentUserId;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className={cn(
        "h-10 w-10 rounded-lg flex items-center justify-center",
        won ? "bg-gold/15 text-gold" : "bg-destructive/15 text-destructive",
      )}>
        {won ? <Trophy size={18} /> : <Swords size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm flex items-center gap-1.5">
          vs @{opponentName}
          {won && battle.winner_verified === true && (
            <span title="HealthKit-verified win" className="inline-flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wider text-[hsl(var(--xp-green))]">
              <ShieldCheck size={11} /> Verified
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{typeInfo.emoji} {battle.duration_days}d {typeInfo.label}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className={cn("text-sm font-bold font-display", won ? "text-gold" : "text-destructive")}>
          {won ? "Victory 🏆" : "Defeat"}
        </div>
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Battle options" className="relative p-1 rounded-lg hover:bg-secondary transition-colors text-muted-foreground/40 hover:text-muted-foreground before:absolute before:-inset-3 before:content-['']">
                <MoreHorizontal size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAdminDelete(battle.id)} className="text-destructive focus:text-destructive">
                <Trash2 size={14} className="mr-2" />
                Delete battle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

export default BattleHistoryCard;
