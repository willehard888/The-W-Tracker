import { DoorRow } from "@/components/coach/rows";

/**
 * The settings-list vocabulary (lifted from Profile.tsx so every settings
 * surface — Profile tab, /settings/notifications — renders the same rows).
 */

/** Settings section: label + surface-card list of rows. */
export const SettingsGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="home-rise home-rise-1">
    <p className="text-label font-bold text-muted-foreground px-1 mb-1.5">{title}</p>
    <div className="surface-card overflow-hidden divide-y divide-border/35">{children}</div>
  </div>
);

/** One settings row: the DoorRow inside a card — icon · label/sub · optional badge · chevron. */
export const SettingsRow = ({
  icon,
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
}) => {
  const Icon = icon;
  return (
    <DoorRow
      leading={<Icon aria-hidden size={16} className="text-muted-foreground shrink-0" />}
      label={label}
      sub={sub}
      onClick={onClick}
      className="px-4"
      trailing={badge != null && badge > 0 ? (
        <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-gold text-label font-black tabular-nums">
          {badge}
        </span>
      ) : undefined}
    />
  );
};
