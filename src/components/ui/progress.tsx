import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("surface-inset relative h-3 w-full overflow-hidden rounded-full", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 transition-all duration-700 [transition-timing-function:var(--ease-soft)] relative"
      style={{
        transform: `translateX(-${100 - (value || 0)}%)`,
        background:
          "linear-gradient(180deg, hsl(var(--tier-color, var(--gold)) / 0.95) 0%, hsl(var(--tier-color, var(--gold)) / 0.78) 55%, hsl(var(--tier-color-deep, var(--gold-dark)) / 0.92) 100%)",
        boxShadow:
          "inset 0 0.5px 0 hsl(0 0% 100% / 0.55), inset 0 -1px 0 hsl(var(--tier-color-deep, var(--gold-dark)) / 0.5), 0 0 14px hsl(var(--tier-color, var(--gold)) / 0.3)",
      }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
