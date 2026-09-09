import { Clock, Camera, MoreHorizontal, ShieldCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignedMediaUrl } from "@/lib/signed-url";
import { fmtInt, fmtUnit } from "@/lib/format";
import type { BattleTypeInfo } from "@/components/battles/types";

interface Props {
  battle: any;
  opp: { username?: string };
  typeInfo: BattleTypeInfo;
  profileUsername?: string;
  myScore: number;
  oppScore: number;
  amWinning: boolean;
  daysLeft: number;
  myProof: string | null;
  oppProof: string | null;
  isAdmin: boolean;
  isUploading: boolean;
  onRequestUpload: (battleId: string) => void;
  onAdminCancel: (battleId: string) => void;
  onAdminDelete: (battleId: string) => void;
}

/**
 * The hero: the one live battle that matters most. Two scores, one bar, the
 * time left, and the proof photo that keeps the battle valid.
 */
const BattleActiveCard = ({
  battle, opp, typeInfo, profileUsername, myScore, oppScore, amWinning, daysLeft,
  myProof, oppProof, isAdmin, isUploading, onRequestUpload, onAdminCancel, onAdminDelete,
}: Props) => {
  // proof-photos is a private bucket — render via signed URLs.
  const myProofSrc = useSignedMediaUrl(myProof);
  const oppProofSrc = useSignedMediaUrl(oppProof);
  // 0–0 splits the bar, not "the other side has it all".
  const total = myScore + oppScore;
  const myPct = total === 0 ? 50 : (myScore / total) * 100;
  const gap = Math.abs(myScore - oppScore);
  const score = (n: number, felt: boolean) => (
    <p className={cn(
      "font-display font-black text-[22px] tabular-nums leading-none shrink-0",
      felt ? "text-gold glow-gold-text" : "text-foreground/70",
    )}>
      {fmtInt(n)}
    </p>
  );

  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold text-muted-foreground">{typeInfo.label} · {battle.duration_days} days</p>
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[hsl(var(--streak-orange))]">
            <Clock size={11} aria-hidden /> {daysLeft === 0 ? "Final day" : `${daysLeft}d left`}
          </span>
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Battle options" className="text-muted-foreground/60">
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                <DropdownMenuItem onClick={() => onAdminCancel(battle.id)} className="text-[hsl(var(--streak-orange))]">
                  <ShieldCheck size={14} className="mr-2" />
                  Cancel battle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAdminDelete(battle.id)} className="text-destructive focus:text-destructive">
                  <Trash2 size={14} className="mr-2" />
                  Delete battle
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Scoreboard — the leading score is the screen's one felt number. */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-[13px] font-bold truncate">
          @{profileUsername} <span className="text-muted-foreground font-medium">you</span>
        </p>
        {score(myScore, amWinning)}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden flex">
        <div className="h-full bg-gold" style={{ width: `${myPct}%` }} />
        <div className="h-full bg-foreground/25" style={{ width: `${100 - myPct}%` }} />
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-[13px] font-bold truncate">@{opp.username}</p>
        {score(oppScore, !amWinning)}
      </div>
      <p className={cn("mt-3 text-[12px] font-bold", amWinning ? "text-gold" : "text-[hsl(var(--ember))]")}>
        {gap === 0 ? "Dead even." : amWinning ? `Ahead by ${fmtUnit(gap, typeInfo.unit)}.` : `Behind by ${fmtUnit(gap, typeInfo.unit)}.`}
      </p>

      {/* Proof — required; no photo by the end is a forfeit. */}
      <div className="mt-4 pt-4 border-t border-border/35 flex items-center gap-3">
        {(myProofSrc || oppProofSrc) && (
          <div className="flex -space-x-2 shrink-0">
            {myProofSrc && <img loading="lazy" decoding="async" src={myProofSrc} alt="Your proof" className="h-10 w-10 rounded-lg object-cover ring-2 ring-card" />}
            {oppProofSrc && <img loading="lazy" decoding="async" src={oppProofSrc} alt={`@${opp.username}'s proof`} className="h-10 w-10 rounded-lg object-cover ring-2 ring-card" />}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold leading-tight">
            {!myProof ? "Your proof is missing." : !oppProof ? "Your proof is in." : "Both proofs are in."}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {!myProof ? "No photo by the end is a forfeit." : !oppProof ? `Waiting on @${opp.username}.` : "The score decides."}
          </p>
        </div>
        {!myProof && (
          <Button variant="ember" size="sm" className="min-h-11 shrink-0" loading={isUploading} onClick={() => onRequestUpload(battle.id)}>
            <Camera size={14} aria-hidden /> Add proof
          </Button>
        )}
      </div>
    </div>
  );
};

/** A second live battle: a hairline row with the score and, if needed, the proof button. */
export const BattleActiveRow = ({
  battle, opp, typeInfo, myScore, oppScore, daysLeft, myProof, isUploading, onRequestUpload,
}: Pick<Props, "battle" | "opp" | "typeInfo" | "myScore" | "oppScore" | "daysLeft" | "myProof" | "isUploading" | "onRequestUpload">) => {
  const TypeIcon = typeInfo.icon;
  return (
    <div className="flex items-center gap-3 py-3 min-h-11">
      <TypeIcon size={15} className="text-muted-foreground shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold leading-tight truncate">@{opp.username}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">{typeInfo.label} · {daysLeft === 0 ? "final day" : `${daysLeft}d left`}</p>
      </div>
      <p className="text-[13px] tabular-nums shrink-0">
        <span className={cn("font-black", myScore < oppScore && "text-muted-foreground")}>{fmtInt(myScore)}</span>
        <span className="text-muted-foreground/60">–</span>
        <span className={cn("font-black", myScore > oppScore && "text-muted-foreground")}>{fmtInt(oppScore)}</span>
      </p>
      {!myProof && (
        <Button variant="ember" size="sm" className="min-h-11 shrink-0" loading={isUploading} aria-label="Add proof photo" onClick={() => onRequestUpload(battle.id)}>
          <Camera size={14} aria-hidden />
        </Button>
      )}
    </div>
  );
};

export default BattleActiveCard;
