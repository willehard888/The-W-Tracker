import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "surface-inset relative h-3 w-full overflow-hidden rounded-full",
      className,
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 transition-all duration-700 [transition-timing-function:var(--ease-soft)] relative"
      style={{
        transform: `translateX(-${100 - (value || 0)}%)`,
        background:
          "linear-gradient(180deg, hsl(42 88% 62%) 0%, hsl(42 78% 54%) 55%, hsl(42 64% 42%) 100%)",
        boxShadow:
          "inset 0 0.5px 0 hsl(42 95% 82% / 0.6), inset 0 -1px 0 hsl(42 50% 22% / 0.4), 0 0 12px hsl(var(--gold) / 0.25)",
      }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
