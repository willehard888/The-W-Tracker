import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sublabel?: string;
  variant?: "default" | "gold" | "streak" | "elite" | "teal" | "rose" | "purple";
  className?: string;
}

const StatCard = ({ icon: Icon, label, value, sublabel, variant = "default", className }: StatCardProps) => {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-border bg-card p-4 card-hover card-depth overflow-hidden",
        variant === "gold" && "border-gold/30 glow-gold-sm",
        variant === "streak" && "border-[hsl(var(--streak-orange))]/30",
        variant === "elite" && "border-gold/40 shadow-[0_0_20px_hsl(var(--gold)/0.15)]",
        variant === "teal" && "border-[hsl(var(--teal))]/25 glow-teal-sm",
        variant === "rose" && "border-[hsl(var(--rose))]/25 glow-rose-sm",
        variant === "purple" && "border-[hsl(var(--purple))]/25 glow-purple-sm",
        className
      )}>
      
      {(variant === "gold" || variant === "teal" || variant === "rose" || variant === "purple") &&
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br to-transparent pointer-events-none",
        variant === "gold" && "from-gold/5",
        variant === "teal" && "from-[hsl(var(--teal))]/5",
        variant === "rose" && "from-[hsl(var(--rose))]/5",
        variant === "purple" && "from-[hsl(var(--purple))]/5"
      )} />
      }
      {variant === "elite" &&
      <>
          <div className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(135deg, hsl(42 78% 54% / 0.1), transparent 60%)" }} />
        
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none opacity-60 blur-xl animate-pulse"
        style={{ background: "radial-gradient(circle, hsl(42 90% 55% / 0.2) 0%, transparent 70%)" }} />
        
        </>
      }
      <div className="relative flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            variant === "gold" ?
            "bg-gold/15 text-gold" :
            variant === "streak" ?
            "bg-[hsl(var(--streak-orange))]/15 text-[hsl(var(--streak-orange))]" :
            variant === "elite" ?
            "gradient-gold text-primary-foreground shadow-[0_0_12px_hsl(var(--gold)/0.3)]" :
            variant === "teal" ?
            "bg-[hsl(var(--teal))]/15 text-[hsl(var(--teal))]" :
            variant === "rose" ?
            "bg-[hsl(var(--rose))]/15 text-[hsl(var(--rose))]" :
            variant === "purple" ?
            "bg-[hsl(var(--purple))]/15 text-[hsl(var(--purple))]" :
            "bg-secondary text-muted-foreground"
          )}>
          
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium tracking-wide uppercase text-base text-primary">{label}</p>
          <p className={cn("font-bold font-display tracking-tight leading-tight mt-0.5 text-7xl",

          variant === "gold" && "text-gold glow-gold-text",
          variant === "elite" && "text-gold font-black drop-shadow-[0_0_6px_hsl(var(--gold)/0.4)]",
          variant === "teal" && "text-[hsl(var(--teal))]",
          variant === "rose" && "text-[hsl(var(--rose))]",
          variant === "purple" && "text-[hsl(var(--purple))]"
          )}>
            {value}
          </p>
          {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
        </div>
      </div>
    </div>);

};

export default StatCard;