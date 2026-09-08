import { Check, Clock, Flame, Swords, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ActionRow } from "@/components/ActionRow";
import { cn } from "@/lib/utils";
import { fmtInt, fmtRelative, fmtUnit } from "@/lib/format";
import TribeFireLite from "@/components/TribeFireLite";
import { collectiveStreakTier, collectivePalette } from "@/lib/tribe-streak";
import { daysLeft } from "@/components/battles/battle-time";

/** A tribe as one side of a battle. MyTribeBattles hydrates only id + name. */
export interface TribeSide {
  id: string;
  name: string;
  member_count?: number;
  collective_streak?: number;
}

/** The columns a row reads. TribeBattles hydrates the full TribeBattle; MyTribeBattles selects just these. */
export interface TribeBattleLite {
  id: string;
  challenger_tribe_id: string;
  opponent_tribe_id: string;
  status: "pending" | "active" | "completed" | "declined" | "expired";
  duration_days: number;
  started_at: string | null;
  ended_at: string | null;
  challenger_score: number;
  opponent_score: number;
  winner_tribe_id: string | null;
  created_at: string;
  challenger?: TribeSide;
  opponent?: TribeSide;
}

export interface TribeBattle extends TribeBattleLite {
  challenger_owner_id: string;
  opponent_owner_id: string;
}

/**
 * Live standings. The stored scores are only written at resolution, so an
 * active battle used to show 0–0 for its entire duration. Keyed by battle id,
 * so the hero and a row for the same battle share one fetch.
 */
const useTribeBattleStandings = (battle: TribeBattleLite) => {
  const { data } = useQuery({
    queryKey: ["tribe-battle-standings", battle.id],
    enabled: battle.status === "active",
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tribe_battle_standings", { p_battle_id: battle.id });
      if (error) throw error;
      return data as unknown as { challenger_score: number; opponent_score: number };
    },
  });
  return {
    challenger: data?.challenger_score ?? battle.challenger_score,
    opponent: data?.opponent_score ?? battle.opponent_score,
  };
};

/** Both sides from my tribe's seat. */
const sidesOf = (battle: TribeBattleLite, myTribeId: string, scores: { challenger: number; opponent: number }) => {
  const myIsChallenger = battle.challenger_tribe_id === myTribeId;
  return {
    myIsChallenger,
    me: myIsChallenger ? battle.challenger : battle.opponent,
    them: myIsChallenger ? battle.opponent : battle.challenger,
    myScore: myIsChallenger ? scores.challenger : scores.opponent,
    theirScore: myIsChallenger ? scores.opponent : scores.challenger,
  };
};

const scorePair = (mine: number, theirs: number) => (
  <p className="text-[13px] tabular-nums shrink-0">
    <span className={cn("font-black", mine < theirs && "text-muted-foreground")}>{fmtInt(mine)}</span>
    <span className="text-muted-foreground/60">–</span>
    <span className={cn("font-black", mine > theirs && "text-muted-foreground")}>{fmtInt(theirs)}</span>
  </p>
);

interface Props {
  battle: TribeBattle;
  myTribeId: string;
  isOwner: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  responding?: boolean;
}

/**
 * The hero: the tribe battle that matters most, live or waiting for an
 * answer. Two flames, two scores with the leading one in gold, one bar, the
 * gap in XP, and the answer buttons when the challenge is ours to take.
 */
