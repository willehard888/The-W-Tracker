// The offer, not the session: what it would work on, how long it would take,
// a way in and a way past.
//
// IT NEVER COMPETES WITH FINISHING
//
// The moment it appears in is the best one the training loop has — the bar is
// down, the sets are saved, the volume is on screen in gold. Recovery arrives
// after that, never on top of it: it is a row below the summary, both finish
// buttons still work untouched, and nothing about it is required.
//
// "MAYBE LATER" MEANS LATER
//
// Declining parks the session on Today rather than deleting it. Someone who
// does not want to stretch in the gym is not someone who does not want to
// stretch, and the first version could not tell the difference.
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { hapticImpact } from "@/lib/haptics";
import { track, FUNNEL } from "@/lib/analytics";
import { listAreas } from "@/lib/recovery/explain";
import { IllustrationThumb } from "@/components/coach/ExerciseIllustration";
import type { RecoveryArea } from "@/data/recovery";

export interface RecoveryOfferProps {
  source: "post_workout" | "rest_day";
  areas: RecoveryArea[];
  minutes: number;
  /** Appended to /recovery, e.g. "p=…&w=1&d=2". */
  query: string;
  /** One line saying where this came from. Omitted when there is nothing true to say. */
  why?: string | null;
  /** Present on the finish screen; absent on Today, where the row IS the later. */
  onLater?: () => void;
  /** The first movement of the session being offered, drawn. */
  art?: string;
}

export { listAreas };

export default function RecoveryOffer({
  source,
  areas,
  minutes,
  query,
  why,
  onLater,
  art,
}: RecoveryOfferProps) {
  const href = `/recovery?src=${source}${query ? `&${query}` : ""}`;

  return (
    <div className="surface-card surface-card-quiet px-4 py-3.5">
      <div className="flex items-start gap-3">
        {/* The session's own first movement, so the card shows what it offers. */}
        {art && <IllustrationThumb ex={{ idNum: art, title: "Recovery" }} size={40} />}
        <div className="flex-1 min-w-0">
          <p className="text-label font-bold text-muted-foreground/75 mb-0.5">
            {source === "rest_day" ? "Rest day" : "One more thing"}
          </p>
          <p className="text-note font-bold leading-tight">
            {source === "rest_day" ? "Move, then loosen off." : "Loosen up what you trained."}
          </p>
          {/* first-letter, not `capitalize`: that made it "Lats, Biceps And Upper Back · 6 Min". */}
          <p className="text-meta text-muted-foreground leading-snug mt-1 first-letter:uppercase">
            {areas.length ? listAreas(areas) : "General mobility"}
            <span className="tabular-nums"> · {minutes} min</span>
          </p>
          {why && (
            <p className="text-meta text-muted-foreground/75 leading-snug mt-1 normal-case">{why}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 min-h-11" asChild>
          <Link
            to={href}
            onClick={() => {
              hapticImpact("light");
              void track(FUNNEL.recoveryOpened, { source, areas, minutes, from: "offer" });
            }}
          >
            Start recovery
          </Link>
        </Button>
        {onLater && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 min-h-11 text-muted-foreground"
            onClick={() => {
              void track(FUNNEL.recoveryDismissed, { source, areas, minutes, choice: "later" });
              onLater();
            }}
          >
            Maybe later
          </Button>
        )}
      </div>
    </div>
  );
}
