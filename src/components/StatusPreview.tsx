import { useState } from "react";
import StatusAvatar from "@/components/StatusAvatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getTierConfig } from "@/lib/status-tiers";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

const TIERS = [
  "recruit",
  "operator",
  "performer",
  "high_performer",
  "elite",
  "apex",
  "legend",
] as const;

// Visual treatment per tier — escalates dramatically with rank
const tierCardStyles: Record<string, { bg: string; border: string; glow: string; label: string }> = {
  recruit: {
    bg: "bg-secondary/20",
    border: "border-border/40",
    glow: "",
    label: "text-muted-foreground",
  },
  operator: {
    bg: "bg-[hsl(var(--teal))]/5",
    border: "border-[hsl(var(--teal))]/30",
    glow: "shadow-[0_0_20px_-4px_hsl(var(--teal)/0.3)]",
    label: "text-[hsl(var(--teal))]",
  },
  performer: {
    bg: "bg-[hsl(210_90%_56%)]/5",
    border: "border-[hsl(210_90%_56%)]/35",
    glow: "shadow-[0_0_24px_-4px_hsl(210_90%_56%/0.4)]",
    label: "text-[hsl(210_90%_70%)]",
  },
  high_performer: {
    bg: "bg-[hsl(var(--purple))]/8",
    border: "border-[hsl(var(--purple))]/40",
    glow: "shadow-[0_0_28px_-4px_hsl(var(--purple)/0.45)]",
    label: "text-[hsl(var(--purple))]",
  },
  elite: {
    bg: "bg-gradient-to-br from-gold/10 via-gold/5 to-transparent",
    border: "border-gold/50",
    glow: "shadow-[0_0_32px_-4px_hsl(var(--gold)/0.55)]",
    label: "text-gold",
  },
  apex: {
    bg: "bg-[radial-gradient(ellipse_at_center,hsl(18_95%_58%/0.15),hsl(var(--gold)/0.08)_50%,transparent_80%)]",
    border: "border-[hsl(18_95%_58%)]/55",
    glow: "shadow-[0_0_40px_-2px_hsl(18_95%_58%/0.5),0_0_60px_-8px_hsl(var(--gold)/0.4)]",
    label: "text-[hsl(18_95%_68%)]",
  },
  legend: {
    bg: "bg-[radial-gradient(ellipse_at_center,hsl(280_70%_55%/0.18),hsl(42_90%_55%/0.1)_45%,hsl(350_80%_55%/0.08)_70%,transparent)]",
    border: "border-[hsl(280_70%_60%)]/60",
    glow: "shadow-[0_0_44px_-2px_hsl(280_70%_60%/0.5),0_0_70px_-10px_hsl(var(--gold)/0.4)]",
    label: "text-transparent bg-clip-text bg-gradient-to-r from-[hsl(280_70%_75%)] via-gold to-[hsl(350_80%_70%)]",
  },
};

interface StatusPreviewProps {
  currentTier?: string;
  className?: string;
}

const StatusPreview = ({ currentTier, className }: StatusPreviewProps) => {
  const [animationsOn, setAnimationsOn] = useState(true);

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-4 overflow-hidden",
        className,
      )}
    >
      {/* Ambient backdrop sweep */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at top right, hsl(var(--gold)/0.05), transparent 60%), radial-gradient(ellipse at bottom left, hsl(280 70% 60%/0.05), transparent 60%)",
        }}
      />

      <div className="relative flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] font-black text-muted-foreground">
            Status Preview
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
            Every rank · the whole spectacle
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label
            htmlFor="status-preview-anim"
            className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground cursor-pointer"
          >
            Animations
          </Label>
          <Switch
            id="status-preview-anim"
            checked={animationsOn}
            onCheckedChange={setAnimationsOn}
          />
        </div>
      </div>

      <div
        className={cn(
          "relative grid grid-cols-3 gap-3",
          !animationsOn && "[&_*]:!animate-none",
        )}
      >
        {TIERS.map((tier) => {
          const cfg = getTierConfig(tier);
          const styles = tierCardStyles[tier];
          const isCurrent = currentTier === tier;
          const isLegend = tier === "legend";
          const isApex = tier === "apex";

          return (
            <div
              key={tier}
              className={cn(
                "relative flex flex-col items-center gap-2 p-3 pt-4 pb-3 rounded-2xl border transition-all overflow-hidden",
                styles.bg,
                styles.border,
                styles.glow,
                isCurrent && "ring-2 ring-gold/60 ring-offset-2 ring-offset-background scale-[1.03]",
              )}
            >
              {/* Legend: conic gradient sheen behind avatar */}
              {isLegend && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-50"
                  style={{
                    background:
                      "conic-gradient(from 220deg at 50% 35%, hsl(280 70% 58%/0.25), hsl(42 90% 55%/0.18), hsl(350 80% 55%/0.22), hsl(280 70% 58%/0.25))",
                  }}
                />
              )}

              {/* Apex: ember dots */}
              {isApex && animationsOn && (
                <>
                  <span
                    aria-hidden
                    className="absolute top-2 right-3 h-1 w-1 rounded-full bg-[hsl(18_95%_58%)] animate-pulse"
                  />
                  <span
                    aria-hidden
                    className="absolute bottom-3 left-2 h-0.5 w-0.5 rounded-full bg-gold animate-pulse"
                    style={{ animationDelay: "0.6s" }}
                  />
                </>
              )}

              {/* Legend sparkle accents (top corners) */}
              {isLegend && animationsOn && (
                <>
                  <Sparkles
                    size={9}
                    className="absolute top-1.5 right-1.5 text-gold/70 animate-pulse"
                  />
                  <Sparkles
                    size={7}
                    className="absolute top-3 left-2 text-[hsl(280_70%_70%)]/60 animate-pulse"
                    style={{ animationDelay: "0.8s" }}
                  />
                </>
              )}

              <div className="relative">
                <StatusAvatar
                  name={cfg.label}
                  tier={tier}
                  size="lg"
                  showBadge
                />
              </div>

              <p
                className={cn(
                  "relative text-[10px] uppercase tracking-[0.14em] font-black text-center leading-tight mt-1",
                  styles.label,
                )}
              >
                {cfg.label}
              </p>

              <p className="relative text-[8px] uppercase tracking-wider text-muted-foreground/60 font-bold text-center leading-tight">
                {cfg.percentile}
              </p>

              {isCurrent && (
                <span className="relative mt-0.5 px-2 py-0.5 rounded-full text-[8px] font-black tracking-[0.18em] text-background bg-gold uppercase shadow-[0_0_12px_hsl(var(--gold)/0.6)]">
                  You
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="relative text-[10px] text-muted-foreground/60 mt-4 text-center italic">
        Toggle animations to compare static vs. live rings
      </p>
    </div>
  );
};

export default StatusPreview;
