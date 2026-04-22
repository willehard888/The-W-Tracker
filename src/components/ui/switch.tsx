import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent",
      "transition-[background,box-shadow] duration-200 [transition-timing-function:var(--ease-soft)]",
      // Off — recessed obsidian
      "data-[state=unchecked]:[background:linear-gradient(180deg,hsl(258_18%_4%)_0%,hsl(258_16%_6%)_100%)]",
      "data-[state=unchecked]:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.5),inset_0_-1px_0_hsl(0_0%_100%/0.025)]",
      // On — gold metal
      "data-[state=checked]:[background:linear-gradient(180deg,hsl(42_85%_56%)_0%,hsl(42_65%_38%)_100%)]",
      "data-[state=checked]:shadow-[inset_0_0.5px_0_hsl(0_0%_100%/0.6),inset_0_-1px_0_hsl(42_50%_18%/0.55),0_0_14px_-2px_hsl(var(--gold)/0.45)]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--gold)/0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full ring-0 transition-transform duration-200 [transition-timing-function:var(--ease-spring)]",
        "[background:linear-gradient(180deg,hsl(0_0%_100%)_0%,hsl(0_0%_88%)_100%)]",
        "shadow-[0_1px_2px_hsl(0_0%_0%/0.45),0_2px_6px_-1px_hsl(0_0%_0%/0.4),inset_0_-1px_0_hsl(0_0%_0%/0.15)]",
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-[2px]",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
