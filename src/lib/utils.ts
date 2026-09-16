import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge has to know the type ladder (tailwind.config.ts fontSize):
 * without it, `text-label` next to `text-muted-foreground` reads as two
 * colours and the size is dropped. The codemod that moved 1176 hand-written
 * sizes onto the rungs turned every such `cn()` call into a silently
 * unsized label. Keep this list equal to the config's fontSize keys.
 */
export const TYPE_RUNGS = [
  "label",
  "meta",
  "dense",
  "note",
  "read",
  "copy",
  "lead",
  "subhead",
  "head",
  "title",
  "major",
  "beat",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...TYPE_RUNGS] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
