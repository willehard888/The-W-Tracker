import { Check, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSignedMediaUrl } from "@/lib/signed-url";
import { useCommitPop } from "@/hooks/use-commit-pop";
import type { BattleTypeInfo } from "@/components/battles/types";

interface Props {
  battle: any;
  typeInfo: BattleTypeInfo;
  myVote?: string;
  counts: Record<string, number>;
  onVote: (battleId: string, votedFor: string) => void;
}

/**
 * A tied battle in community voting: two proof photos side by side, one vote.
 * A feed-style entry, not a box — the photos are the content.
 */
const BattleVoteCard = ({ battle, typeInfo, myVote, counts, onVote }: Props) => {
  // proof-photos is a private bucket — render via signed URLs.
  const challengerProof = useSignedMediaUrl(battle.challenger_proof_url);
  const opponentProof = useSignedMediaUrl(battle.opponent_proof_url);
  const challengerVotes = counts[battle.challenger_id] || 0;
  const opponentVotes = counts[battle.opponent_id] || 0;
  const totalVotes = challengerVotes + opponentVotes;
  // The vote landing is the app's one "your choice landed" spring.
  const popChallenger = useCommitPop(myVote === battle.challenger_id);
  const popOpponent = useCommitPop(myVote === battle.opponent_id);

  const side = (id: string, name: string | undefined, src: string | null, votes: number, pop: boolean) => {
    const mine = myVote === id;
    return (
      <div className="flex-1 min-w-0">
        <div className="rounded-xl overflow-hidden aspect-square bg-secondary">
          {src ? (
            <img loading="lazy" decoding="async" src={src} alt={`@${name ?? "?"}'s proof`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/75"><Image size={22} aria-hidden /></div>
          )}
        </div>
        <p className="mt-2 text-[13px] font-bold truncate">@{name || "?"}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums">{votes} {votes === 1 ? "vote" : "votes"}</p>
        <Button
          variant={mine ? "gold-outline" : "outline"}
          size="sm"
          className={cn("mt-2 w-full min-h-11", pop && "commit-pop")}
          disabled={!!myVote}
          onClick={() => onVote(battle.id, id)}
        >
          {mine ? <><Check size={13} aria-hidden /> Voted</> : "Vote"}
        </Button>
      </div>
    );
  };

  return (
    <div className="py-4">
      <p className="text-[12px] font-bold text-muted-foreground">
        {typeInfo.label} tie · {totalVotes} {totalVotes === 1 ? "vote" : "votes"} so far
      </p>
      <div className="mt-3 flex gap-3">
        {side(battle.challenger_id, battle.challengerProfile?.username, challengerProof, challengerVotes, popChallenger)}
        {side(battle.opponent_id, battle.opponentProfile?.username, opponentProof, opponentVotes, popOpponent)}
      </div>
      {totalVotes > 0 && (
        <div className="mt-3 h-1 rounded-full bg-secondary overflow-hidden flex">
          <div className="h-full bg-gold transition-[width] duration-500" style={{ width: `${(challengerVotes / totalVotes) * 100}%` }} />
          <div className="h-full bg-foreground/25" style={{ width: `${(opponentVotes / totalVotes) * 100}%` }} />
        </div>
      )}
    </div>
  );
};

export default BattleVoteCard;
