// The offer, not the session: one row that says what it would work on and how
// long it would take, with a way in and a way past.
//
// It is never mandatory and it never blocks finishing a workout. That is the
// whole design constraint — an athlete who has just put the bar down and wants
// a shower must be able to leave without stepping around something.
import { Link } from "react-router-dom";
import { Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hapticImpact } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import type { RecoveryArea } from "@/data/recovery";

export interface RecoveryOfferProps {
  /** Where the offer is being made — carried into the session and the events. */
  source: "post_workout" | "rest_day";
  areas: RecoveryArea[];
  minutes: number;
  /** Appended to /recovery, e.g. "p=…&w=1&d=2". */
  query: string;
  onDismiss?: () => void;
}

/** "chest, shoulders and triceps" — a list a person would say out loud. */
export const listAreas = (areas: RecoveryArea[]): string => {
  if (areas.length === 0) return "";
  if (areas.length === 1) return areas[0];
  return `${areas.slice(0, -1).join(", ")} and ${areas[areas.length - 1]}`;
};

export default function RecoveryOffer({
  source,
  areas,
  minutes,
  query,
  onDismiss,
}: RecoveryOfferProps) {
  // The XP is named because an unnamed reward is not one, and it is named the
  // way it is actually paid: recovery ticks the mobility habit on the check-in,
  // the same route a finished workout takes. It is not awarded here, and saying
  // "+15 XP" flat would promise something this screen does not hand over.
  const subtitle = areas.length
    ? `${listAreas(areas)} · ${minutes} min`
    : `A short general session · ${minutes} min`;

  return (
    <div className="surface-card surface-card-quiet flex items-center">
      <div className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3">
        <span className="h-10 w-10 shrink-0 rounded-xl bg-card/60 border border-border/40 flex items-center justify-center">
          <Waves size={16} className="text-muted-foreground" aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-label font-bold text-muted-foreground/75 mb-0.5">
            {source === "rest_day" ? "Rest day" : "After the work"}
          </p>
          <p className="text-note font-bold leading-tight">
            {source === "rest_day" ? "Loosen off what you trained" : "Stretch what you just trained"}
          </p>
          <p className="text-meta text-muted-foreground leading-snug mt-0.5 truncate">{subtitle}</p>
        </div>
      </div>
      <div className="pr-2 shrink-0 flex items-center gap-1">
        <Button variant="outline" size="sm" className="min-h-11" asChild>
          <Link
            to={`/recovery?src=${source}${query ? `&${query}` : ""}`}
            onClick={() => {
              hapticImpact("light");
              void track("recovery_opened", { source, areas, minutes });
            }}
          >
            Start
          </Link>
        </Button>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 text-muted-foreground"
            onClick={() => {
              void track("recovery_dismissed", { source, areas });
              onDismiss();
            }}
          >
            Not now
          </Button>
        )}
      </div>
    </div>
  );
}
