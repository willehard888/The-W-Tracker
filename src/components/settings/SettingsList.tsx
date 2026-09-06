import { ChevronRight } from "lucide-react";
import { hapticSelection } from "@/lib/haptics";

/**
 * The settings-list vocabulary (lifted from Profile.tsx so every settings
 * surface — Profile tab, /settings/notifications — renders the same rows).
 */

/** Settings section: eyebrow + surface-card list of rows. */
export const SettingsGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="home-rise home-rise-1">
    <p className="eyebrow px-1 mb-1.5">{title}</p>
    <div className="surface-card overflow-hidden divide-y divide-border/30">{children}</div>
  </div>
);

/** One tappable settings row — icon · label/sub · optional badge · chevron. */
export const SettingsRow = ({
  icon: Icon,
  label,
  sub,
  badge,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  sub?: string;
  badge?: number;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={() => { void hapticSelection(); onClick(); }}
    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-card/60 transition-colors "
  >
    <Icon aria-hidden size={14} className="text-muted-foreground shrink-0" />
    <span className="flex-1 min-w-0">
      <span className="block text-[13px] font-semibold truncate">{label}</span>
      {sub && <span className="block text-[11px] text-muted-foreground truncate mt-0.5">{sub}</span>}
    </span>
    {badge != null && badge > 0 && (
      <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-gold text-[11px] font-black tabular-nums">
        {badge}
      </span>
    )}
    <ChevronRight aria-hidden size={14} className="text-muted-foreground/75 shrink-0" />
  </button>
);
