import { useNavigate } from "react-router-dom";
import { Camera, MoreHorizontal, ShieldCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignedMediaUrl } from "@/lib/signed-url";
import { fmtUnit } from "@/lib/format";
import type { BattleTypeInfo } from "@/components/battles/types";
import type { BattleScoreboard, BattleSide } from "@/hooks/use-battle-scores";
import { battleDay } from "@/components/battles/battle-time";

/** Scores are numeric on the wire: whole numbers stay whole, litres and hours keep one decimal. */
export const fmtScore = (n: number): string =>
  Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 1 });

/** The two sides of a battle from the member's seat, from the live scoreboard or the row's final totals. */
export const sidesOf = (
  battle: { challenger_id: string; challenger_score: number | null; opponent_score: number | null },
  meId: string | undefined,
  board?: BattleScoreboard,
): { mine: BattleSide | null; theirs: BattleSide | null; myScore: number; oppScore: number } => {
  const amChallenger = battle.challenger_id === meId;
  const c = board?.challenger ?? null;
  const o = board?.opponent ?? null;
  const mine = amChallenger ? c : o;
  const theirs = amChallenger ? o : c;
  const cScore = c ? c.total : Number(battle.challenger_score ?? 0);
  const oScore = o ? o.total : Number(battle.opponent_score ?? 0);
  return { mine, theirs, myScore: amChallenger ? cScore : oScore, oppScore: amChallenger ? oScore : cScore };
};

interface Props {
  battle: any;
  opp: { username?: string; user_id?: string };
  typeInfo: BattleTypeInfo;
  profileUsername?: string;
  meId?: string;
  board?: BattleScoreboard;
  myProof: string | null;
  oppProof: string | null;
  isAdmin: boolean;
  isUploading: boolean;
  onRequestUpload: (battleId: string) => void;
  onAdminCancel: (battleId: string) => void;
  onAdminDelete: (battleId: string) => void;
}

/**
 * The hero: the one live battle that matters most. Two totals, the day rail,
 * where the battle stands today, and the proof photo as a quiet aside. The
 * leading total is the screen's one felt number.
 */
