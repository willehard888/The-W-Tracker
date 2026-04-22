import { Swords, Crown, Clock, Trophy, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import StreakFlameInline from "@/components/StreakFlameInline";
import { collectiveTierName } from "@/lib/tribe-streak";

export interface TribeBattle {
  id: string;
  challenger_tribe_id: string;
  opponent_tribe_id: string;
  challenger_owner_id: string;
  opponent_owner_id: string;
  status: "pending" | "active" | "completed" | "declined" | "expired";
  duration_days: number;
  started_at: string | null;
  ended_at: string | null;
  challenger_score: number;
  opponent_score: number;
  winner_tribe_id: string | null;
  created_at: string;
  challenger?: { id: string; name: string; member_count: number; collective_streak?: number };
  opponent?: { id: string; name: string; member_count: number; collective_streak?: number };
}

interface Props {
  battle: TribeBattle;
  myTribeId: string;
  isOwner: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  responding?: boolean;
}

const TribeBattleCard = ({ battle, myTribeId, isOwner, onAccept, onDecline, responding }: Props) => {
  const myIsChallenger = battle.challenger_tribe_id === myTribeId;
  const me = myIsChallenger ? battle.challenger : battle.opponent;
  const them = myIsChallenger ? battle.opponent : battle.challenger;
  const myScore = myIsChallenger ? battle.challenger_score : battle.opponent_score;
  const theirScore = myIsChallenger ? battle.opponent_score : battle.challenger_score;
  const totalScore = Math.max(myScore + theirScore, 1);
  const myPct = (myScore / totalScore) * 100;

  const startedAt = battle.started_at ? new Date(battle.started_at) : null;
  const endsAt = startedAt
    ? new Date(startedAt.getTime() + battle.duration_days * 24 * 60 * 60 * 1000)
    : null;
  const now = new Date();
  const timeLeft = endsAt ? endsAt.getTime() - now.getTime() : 0;
  const daysLeft = Math.max(0, Math.ceil(timeLeft / (1000 * 60 * 60 * 24)));

  const iWon = battle.winner_tribe_id === myTribeId;
  const isDraw = battle.status === "completed" && !battle.winner_tribe_id;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 relative overflow-hidden",
        battle.status === "active" && "border-[hsl(18_95%_58%)]/45 bg-gradient-to-br from-[hsl(18_95%_58%)]/[0.06] to-card/60 shadow-[0_0_18px_hsl(18_95%_58%/0.15)]",
        battle.status === "pending" && "border-gold/40 bg-gradient-to-br from-gold/[0.05] to-card/60",
        battle.status === "completed" && iWon && "border-gold/60 bg-gradient-to-br from-gold/[0.10] to-card/60 shadow-[0_0_18px_hsl(var(--gold)/0.25)]",
        battle.status === "completed" && !iWon && !isDraw && "border-border/50 bg-card/50",
        battle.status === "completed" && isDraw && "border-border/60 bg-card/50",
        (battle.status === "declined" || battle.status === "expired") && "border-border/40 bg-card/30 opacity-80",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-black text-muted-foreground">
          <Swords size={11} className="text-[hsl(18_95%_58%)]" />
          {battle.status === "pending" && (myIsChallenger ? "Awaiting Response" : "Incoming Challenge")}
          {battle.status === "active" && "Battle Live"}
          {battle.status === "completed" && (iWon ? <span className="text-gold">Victory</span> : isDraw ? "Draw" : "Defeat")}
          {battle.status === "declined" && "Declined"}
          {battle.status === "expired" && "Expired"}
        </div>
        {battle.status === "active" && (
          <div className="inline-flex items-center gap-1 text-[10px] font-bold text-foreground/80">
            <Clock size={10} />
            {daysLeft === 0 ? "Ending" : `${daysLeft}d left`}
          </div>
        )}
        {battle.status === "completed" && iWon && (
          <Trophy size={14} className="text-gold drop-shadow-[0_0_6px_hsl(var(--gold)/0.7)]" />
        )}
      </div>

      {/* Vs row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Your tribe</p>
          <p className="font-display font-black text-sm truncate text-gold">{me?.name ?? "—"}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums">{me?.member_count ?? 0} members</p>
        </div>
        <div className="font-display font-black text-[10px] text-muted-foreground px-2">VS</div>
        <div className="flex-1 min-w-0 text-right">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Challenger</p>
          <p className="font-display font-black text-sm truncate text-foreground">{them?.name ?? "—"}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums">{them?.member_count ?? 0} members</p>
        </div>
      </div>

      {/* Scoreboard / progress */}
      {(battle.status === "active" || battle.status === "completed") && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-black tabular-nums text-gold">{myScore.toLocaleString()} XP</span>
            <span className="text-xs font-black tabular-nums text-foreground/80">{theirScore.toLocaleString()} XP</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-gold to-[hsl(18_95%_58%)] transition-all"
              style={{ width: `${myPct}%` }}
            />
            <div
              className="h-full bg-foreground/30"
              style={{ width: `${100 - myPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{battle.duration_days}-day battle</span>
        <span>
          {battle.status === "pending"
            ? `Sent ${formatDistanceToNow(new Date(battle.created_at), { addSuffix: true })}`
            : battle.status === "active" && startedAt
            ? `Started ${formatDistanceToNow(startedAt, { addSuffix: true })}`
            : battle.ended_at
            ? `Ended ${formatDistanceToNow(new Date(battle.ended_at), { addSuffix: true })}`
            : null}
        </span>
      </div>

      {/* Pending opponent actions */}
      {battle.status === "pending" && !myIsChallenger && isOwner && (
        <div className="flex gap-2 mt-3">
          <Button
            onClick={onAccept}
            disabled={responding}
            size="sm"
            className="flex-1 bg-gradient-to-r from-[hsl(18_95%_58%)] to-gold text-background font-black"
          >
            {responding ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Accept
          </Button>
          <Button
            onClick={onDecline}
            disabled={responding}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <X size={14} /> Decline
          </Button>
        </div>
      )}
    </div>
  );
};

export default TribeBattleCard;
