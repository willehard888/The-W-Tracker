import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * One "needs your response" row: leading visual · two lines · accept (ember,
 * 44 pt) · decline (ghost, 44 pt hit area). Notifications and Messages used to
 * hand-roll this four times with three different button recipes.
 */
export const ActionRow = ({
  leading,
  title,
  subtitle,
  acceptLabel = "Accept",
  declineLabel = "Decline",
  onAccept,
  onDecline,
  busy,
}: {
  leading: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  acceptLabel?: string;
  declineLabel?: string;
  onAccept: () => void;
  onDecline: () => void;
  busy?: boolean;
}) => (
  <div className="flex items-center gap-3 px-3 py-2">
    <div className="shrink-0">{leading}</div>
    <div className="flex-1 min-w-0">
      <p className="text-[13px] font-bold truncate">{title}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
    </div>
    <Button size="sm" variant="ember" className="min-h-11" disabled={busy} onClick={onAccept}>
      <Check size={13} aria-hidden /> {acceptLabel}
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      className="rounded-full text-muted-foreground shrink-0"
      aria-label={declineLabel}
      disabled={busy}
      onClick={onDecline}
    >
      <X size={15} aria-hidden />
    </Button>
  </div>
);
