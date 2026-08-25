import { cn } from "@/lib/utils";
import type { ExerciseGroup } from "@/lib/exercise-group";

/**
 * The branded exercise tile — one consistent, instant visual for every
 * program row. Replaces the mixed-style library photos (amateur gym shots
 * that loaded late and fell back to a generic dumbbell when the name didn't
 * match). Gold line glyph per muscle group on the dark brand surface; the
 * real technique photos still live in the expanded detail.
 */

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const GLYPHS: Record<ExerciseGroup, React.ReactNode> = {
  // Squat: bar across the shoulders, hips back, knees bent.
  legs: (
    <g {...STROKE}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <circle cx="12" cy="4.6" r="1.7" />
      <path d="M12 7v3.2l-2.6 3.4 .6 5.4" />
      <path d="M12 10.2l2.6 3.4-.6 5.4" />
    </g>
  ),
  // Bench press: bar above the chest, bench line below.
  chest: (
    <g {...STROKE}>
      <line x1="5" y1="6.5" x2="19" y2="6.5" />
      <line x1="7" y1="4.5" x2="7" y2="8.5" />
      <line x1="17" y1="4.5" x2="17" y2="8.5" />
      <path d="M12 6.5v4" />
      <path d="M4.5 15.5h15" />
      <path d="M7 15.5v3.5M17 15.5v3.5" />
    </g>
  ),
  // Pull: bar overhead, figure hanging mid pull-up.
  back: (
    <g {...STROKE}>
      <line x1="4" y1="4.5" x2="20" y2="4.5" />
      <path d="M8.5 4.5l2 4h3l2-4" />
      <circle cx="12" cy="11" r="1.7" />
      <path d="M12 12.7v3.6l-1.8 3.2M12 16.3l1.8 3.2" />
    </g>
  ),
  // Overhead press: bar locked out above the head.
  shoulders: (
    <g {...STROKE}>
      <line x1="6" y1="4" x2="18" y2="4" />
      <path d="M8.5 8.5L12 4l3.5 4.5" />
      <circle cx="12" cy="10.8" r="1.7" />
      <path d="M12 12.5v4l-2 3M12 16.5l2 3" />
    </g>
  ),
  // Curl: flexed forearm raising a dumbbell.
  arms: (
    <g {...STROKE}>
      <path d="M5.5 18.5V9.5" />
      <path d="M5.5 13.5c4.5 0 7-1.5 8.5-4.5" />
      <line x1="12" y1="6.5" x2="16" y2="10.5" />
      <line x1="11" y1="9" x2="13.5" y2="6" />
      <line x1="14.5" y1="12" x2="17.5" y2="8.5" />
    </g>
  ),
  // Core: torso crunch arc over bent knees.
  core: (
    <g {...STROKE}>
      <path d="M4 18h16" />
      <circle cx="7.5" cy="11.5" r="1.7" />
      <path d="M8.8 12.8c2 1.6 4.2 2.2 6.2 2.2" />
      <path d="M15 15l3-4" />
      <path d="M15 15l-1 3" />
    </g>
  ),
  // Conditioning: heartbeat pulse.
  conditioning: (
    <g {...STROKE}>
      <path d="M3.5 12.5h4l2-5 3 9 2.5-6.5 1.5 2.5h4" />
    </g>
  ),
  // Default: a loaded barbell.
  full: (
    <g {...STROKE}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <rect x="5" y="8.5" width="2.6" height="7" rx="0.8" />
      <rect x="16.4" y="8.5" width="2.6" height="7" rx="0.8" />
    </g>
  ),
};

interface ExerciseTileProps {
  group: ExerciseGroup;
  /** Outer tile size in px. */
  size?: number;
  className?: string;
}

const ExerciseTile = ({ group, size = 40, className }: ExerciseTileProps) => (
  <div
    aria-hidden
    className={cn(
      "shrink-0 rounded-lg border border-gold/25 text-gold/90 flex items-center justify-center",
      "bg-gradient-to-br from-gold/[0.10] via-card/60 to-card/80 shadow-[inset_0_1px_0_hsl(var(--gold)/0.15)]",
      className,
    )}
    style={{ width: size, height: size }}
  >
    <svg width={Math.round(size * 0.55)} height={Math.round(size * 0.55)} viewBox="0 0 24 24">
      {GLYPHS[group]}
    </svg>
  </div>
);

export default ExerciseTile;
