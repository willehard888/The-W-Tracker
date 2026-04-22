import { useState } from "react";
import StatusAvatar from "@/components/StatusAvatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getTierConfig } from "@/lib/status-tiers";
import { cn } from "@/lib/utils";

const TIERS = [
  "recruit",
  "operator",
  "performer",
  "high_performer",
  "elite",
  "apex",
  "legend",
] as const;

interface StatusPreviewProps {
  currentTier?: string;
  className?: string;
}

const StatusPreview = ({ currentTier, className }: StatusPreviewProps) => {
  const [animationsOn, setAnimationsOn] = useState(true);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground">
            Status Preview
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
            How each tier appears
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
          "grid grid-cols-4 gap-3",
          !animationsOn && "[&_*]:!animate-none",
        )}
      >
        {TIERS.map((tier) => {
          const cfg = getTierConfig(tier);
          const isCurrent = currentTier === tier;
          return (
            <div
              key={tier}
              className={cn(
                "flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors",
                isCurrent
                  ? "border-gold/40 bg-gold/5"
                  : "border-transparent",
              )}
            >
              <StatusAvatar
                name={cfg.label}
                tier={tier}
                size="md"
                showBadge
              />
              <p className="text-[9px] uppercase tracking-wider font-black text-foreground/80 text-center leading-tight mt-1">
                {cfg.label}
              </p>
              {isCurrent && (
                <span className="text-[8px] font-black tracking-wider text-gold uppercase">
                  You
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground/60 mt-3 text-center italic">
        Toggle off to compare static vs. animated rings
      </p>
    </div>
  );
};

export default StatusPreview;
