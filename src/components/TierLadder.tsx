import { useState, useEffect, useRef, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, ChevronDown, ChevronRight, Crown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Button } from "@/components/ui/button";
import { TIER_CONFIG, TIER_ORDER, getTierConfig, type StatusTier, type TierConfig } from "@/lib/status-tiers";
import { RedeemLegendInviteDialog } from "@/components/RedeemLegendInviteDialog";

interface TierLadderProps {
  currentTier: string;
  className?: string;
}

/** One accent per rung, tokens only: the ladder warms from muted to ember. */
const ACCENT = [
  "text-muted-foreground bg-muted/40",
  "text-teal bg-teal/10",
  "text-teal-light bg-teal-light/10",
  "text-purple bg-purple/10",
  "text-gold bg-gold/10",
  "text-ember bg-ember/10",
  "text-gold-light bg-gold-light/10",
];

const TierMark = ({ rank, className, children }: { rank: number; className?: string; children: ReactNode }) => (
  <span className={cn("shrink-0 rounded-lg flex items-center justify-center font-display font-black", ACCENT[rank] ?? ACCENT[0], className)}>
    {children}
  </span>
);

/** The rank rule and the grind path, as sentences. */
const requirementLines = (cfg: TierConfig): string[] => {
  const r = cfg.requirements;
  if (r.percentile === 0) return ["Where everyone starts."];
  const lines = [`${cfg.percentile} in rank score`];
  const grind = [
    r.activeDays > 0 && `${r.activeDays} active days in the last 30`,
    r.streak > 0 && `${r.streak}-day current streak`,
  ].filter(Boolean) as string[];
  if (grind.length) lines.push(r.orPath ? `or ${grind.join(" and ")}` : grind.join(" and "));
  return lines;
};

/**
 * Where you stand on the ladder, and the next rung. On the page it is one
 * quiet door; the ladder itself is a sheet: the current rung as the hero,
 * every other rung a hairline row that opens into its rule and unlocks.
 * `?tier=<key>` (the header's next-tier chip) opens the sheet on that rung.
 */
