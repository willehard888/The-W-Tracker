import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck, Sparkles, FlaskConical } from "lucide-react";

type Tier = "strong" | "promising" | "speculative";

/** The tier as plain text — for rows that carry evidence as type, not a chip. */
export const EVIDENCE_LABEL: Record<Tier, string> = {
  strong: "Strong evidence",
  promising: "Promising",
  speculative: "Speculative",
};

const TIER_META: Record<Tier, { Icon: typeof ShieldCheck; classes: string }> = {
  strong: { Icon: ShieldCheck, classes: "border-xp-green/40 bg-xp-green/10 text-xp-green" },
  promising: { Icon: Sparkles, classes: "border-amber/40 bg-amber/10 text-amber-light" },
  speculative: { Icon: FlaskConical, classes: "border-rose/40 bg-rose/10 text-rose-light" },
};

/** The one chip shape of the Vault: sentence case, the label rung, a hairline. */
export const VaultChip = ({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) => (
  <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-label font-bold", className)} style={style}>
    {children}
  </span>
);

const EvidenceChip = ({ tier }: { tier: Tier }) => {
  const { Icon, classes } = TIER_META[tier];
  return (
    <VaultChip className={classes}>
      <Icon aria-hidden size={10} strokeWidth={3} />
      {EVIDENCE_LABEL[tier]}
    </VaultChip>
  );
};

export default EvidenceChip;
