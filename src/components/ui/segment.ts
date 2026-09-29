// One segmented-control look for the whole app. Squad and Tribes carried two
// copy-pasted gradient strings and Recipes a third flat style — page-level
// segments now import these instead of re-inventing the control.

/** Track: deep inset glass. */
export const SEGMENT_TRACK =
  "flex gap-1 rounded-xl bg-[hsl(258_16%_6%/0.8)] border border-border/60 p-1 shadow-[inset_0_1px_3px_hsl(0_0%_0%/0.45)]";

/** One press for every segment: the state changes ride the app's 140 ms curve,
 *  and a tab answers the thumb with a surface, not a shrink (a segment that
 *  scales inside its track reads as a chip). */
const SEGMENT_STATES =
  "transition-[color,background-color,box-shadow,filter] duration-[140ms] [transition-timing-function:var(--ease-ios)]";

/** Active segment: machined metallic gold (matches the primary CTA bezel). */
export const SEGMENT_ACTIVE =
  `${SEGMENT_STATES} bg-[linear-gradient(180deg,hsl(44_92%_66%),hsl(36_90%_56%)_50%,hsl(28_86%_48%))] text-[hsl(26_85%_10%)] shadow-[0_0_0_1px_hsl(40_80%_70%/0.3),inset_0_1px_0_hsl(48_100%_92%/0.6),inset_0_-1px_2px_hsl(16_80%_24%/0.4),0_2px_8px_-2px_hsl(28_90%_40%/0.5)] active:brightness-95`;

/** Inactive segment text; a quiet surface appears under the thumb. */
export const SEGMENT_IDLE =
  `${SEGMENT_STATES} text-muted-foreground hover:text-foreground active:text-foreground active:bg-white/[0.06]`;

/** The control itself: one height, one shape, one weight. `segment` takes
 *  it out of the global press scale (src/index.css) — the surface answers. */
export const SEGMENT_BUTTON = "segment flex-1 min-h-11 rounded-lg text-meta font-black";
