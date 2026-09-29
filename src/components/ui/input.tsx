import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * THE text field. One shape for every input in the app: the 44 pt floor, the
 * button scale's rounded-xl, 16 px so iOS never zooms on focus, and one focus
 * answer — the border warms to gold with a soft bloom, on the same 140 ms
 * curve every button uses. No ring: a field is focused by the tap that starts
 * typing, and a keyboard-navigation ring around it read as "selected".
 *
 * The 12 sites that used to override h-11 / rounded-xl / text-copy and the 16
 * raw <input className="surface-inset rounded-xl h-11 …"> copies all mean this.
 */
export const FIELD = [
  "surface-inset flex w-full min-h-11 rounded-xl px-3.5 text-copy text-foreground",
  "placeholder:text-fg-faint",
  "transition-[border-color,box-shadow,background-color,opacity] duration-[140ms] [transition-timing-function:var(--ease-ios)]",
  "focus-visible:outline-none focus-visible:border-[hsl(var(--gold)/0.55)]",
  "focus-visible:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.45),0_0_0_1px_hsl(var(--gold)/0.28),0_0_16px_-4px_hsl(var(--gold)/0.35)]",
  "aria-[invalid=true]:border-[hsl(var(--destructive)/0.7)] aria-[invalid=true]:focus-visible:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.45),0_0_0_1px_hsl(var(--destructive)/0.3)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          FIELD,
          "h-11 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

/**
 * Spread onto every search field. iOS capitalises the first letter and
 * autocorrects what it takes for a typo — "maito" became "Maito" with "Mauro"
 * on offer, and a username search was one space away from another name.
 */
const SEARCH_FIELD = { autoCapitalize: "none", autoCorrect: "off", spellCheck: false, enterKeyHint: "search" } as const;

export { Input, SEARCH_FIELD };