const TierLadder = ({ currentTier, className }: TierLadderProps) => {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<StatusTier | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const redeemRef = useRef<HTMLButtonElement>(null);

  const current = getTierConfig(currentTier);
  const currentRank = current.rank;
  const nextKey = TIER_ORDER[currentRank + 1];
  const next = nextKey ? TIER_CONFIG[nextKey] : null;

  useEffect(() => {
    const t = searchParams.get("tier");
    if (t && t in TIER_CONFIG) {
      setExpanded(t as StatusTier);
      setOpen(true);
      // strip the param so reopening requires a fresh navigation
      const params = new URLSearchParams(searchParams);
      params.delete("tier");
      setSearchParams(params, { replace: true });
      setTimeout(() => {
        document.getElementById("tier-ladder-anchor")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
    }
  }, [searchParams, setSearchParams]);

  return (
    <div id="tier-ladder-anchor" className={cn("surface-card surface-card-quiet overflow-hidden scroll-mt-20", className)}>
      <button
        type="button"
        onClick={() => { setExpanded(nextKey ?? null); setOpen(true); }}
        className="w-full min-h-11 flex items-center gap-3 px-4 py-3 text-left"
      >
        <TierMark rank={currentRank} className="h-10 w-10 text-[11px]">{current.shortLabel}</TierMark>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold truncate">Ladder</span>
          <span className="block text-[11px] text-muted-foreground truncate mt-0.5">
            {next ? `${current.label}. Next rung ${next.label}, ${next.percentile.toLowerCase()}.` : `${current.label}. The top of the ladder.`}
          </span>
        </span>
        <ChevronRight aria-hidden size={14} className="text-muted-foreground/75 shrink-0" />
      </button>

      {/* Radix dialogs stack under the sheet, so the redeem trigger lives out
          here and the sheet's Legend rung hands off to it. */}
      <RedeemLegendInviteDialog trigger={<button ref={redeemRef} type="button" hidden aria-hidden tabIndex={-1} />} />

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        label="Tier ladder"
        title="Ladder"
        subtitle={`Rung ${currentRank + 1} of ${TIER_ORDER.length}`}
        height="tall"
      >
        {/* HERO — the rung you stand on, and the one after it */}
        <div className="surface-card p-4 mt-1">
          <div className="flex items-center gap-3">
            <TierMark rank={currentRank} className="h-14 w-14 text-[15px]">{current.shortLabel}</TierMark>
            <div className="flex-1 min-w-0">
              <p className="font-display font-black text-[24px] leading-none tracking-tight">{current.label}</p>
              <p className="text-[12px] text-muted-foreground mt-1.5">{current.percentile}</p>
            </div>
          </div>
          <p className="mt-3 text-[13px] italic text-foreground/75 leading-snug">“{current.message}”</p>
          <p className="mt-3 text-[13px] text-muted-foreground leading-snug">
            {next ? (
              <>
                <span className="font-bold text-foreground">Next rung: {next.label}.</span>{" "}
                {nextKey === "legend" ? "Invite only." : `${requirementLines(next).join(", ")}.`}
              </>
            ) : (
              <span className="font-bold text-foreground">The top of the ladder.</span>
            )}
          </p>
        </div>

        {/* RUNGS — hairline rows, one accent each */}
        <div className="mt-4 divide-y divide-border/35 border-t border-border/35">
          {TIER_ORDER.map((key) => {
            const cfg = TIER_CONFIG[key];
            const held = cfg.rank < currentRank;
            const isCurrent = cfg.rank === currentRank;
            const isNext = cfg.rank === currentRank + 1;
            const isLegend = key === "legend";
            const isOpen = expanded === key;
            const status = isCurrent ? "You" : held ? "Held" : isNext ? "Next" : isLegend ? "Invite" : "Locked";
            return (
              <div key={key}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : key)}
                  className="w-full min-h-11 flex items-center gap-3 py-3 text-left"
                >
                  <TierMark rank={cfg.rank} className={cn("h-9 w-9 text-[10px]", !held && !isCurrent && "opacity-70")}>
                    {held ? <Check size={15} strokeWidth={3} aria-hidden /> : isLegend && !isCurrent ? <Crown size={14} aria-hidden /> : cfg.shortLabel}
                  </TierMark>
                  <span className="flex-1 min-w-0">
                    <span className={cn("block text-[14px] font-semibold leading-tight truncate", !held && !isCurrent && "text-foreground/85")}>{cfg.label}</span>
                    <span className="block text-[12px] text-muted-foreground mt-0.5">{cfg.percentile}</span>
                  </span>
                  <span className={cn("text-[11px] font-bold shrink-0", isCurrent ? "text-foreground" : "text-muted-foreground")}>{status}</span>
                  {status === "Locked" ? (
                    <Lock aria-hidden size={12} className="text-muted-foreground/60 shrink-0" />
                  ) : (
                    <ChevronDown aria-hidden size={14} className={cn("text-muted-foreground/60 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
                  )}
                </button>
                {isOpen && (
                  <div className="pb-4 pl-12 space-y-2 text-[13px] leading-snug">
                    {isLegend ? (
                      <p className="text-muted-foreground">
                        <span className="font-bold text-foreground">Invite only.</span> The Founders Circle is not earned through XP or streaks.
                      </p>
                    ) : (
                      requirementLines(cfg).map((line) => (
                        <p key={line} className="text-muted-foreground">{line}</p>
                      ))
                    )}
                    <p className="text-muted-foreground">
                      <span className="font-bold text-foreground">Unlocks.</span> {cfg.unlocks.join(", ")}.
                    </p>
                    {isLegend && !isCurrent && (
                      <Button
                        variant="gold-outline"
                        size="sm"
                        className="min-h-11 mt-1"
                        onClick={() => { setOpen(false); redeemRef.current?.click(); }}
                      >
                        <Crown size={13} aria-hidden /> Redeem invite code
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
};

export default TierLadder;
