import { cn } from "@/lib/utils";
import { ShieldCheck, Sparkles, FlaskConical } from "lucide-react";

type Tier = "strong" | "promising" | "speculative";

const TIER_META: Record<Tier, { label: string; Icon: typeof ShieldCheck; classes: string }> = {
  strong: {
    label: "Strong evidence",
    Icon: ShieldCheck,
    classes: "border-xp-green/40 bg-xp-green/10 text-xp-green",
  },
  promising: {
    label: "Promising",
    Icon: Sparkles,
    classes: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  },
  speculative: {
    label: "Speculative",
    Icon: FlaskConical,
    classes: "border-rose-400/40 bg-rose-400/10 text-rose-300",
  },
};

const EvidenceChip = ({ tier, size = "sm" }: { tier: Tier; size?: "sm" | "md" }) => {
  const m = TIER_META[tier];
  const Icon = m.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-black tracking-[0.16em] uppercase",
        m.classes,
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]",
      )}
    >
      <Icon size={size === "sm" ? 8 : 10} strokeWidth={3} />
      {m.label}
    </span>
  );
};

export default EvidenceChip;
