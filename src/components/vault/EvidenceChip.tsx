import { cn } from "@/lib/utils";
import { ShieldCheck, Sparkles, FlaskConical } from "lucide-react";

type Tier = "strong" | "promising" | "speculative";

/** The tier as plain text — for rows that carry evidence as type, not a chip. */
export const EVIDENCE_LABEL: Record<Tier, string> = {
  strong: "Strong evidence",
  promising: "Promising",
  speculative: "Speculative",
};

const TIER_META: Record<Tier, { label: string; Icon: typeof ShieldCheck; classes: string }> = {
  strong: {
    label: EVIDENCE_LABEL.strong,
    Icon: ShieldCheck,
    classes: "border-xp-green/40 bg-xp-green/10 text-xp-green",
  },
  promising: {
    label: EVIDENCE_LABEL.promising,
    Icon: Sparkles,
    classes: "border-amber/40 bg-amber/10 text-amber-light",
  },
  speculative: {
    label: EVIDENCE_LABEL.speculative,
    Icon: FlaskConical,
    classes: "border-rose/40 bg-rose/10 text-rose-light",
  },
};

const EvidenceChip = ({ tier, size = "sm" }: { tier: Tier; size?: "sm" | "md" }) => {
  const m = TIER_META[tier];
  const Icon = m.Icon;
  return (
    <span
      className={cn(
        "eyebrow inline-flex items-center gap-1 rounded-full border",
        m.classes,
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
      )}
    >
      <Icon size={size === "sm" ? 8 : 10} strokeWidth={3} />
      {m.label}
    </span>
  );
};

export default EvidenceChip;
