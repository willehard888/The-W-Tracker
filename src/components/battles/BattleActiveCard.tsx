import { Clock, Camera, Image, MoreHorizontal, ShieldCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignedMediaUrl } from "@/lib/signed-url";
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

/** A live battle: VS scoreboard, time left, and the required proof photos. */
const BattleActiveCard = ({
  battle, opp, typeInfo, profileUsername, myScore, oppScore, amWinning, daysLeft,
  myProof, oppProof, isAdmin, isUploading, onRequestUpload, onAdminCancel, onAdminDelete,
}: Props) => {
  // proof-photos is a private bucket — render via signed URLs.
  const myProofSrc = useSignedMediaUrl(myProof);
  const oppProofSrc = useSignedMediaUrl(oppProof);
  const TypeIcon = typeInfo.icon;
  return (
    <div className="rounded-xl border border-gold/20 overflow-hidden glass-3d depth-realistic">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <TypeIcon size={14} className={typeInfo.color} />
          <span className="eyebrow" style={{ color: "hsl(var(--gold))" }}>
            {typeInfo.emoji} {typeInfo.label} Battle
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(var(--streak-orange))]/10 border border-[hsl(var(--streak-orange))]/20">
            <Clock size={12} className="text-[hsl(var(--streak-orange))]" />
            <span className="text-[11px] font-bold text-[hsl(var(--streak-orange))]">{daysLeft}d left</span>
          </div>
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="Battle options" className="relative p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground/60 hover:text-muted-foreground before:absolute before:-inset-2.5 before:content-['']">
                  <MoreHorizontal size={14} />
                </button>
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

      {/* VS Display */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 text-center">
          <div className="h-12 w-12 rounded-full gradient-gold flex items-center justify-center text-lg font-black text-primary-foreground mx-auto mb-1">
            {profileUsername?.charAt(0)?.toUpperCase()}
          </div>
          <p className="text-xs font-bold truncate text-gold">@{profileUsername} <span className="text-[11px] text-gold/70 font-medium">(you)</span></p>
          <p className={cn("text-lg font-black font-display tabular-nums", amWinning ? "text-gold" : "text-muted-foreground")}>
            {myScore}
          </p>
          <p className="text-[11px] text-muted-foreground">{typeInfo.label}</p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-black text-muted-foreground/40">VS</span>
        </div>

        <div className="flex-1 text-center">
          <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-lg font-black text-muted-foreground mx-auto mb-1">
            {opp.username?.charAt(0)?.toUpperCase()}
          </div>
          <p className="text-xs font-bold truncate">@{opp.username}</p>
          <p className={cn("text-lg font-black font-display tabular-nums", !amWinning ? "text-gold" : "text-muted-foreground")}>
            {oppScore}
          </p>
          <p className="text-[11px] text-muted-foreground">{typeInfo.label}</p>
        </div>
      </div>

      <div className={cn(
        "text-center text-xs font-bold py-1.5 mx-4 rounded-lg",
        amWinning ? "bg-gold/10 text-gold" : "bg-destructive/10 text-destructive",
      )}>
        {amWinning ? "You're winning 🔥" : "You're behind — grind harder"}
      </div>

      {/* Proof Section — REQUIRED */}
      <div className="p-4 pt-3 border-t border-border mt-3">
        <p className="eyebrow text-muted-foreground mb-2 flex items-center gap-1">
          <Camera size={12} /> Proof Photos <span className="text-destructive ml-1">(required)</span>
        </p>

        {!myProof && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 mb-3 flex items-center gap-2">
            <Camera size={14} className="text-destructive shrink-0" />
            <p className="text-[12px] text-destructive font-semibold">
              Upload your proof to validate this battle. No proof = automatic forfeit.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          {/* My proof */}
          <div className="flex-1">
            {myProof ? (
              <div className="relative rounded-lg overflow-hidden aspect-square bg-secondary">
                {myProofSrc && <img loading="lazy" decoding="async" src={myProofSrc} alt="My proof" className="w-full h-full object-cover" />}
                <div className="absolute bottom-0 inset-x-0 bg-black/60 py-1 text-center">
                  <span className="text-[10px] font-bold text-white">You ✅</span>
                </div>
              </div>
            ) : (
              <button
                onClick={() => onRequestUpload(battle.id)}
                disabled={isUploading}
                className="w-full aspect-square rounded-lg border-2 border-dashed border-destructive/40 bg-destructive/5 flex flex-col items-center justify-center gap-1 transition-all hover:bg-destructive/10 active:scale-95 animate-pulse"
              >
                {isUploading ? (
                  <span className="text-[11px] text-muted-foreground animate-pulse">Uploading…</span>
                ) : (
                  <>
                    <Camera size={20} className="text-destructive" />
                    <span className="text-[10px] font-bold text-destructive">UPLOAD NOW</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Opponent proof */}
          <div className="flex-1">
            {oppProof ? (
              <div className="relative rounded-lg overflow-hidden aspect-square bg-secondary">
                {oppProofSrc && <img loading="lazy" decoding="async" src={oppProofSrc} alt="Opponent proof" className="w-full h-full object-cover" />}
                <div className="absolute bottom-0 inset-x-0 bg-black/60 py-1 text-center">
                  <span className="text-[10px] font-bold text-white">@{opp.username} ✅</span>
                </div>
              </div>
            ) : (
              <div className="w-full aspect-square rounded-lg border border-border bg-secondary/50 flex flex-col items-center justify-center gap-1">
                <Image size={16} className="text-muted-foreground/40" />
                <span className="text-[10px] text-muted-foreground">No proof yet</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BattleActiveCard;
