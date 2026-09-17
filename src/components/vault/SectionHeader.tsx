import type { LucideIcon } from "lucide-react";

/**
 * The one section label of the Vault: a small mark and a name. Every sheet and
 * every block uses this, so a section reads the same wherever it appears.
 * `color` is the shelf's accent (identity); without it the label is muted.
 */
const SectionHeader = ({ Icon, label, color }: { Icon?: LucideIcon; label: string; color?: string }) => (
  <div className="flex items-center gap-2 mb-2">
    {Icon && (
      <Icon
        aria-hidden
        size={13}
        strokeWidth={2.6}
        className={color ? undefined : "text-muted-foreground"}
        style={color ? { color } : undefined}
      />
    )}
    <h3 className={color ? "text-label font-bold" : "text-label font-bold text-muted-foreground"} style={color ? { color } : undefined}>
      {label}
    </h3>
  </div>
);

export default SectionHeader;
