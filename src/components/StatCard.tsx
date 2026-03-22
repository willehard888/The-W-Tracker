import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sublabel?: string;
  variant?: "default" | "gold" | "streak";
  className?: string;
}

const StatCard = ({ icon: Icon, label, value, sublabel, variant = "default", className }: StatCardProps) => {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-border bg-card p-4 card-hover overflow-hidden",
        variant === "gold" && "border-gold/30 glow-gold-sm",
        variant === "streak" && "border-[hsl(var(--streak-orange))]/30",
        className
      )}
    >
      {variant === "gold" && (
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent pointer-events-none" />
      )}
      <div className="relative flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            variant === "gold"
              ? "bg-gold/15 text-gold"
              : variant === "streak"
              ? "bg-[hsl(var(--streak-orange))]/15 text-[hsl(var(--streak-orange))]"
              : "bg-secondary text-muted-foreground"
          )}
        >
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">{label}</p>
          <p className={cn(
            "text-2xl font-bold font-display tracking-tight leading-tight mt-0.5",
            variant === "gold" && "text-gold glow-gold-text"
          )}>
            {value}
          </p>
          {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
