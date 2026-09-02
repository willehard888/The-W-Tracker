import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";

/**
 * House switch — gold when on, inset track when off (surface-inset family).
 * Fires the selection haptic itself so callers don't have to remember to.
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, onCheckedChange, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer items-center rounded-full",
      "border transition-colors focus-visible:outline-none focus-visible:ring-2",
      "focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:gradient-gold data-[state=checked]:border-gold/60",
      "data-[state=checked]:shadow-[0_0_12px_-3px_hsl(var(--gold)/0.55)]",
      "data-[state=unchecked]:bg-background/80 data-[state=unchecked]:border-border/60",
      "data-[state=unchecked]:shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]",
      className,
    )}
    onCheckedChange={(checked) => {
      void hapticSelection();
      onCheckedChange?.(checked);
    }}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-[20px] w-[20px] rounded-full bg-foreground",
        "shadow-[0_1px_3px_rgba(0,0,0,0.5)] ring-0 transition-transform",
        "data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-primary-foreground",
        "data-[state=unchecked]:translate-x-[3px]",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
