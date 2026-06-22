import { Image } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BattleTypeInfo } from "@/components/battles/types";

interface Props {
  battle: any;
  typeInfo: BattleTypeInfo;
  myVote?: string;
  counts: Record<string, number>;
  onVote: (battleId: string, votedFor: string) => void;
}

/** A tied battle in community voting — proof photos side-by-side + vote bar. */
const BattleVoteCard = ({ battle, typeInfo, myVote, counts, onVote }: Props) => {
  const challengerVotes = counts[battle.challenger_id] || 0;
  const opponentVotes = counts[battle.opponent_id] || 0;
  const totalVotes = challengerVotes + opponentVotes;

  const voteBtn = (votedFor: string, votes: number, mine: boolean) => (
    <button
      onClick={() => onVote(battle.id, votedFor)}
      disabled={!!myVote}
      className={cn(
        "w-full py-2 rounded-lg text-xs font-bold transition-all active:scale-95 border",
        mine
          ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
          : myVote
            ? "bg-secondary/50 border-border text-muted-foreground cursor-not-allowed"
            : "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20",
      )}
    >
      {mine ? `Voted ✓ (${votes})` : myVote ? `${votes}` : `Vote (${votes})`}
    </button>
  );

  return (
    <div className="rounded-xl border border-purple-500/20 overflow-hidden glass-3d depth-realistic">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1">
          {typeInfo.emoji} {typeInfo.label} Battle — TIE
        </span>
        <span className="text-[10px] text-muted-foreground">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
      </div>

      <div className="flex gap-2 px-4 py-3">
        <div className="flex-1 text-center">
          <div className="relative rounded-lg overflow-hidden aspect-square bg-secondary mb-2">
            {battle.challenger_proof_url ? (
              <img loading="lazy" decoding="async" src={battle.challenger_proof_url} alt="Challenger proof" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground/40"><Image size={24} /></div>
            )}
          </div>
          <p className="text-xs font-bold truncate mb-1">@{battle.challengerProfile?.username || "?"}</p>
          {voteBtn(battle.challenger_id, challengerVotes, myVote === battle.challenger_id)}
        </div>

        <div className="flex flex-col items-center justify-center px-1">
          <span className="text-lg font-black text-muted-foreground/30">VS</span>
        </div>

        <div className="flex-1 text-center">
          <div className="relative rounded-lg overflow-hidden aspect-square bg-secondary mb-2">
            {battle.opponent_proof_url ? (
              <img loading="lazy" decoding="async" src={battle.opponent_proof_url} alt="Opponent proof" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground/40"><Image size={24} /></div>
            )}
          </div>
          <p className="text-xs font-bold truncate mb-1">@{battle.opponentProfile?.username || "?"}</p>
          {voteBtn(battle.opponent_id, opponentVotes, myVote === battle.opponent_id)}
        </div>
      </div>

      {totalVotes > 0 && (
        <div className="px-4 pb-3">
          <div className="h-2 rounded-full bg-secondary overflow-hidden flex">
            <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${(challengerVotes / totalVotes) * 100}%` }} />
            <div className="h-full bg-gold transition-all duration-500" style={{ width: `${(opponentVotes / totalVotes) * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default BattleVoteCard;