const TribeBattleCard = ({ battle, myTribeId, isOwner, onAccept, onDecline, responding }: Props) => {
  const scores = useTribeBattleStandings(battle);
  const { me, them, myScore, theirScore, myIsChallenger } = sidesOf(battle, myTribeId, scores);
  const live = battle.status === "active";
  const scored = live || battle.status === "completed";
  const incoming = battle.status === "pending" && !myIsChallenger;
  const days = daysLeft(battle.started_at, battle.duration_days);
  // 0–0 splits the bar, not "the other side has it all".
  const total = myScore + theirScore;
  const myPct = total === 0 ? 50 : (myScore / total) * 100;
  const gap = Math.abs(myScore - theirScore);
  const leading = myScore >= theirScore;

  const side = (s: TribeSide | undefined, fallback: string, score: number, felt: boolean) => {
    const streak = s?.collective_streak ?? 0;
    const members = s?.member_count ?? 0;
    const tier = collectiveStreakTier(streak);
    return (
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-9 flex items-end justify-center shrink-0" aria-hidden>
            {tier >= 0 ? (
              <TribeFireLite tier={tier} palette={collectivePalette(streak)} variant="mini" size={26} />
            ) : (
              <Flame size={14} className="text-muted-foreground/40" strokeWidth={1.6} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold truncate">{s?.name ?? fallback}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {fmtInt(members)} member{members === 1 ? "" : "s"} · {fmtInt(streak)}d collective
            </p>
          </div>
        </div>
        {scored && (
          <p className={cn(
            "font-display font-black text-[22px] tabular-nums leading-none shrink-0",
            felt ? "text-gold glow-gold-text" : "text-foreground/70",
          )}>
            {fmtInt(score)}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between gap-3 text-[11px] font-bold">
        <p className="text-muted-foreground">
          {battle.duration_days}-day battle
          {battle.status === "pending" && ` · sent ${fmtRelative(battle.created_at)}`}
          {live && battle.started_at && ` · started ${fmtRelative(battle.started_at)}`}
          {battle.ended_at && ` · ended ${fmtRelative(battle.ended_at)}`}
        </p>
        {live && (
          <span className="inline-flex items-center gap-1 text-[hsl(var(--streak-orange))] shrink-0">
            <Clock size={11} aria-hidden /> {days === 0 ? "Final day" : `${days}d left`}
          </span>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {side(me, "Your tribe", myScore, leading)}
        {scored && (
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden flex">
            <div className="h-full bg-gold" style={{ width: `${myPct}%` }} />
            <div className="h-full bg-foreground/25" style={{ width: `${100 - myPct}%` }} />
          </div>
        )}
        {side(them, "Another tribe", theirScore, !leading)}
      </div>

      {live && (
        <p className={cn("mt-3 text-[12px] font-bold", leading ? "text-gold" : "text-[hsl(var(--ember))]")}>
          {gap === 0 ? "Dead even." : leading ? `Ahead by ${fmtUnit(gap, "XP")}.` : `Behind by ${fmtUnit(gap, "XP")}.`}
        </p>
      )}

      {incoming && (
        isOwner && onAccept && onDecline ? (
          <div className="mt-4 pt-4 border-t border-border/35 flex gap-2">
            <Button variant="ember" size="sm" className="flex-1 min-h-11" loading={responding} onClick={onAccept}>
              <Check size={14} aria-hidden /> Accept
            </Button>
            <Button variant="outline" size="sm" className="flex-1 min-h-11" disabled={responding} onClick={onDecline}>
              <X size={14} aria-hidden /> Decline
            </Button>
          </div>
        ) : (
          <p className="mt-4 pt-4 border-t border-border/35 text-[12px] text-muted-foreground">
            Only the tribe owner can answer.
          </p>
        )
      )}
    </div>
  );
};

/**
 * One line of the ledger. Weight carries the leading side; gold stays with
 * the hero. With `onClick` it is a door to the arena; with `onAccept` and
 * `onDecline` an incoming challenge becomes the app's one response row.
 */
export const TribeBattleRow = ({
  battle, myTribeId, onClick, onAccept, onDecline, responding,
}: {
  battle: TribeBattleLite;
  myTribeId: string;
  onClick?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  responding?: boolean;
}) => {
  const scores = useTribeBattleStandings(battle);
  const { them, myScore, theirScore, myIsChallenger } = sidesOf(battle, myTribeId, scores);
  const name = them?.name ?? "Another tribe";
  const days = daysLeft(battle.started_at, battle.duration_days);
  const iWon = battle.winner_tribe_id === myTribeId;
  const isDraw = battle.status === "completed" && !battle.winner_tribe_id;

  if (battle.status === "pending" && !myIsChallenger && onAccept && onDecline) {
    // ActionRow carries its own px-3; pull it back flush with the plain rows.
    return (
      <div className="-mx-3">
        <ActionRow
          leading={<Swords size={15} className="text-muted-foreground" aria-hidden />}
          title={name}
          subtitle={`Wants a ${battle.duration_days}-day battle`}
          busy={responding}
          onAccept={onAccept}
          onDecline={onDecline}
        />
      </div>
    );
  }

  const sub =
    battle.status === "active" ? `${battle.duration_days}-day battle · ${days === 0 ? "final day" : `${days}d left`}`
    : battle.status === "pending" ? `${battle.duration_days}-day battle · sent ${fmtRelative(battle.created_at)}`
    : battle.status === "completed" ? `${fmtInt(myScore)}–${fmtInt(theirScore)}${battle.ended_at ? ` · ended ${fmtRelative(battle.ended_at)}` : ""}`
    : `${battle.duration_days}-day battle`;

  const trailing =
    battle.status === "active" ? scorePair(myScore, theirScore)
    : battle.status === "completed" ? (
      <span className={cn("text-[12px] shrink-0", iWon ? "font-black" : "font-bold text-muted-foreground")}>
        {iWon ? "Won" : isDraw ? "Draw" : "Lost"}
      </span>
    ) : (
      <span className="text-[11px] font-bold text-muted-foreground shrink-0">
        {battle.status === "pending" ? (myIsChallenger ? "Waiting" : "Unanswered") : battle.status === "declined" ? "Declined" : "Expired"}
      </span>
    );

  const body = (
    <>
      <Swords size={15} className="text-muted-foreground shrink-0" aria-hidden />
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold leading-tight truncate">{name}</span>
        <span className="block text-[12px] text-muted-foreground mt-0.5 tabular-nums">{sub}</span>
      </span>
      {trailing}
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className="press w-full min-h-11 flex items-center gap-3 py-3 text-left">
      {body}
    </button>
  ) : (
    <div className="flex items-center gap-3 py-3 min-h-11">{body}</div>
  );
};

export default TribeBattleCard;
