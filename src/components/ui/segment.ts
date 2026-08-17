// One segmented-control look for the whole app. Squad and Tribes carried two
// copy-pasted gradient strings and Recipes a third flat style — page-level
// segments now import these instead of re-inventing the control.

/** Track: deep inset glass. */
export const SEGMENT_TRACK =
  "flex gap-1 rounded-xl bg-[hsl(258_16%_6%/0.8)] border border-border/60 p-1 shadow-[inset_0_1px_3px_hsl(0_0%_0%/0.45)]";

/** Active segment: machined metallic gold (matches the primary CTA bezel). */
export const SEGMENT_ACTIVE =
  "bg-[linear-gradient(180deg,hsl(44_92%_66%),hsl(36_90%_56%)_50%,hsl(28_86%_48%))] text-[hsl(26_85%_10%)] shadow-[0_0_0_1px_hsl(40_80%_70%/0.3),inset_0_1px_0_hsl(48_100%_92%/0.6),inset_0_-1px_2px_hsl(16_80%_24%/0.4),0_2px_8px_-2px_hsl(28_90%_40%/0.5)]";

/** Inactive segment text. */
export const SEGMENT_IDLE = "text-muted-foreground hover:text-foreground";