const BattleActiveCard = ({
  battle, opp, typeInfo, profileUsername, meId, board,
  myProof, oppProof, isAdmin, isUploading, onRequestUpload, onAdminCancel, onAdminDelete,
}: Props) => {
  const navigate = useNavigate();
  // proof-photos is a private bucket — render via signed URLs.
  const myProofSrc = useSignedMediaUrl(myProof);
  const oppProofSrc = useSignedMediaUrl(oppProof);
  const { mine, theirs, myScore, oppScore } = sidesOf(battle, meId, board);
  const amWinning = myScore >= oppScore;
  const gap = Math.abs(myScore - oppScore);
  const { day, total, started } = battleDay(battle.start_date, battle.end_date);
  const days = mine?.days ?? [];
  const peak = Math.max(1, ...days.map((d) => d.v), ...(theirs?.days ?? []).map((d) => d.v));

  const score = (n: number, felt: boolean) => (
    <p className={cn(
      "font-display font-black text-major tabular-nums leading-none shrink-0",
      felt ? "text-gold glow-gold-text" : "text-foreground/75",
    )}>
      {fmtScore(n)}
    </p>
  );

  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-label font-bold text-muted-foreground flex items-center gap-1.5">
          {typeInfo.label}
          {typeInfo.verified && <ShieldCheck size={12} className="text-[hsl(var(--xp-green))]" aria-label="Verified by Apple Health" />}
          {" · "}{total || battle.duration_days} days
        </p>
        <div className="flex items-center gap-1">
          <span className="text-label font-bold text-[hsl(var(--streak-orange))]">
            {!started ? "Starts tomorrow" : day >= total ? "Final day" : `Day ${day} of ${total}`}
          </span>
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Battle options" className="text-muted-foreground/75">
                  <MoreHorizontal aria-hidden size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                <DropdownMenuItem onClick={() => onAdminCancel(battle.id)} className="text-[hsl(var(--streak-orange))]">
                  <ShieldCheck aria-hidden size={14} className="mr-2" />
                  Cancel battle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAdminDelete(battle.id)} className="text-destructive focus:text-destructive">
                  <Trash2 aria-hidden size={14} className="mr-2" />
                  Delete battle
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Scoreboard — the leading total is the one felt number. */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-dense font-bold truncate">
          @{profileUsername} <span className="text-muted-foreground font-medium">you</span>
        </p>
        {score(myScore, amWinning)}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-dense font-bold truncate">@{opp.username}</p>
        {score(oppScore, !amWinning)}
      </div>
      <p className={cn("mt-3 text-meta font-bold", amWinning ? "text-gold" : "text-[hsl(var(--ember))]")}>
        {!started
          ? "Nothing counts until tomorrow."
          : gap === 0
            ? "Dead even."
            : amWinning
              ? `Ahead by ${fmtUnit(gap, typeInfo.unit)}.`
              : `Behind by ${fmtUnit(gap, typeInfo.unit)}.`}
      </p>

      {/* The day rail — one pair of bars per day, yours on top. Reads at a glance
          which days you showed up; the totals above carry the numbers. */}
      {days.length > 0 && (
        <ol className="mt-4 flex items-end gap-1" aria-label="Day by day">
          {days.map((d, i) => {
            const th = theirs?.days[i];
            const mineH = Math.max(2, Math.round((d.v / peak) * 28));
            const theirH = Math.max(2, Math.round(((th?.v ?? 0) / peak) * 28));
            const isToday = i === day - 1;
            return (
              <li key={d.d} className="flex-1 min-w-0 flex flex-col items-center gap-0.5" aria-label={`Day ${i + 1}: you ${fmtScore(d.v)}, them ${fmtScore(th?.v ?? 0)}`}>
                <span className="w-full rounded-sm bg-gold" style={{ height: mineH, opacity: d.v > 0 ? 1 : 0.25 }} aria-hidden />
                <span className="w-full rounded-sm bg-foreground/35" style={{ height: theirH, opacity: (th?.v ?? 0) > 0 ? 1 : 0.25 }} aria-hidden />
                <span className={cn("text-label tabular-nums leading-none mt-0.5", isToday ? "text-foreground font-bold" : "text-muted-foreground/75")} aria-hidden>
                  {i + 1}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Proof — optional now that the score comes from the data; a photo still
          says you showed up. */}
      <div className="mt-4 pt-4 border-t border-border/35 flex items-center gap-3">
        {(myProofSrc || oppProofSrc) && (
          <div className="flex -space-x-2 shrink-0">
            {myProofSrc && <img loading="lazy" decoding="async" src={myProofSrc} alt="Your proof" className="h-10 w-10 rounded-lg object-cover ring-2 ring-card" />}
            {/* Their photo is user-generated content shown to this member, so
                it needs the same report door as a post (App Review 1.2). A tap
                opens their profile, where Report and Block already live. */}
            {oppProofSrc && (
              <button
                type="button"
                onClick={() => opp.user_id && navigate(`/user/${opp.user_id}`)}
                aria-label={`Open @${opp.username ?? "opponent"}'s profile to report or block`}
                className="press rounded-lg"
              >
                <img loading="lazy" decoding="async" src={oppProofSrc} alt={`@${opp.username}'s proof`} className="h-10 w-10 rounded-lg object-cover ring-2 ring-card" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-dense font-bold leading-tight">
            {typeInfo.verified ? "Scored from Apple Health." : "Scored from your check-ins."}
          </p>
          <p className="text-label text-muted-foreground mt-0.5">
            {!myProof ? "Add a photo if you want the receipt." : !oppProof ? `Your proof is in. Waiting on @${opp.username}.` : "Both proofs are in."}
          </p>
        </div>
        {!myProof && (
          <Button variant="ghost" size="sm" className="min-h-11 shrink-0 text-muted-foreground" loading={isUploading} onClick={() => onRequestUpload(battle.id)}>
            <Camera size={14} aria-hidden /> Proof
          </Button>
        )}
      </div>
    </div>
  );
};

/** A second live battle: a hairline row with the totals and the day. */
export const BattleActiveRow = ({
  battle, opp, typeInfo, meId, board,
}: Pick<Props, "battle" | "opp" | "typeInfo" | "meId" | "board">) => {
  const TypeIcon = typeInfo.icon;
  const { myScore, oppScore } = sidesOf(battle, meId, board);
  const { day, total, started } = battleDay(battle.start_date, battle.end_date);
  return (
    <div className="flex items-center gap-3 py-3 min-h-11">
      <TypeIcon size={15} className="text-muted-foreground shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-note font-semibold leading-tight truncate">@{opp.username}</p>
        <p className="text-meta text-muted-foreground mt-0.5">
          {typeInfo.label} · {!started ? "starts tomorrow" : day >= total ? "final day" : `day ${day} of ${total}`}
        </p>
      </div>
      <p className="text-dense tabular-nums shrink-0">
        <span className={cn("font-black", myScore < oppScore && "text-muted-foreground")}>{fmtScore(myScore)}</span>
        <span className="text-muted-foreground/75"> to </span>
        <span className={cn("font-black", myScore > oppScore && "text-muted-foreground")}>{fmtScore(oppScore)}</span>
      </p>
    </div>
  );
};

export default BattleActiveCard;
